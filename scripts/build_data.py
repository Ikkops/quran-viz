#!/usr/bin/env python3
"""
build_data.py — ETL: quran-database-main/quran.db  ->  public/data/*.json

Produces compact static JSON consumed by the Vite/React app, so the 209 MB
SQLite database is never shipped or needed at runtime.

Word/letter count method (documented, may differ slightly from the legacy xlsx):
  - words   = whitespace-split token count of the Uthmani ayah text
  - letters = count of Arabic letter characters after stripping all diacritics
              (harakat, superscript alef, tatweel, Quranic annotation marks)
  Sanity check: Al-Fatiha 1:1 -> 4 words / 19 letters.

Run:  python3 scripts/build_data.py
(Expects the decompressed DB at ../quran-database-main/quran.db; gunzip it first.)
"""
import json
import re
import sqlite3
import sys
import gzip
import shutil
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import topics as topics_mod  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]            # quran-viz/
REPO = ROOT.parent                                    # Quran/
DB_GZ = REPO / "quran-database-main" / "quran.db.gz"
DB = REPO / "quran-database-main" / "quran.db"
# QUL corpus (reference/quran-refs, built by reference/qul/build_db.py). Read
# only, for the ruku'/manzil divisions and the similar-ayah pairs.
QUL_DB = REPO / "reference" / "quran-refs" / "qul.db"
PLACE_EXCEPTIONS = Path(__file__).resolve().parent / "data" / "ayah_place_exceptions.json"
PLACES = ("Meccan", "Medinan", "Hijra")
# Curated period in which each surah began to be revealed (Browse timeline).
CHRONOLOGY = Path(__file__).resolve().parent / "data" / "surah_chronology.json"
CHRONO_BASES = ("asbab", "sirah", "urutan")
# Curated topic tree (Topic explorer): categories + duplicate merges, and the
# Indonesian (optionally English) name of every topic cluster.
TOPIC_TAXONOMY = Path(__file__).resolve().parent / "data" / "topic_taxonomy.json"
THEMES_ID = Path(__file__).resolve().parent / "data" / "themes_id.json"
TOPIC_NAMES = Path(__file__).resolve().parent / "data" / "topic_names_id.tsv"
# Hadith corpus (reference/hadith/build_db.py); only its verified Arabic
# asbab al-nuzul (`sahih-ar`) is exported.
HADITH_DB = REPO / "reference" / "quran-refs" / "hadith.db"

# QUL Indonesian translations exported as extra editions:
# QUL edition -> (identifier, name, englishName).
QUL_TRANSLATIONS = {
    "kemenag": ("id.kemenag-qul", "Kemenag RI (revisi)",
                "Kemenag RI, revised (QUL)"),
    "kfc-id": ("id.kfc-qul", "King Fahd Complex",
               "King Fahd Quran Complex (QUL)"),
    "sabiq": ("id.sabiq-qul", "Sabiq", "Sabiq Company (QUL)"),
}
# QUL Indonesian tafsirs exported per surah as passage groups (see
# group_tafsir): QUL edition -> identifier (src/data/editions.ts:TAFSIR_EDITIONS).
QUL_TAFSIRS = {
    "mukhtasar-id": "id.mukhtasar-qul",  # QUL tafsir/260, one note per ayah
    "saadi-id": "id.saadi-qul",          # QUL tafsir/503, one note per passage
}
# Footnote residue in a handful of QUL Indonesian verses (kfc-id 1:2, 2:194;
# sabiq 32:5, 71:14, 77:3): "puji30993>1", "Tuhan3", "dihormati 119,",
# "kepada-Nya(656)", "*". No clean verse contains a digit or '*', so these
# only ever touch the residue.
FOOTNOTE_RESIDUE = [re.compile(p) for p in (
    r"\d+>\d+", r"(?<=[A-Za-z])\d+", r"\s\d+(?=[,.;:\s])", r"\s?\(\d+\)", r"\s?\*",
)]
# QUL word-by-word ends each ayah with its number, e.g. "(1)".
WBW_AYAH_END = re.compile(r"^\(\s*[\d٠-٩]+\s*\)$")
# A standalone pause/annotation mark (ۖ ۗ ۛ ۞ …), which is not a word.
PAUSE_MARK = re.compile(r"^[\u06D6-\u06ED\u0615-\u061A۞]+$")
OUT = ROOT / "public" / "data"
TRANS_OUT = OUT / "translations"

# Editions exported as their own lazy-loaded file. Default English is en.sahih.
# We export every text translation + both transliterations + both tafsirs.
EXPORT_TYPES = ("translation", "transliteration", "tafsir")
DEFAULT_TRANSLATION = "en.sahih"

# Some editions have english_name == 'Unknown' in the source DB. Give the
# documented ones a proper name; others fall back to their native `name`.
ENGLISH_NAME_OVERRIDES = {
    "id.indonesian": "Indonesian Ministry of Religious Affairs",
}

DIACRITICS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۜ"
                        r"۟-۪ۨ-ۭـ]")
ARABIC_LETTER = re.compile(r"[ء-يٮ-ٯٱ-ۓ"
                           r"ۺ-ۿ]")


# Basmala is baked into the start of ayah 1 for every surah except At-Tawbah (9).
# For Al-Fatiha (1) it IS verse 1 and must stay; everywhere else (surahs 2-114,
# except 9) we strip the leading basmala so the ayah text, word/letter counts,
# and totals reflect only the ayah's own content. The basmala line is rendered
# above verse 1 in the app from a constant. Match on the diacritic-stripped
# prefix so Uthmani harakat / alef-wasla variants don't matter.
BASMALA_BARE = "بسم الله الرحمن الرحيم"
# Tajweed markup tag pattern. MIRRORS the `TAG` regex in
# src/data/tajweed.ts — keep them in sync if the edition's markup format changes.
TAJWEED_TAG = re.compile(r"\[[a-z]+(?::\d+)?\[|\]")

# Buckwalter -> Arabic, used to render Quranic-Corpus roots (e.g. "ktb" -> "كتب").
BW2AR = {
    "'": "ء", "|": "آ", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ", "A": "ا",
    "b": "ب", "p": "ة", "t": "ت", "v": "ث", "j": "ج", "H": "ح", "x": "خ",
    "d": "د", "*": "ذ", "r": "ر", "z": "ز", "s": "س", "$": "ش", "S": "ص",
    "D": "ض", "T": "ط", "Z": "ظ", "E": "ع", "g": "غ", "f": "ف", "q": "ق",
    "k": "ك", "l": "ل", "m": "م", "n": "ن", "h": "ه", "w": "و", "Y": "ى",
    "y": "ي",
}

# Quranic-Corpus part-of-speech tag -> readable label (long tail kept as-is).
POS_LABEL = {
    "N": "Noun", "PN": "Proper noun", "V": "Verb", "ADJ": "Adjective",
    "P": "Preposition", "DET": "Determiner", "PRON": "Pronoun",
    "REL": "Relative pronoun", "DEM": "Demonstrative", "CONJ": "Conjunction",
    "SUB": "Subordinating conj.", "ACC": "Accusative particle",
    "NEG": "Negative particle", "COND": "Conditional particle",
    "INTG": "Interrogative", "T": "Time adverb", "LOC": "Location adverb",
    "PRP": "Purpose particle", "CERT": "Certainty particle",
    "PRO": "Prohibition particle", "EMPH": "Emphatic particle",
    "VOC": "Vocative particle", "INL": "Quranic initials", "COM": "Comitative",
    "RES": "Restriction particle", "EXP": "Exceptive particle",
    "ANS": "Answer particle", "REM": "Resumption particle",
    "CIRC": "Circumstantial", "SUP": "Supplemental", "FUT": "Future particle",
    "IMPV": "Imperative", "AMD": "Amendment particle", "INC": "Inceptive",
    "EQ": "Equalization", "RET": "Retraction", "AVR": "Aversion",
}


def bw_to_arabic(bw: str) -> str:
    return "".join(BW2AR.get(c, c) for c in bw)


def _bare(text: str) -> str:
    """Strip tajweed markup, diacritics + tatweel, normalise alef for matching."""
    t = DIACRITICS.sub("", TAJWEED_TAG.sub("", text))
    return t.replace("ٱ", "ا").replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")


def dagger_alif(text: str) -> str:
    """The `quran-tajweed` and `quran-wordbyword` editions write the superscript
    (dagger) alif as U+0672 ALEF WITH WAVY HAMZA ABOVE in 1,561 places, e.g.
    ذَٲلِكَ for ذَٰلِكَ; every one sits where the Uthmani text (and QUL) has
    U+0670. Fonts draw it as an alif with a hamza, so map it back."""
    return text.replace("\u0672", "\u0670")


TANWIN = "\u064b\u064c\u064d"
SMALL_MEEM = "\u06e2\u06ed"  # small high / small low meem
SMALL_YEH, SMALL_HIGH_YEH, TATWEEL = "\u06e6", "\u06e7", "\u0640"
LETTER_CHAR = re.compile(r"[\u0621-\u064a\u066e\u066f\u0671-\u06d3]")
# Letters with no left-joining form: nothing after them connects to them.
NON_JOINING = set("ءاأإآٱدذرزوؤةى")


def fix_uthmani_marks(text: str, following: str = "") -> str:
    """Two display fixes for the Tanzil-style Uthmani text (`ar`, and QUL's
    copy of it behind wordbyword-id.json). `following` is the next ayah's text,
    for a tanwin that ends this one.

    - Tanwin + small meem (ۢ/ۭ) is that encoding's way of writing the staggered
      (idgham/ikhfa) tanwin, which only special fonts draw as such; every font
      the app offers draws a small meem, which in the Madinah and Indonesian
      mushafs means iqlab. Keep the meem only before ب (real iqlab).
      Nun + small meem (مِنۢ بَعْدِ) is always iqlab and is left alone.
    - A small yeh (ۦ) inside a word (إِبْرَٰهِۦمَ) is a spacing character that
      breaks the joining, so after a joining letter write it as tatweel + small
      high yeh (ـۧ), as the tajweed edition does."""
    full = text + " " + following
    out = []
    for i, c in enumerate(text):
        if c in SMALL_MEEM and i and text[i - 1] in TANWIN:
            nxt = LETTER_CHAR.search(full, i + 1)
            if not nxt or nxt.group() != "ب":
                continue
        elif c == SMALL_YEH:
            j = i + 1
            while j < len(text) and not text[j].isspace() and not LETTER_CHAR.match(text[j]):
                j += 1
            k = i - 1
            while k >= 0 and not LETTER_CHAR.match(text[k]):
                k -= 1
            if (j < len(text) and LETTER_CHAR.match(text[j])
                    and k >= 0 and text[k] not in NON_JOINING):
                out.append(TATWEEL + SMALL_HIGH_YEH)
                continue
        out.append(c)
    return "".join(out)


TAJWEED_OPEN = re.compile(r"\[([a-z]+)(?::(\d+))?\[")


def flatten_tajweed(text: str) -> str:
    """Flatten nested or rule-less tajweed markup into plain `[r[...]` runs.
    34 ayahs nest a tag inside another (`[o[ُوٓ[s[اْ]‌ۚ]`) or open a bracket with
    no rule (32:3 `[ٮٰ]`); the client regex stops at the first `]`, so their
    brackets showed as text. Each run takes its innermost rule; well-formed
    markup comes out unchanged."""
    out, stack, buf = [], [], []

    def flush():
        if not buf:
            return
        chunk = "".join(buf)
        buf.clear()
        tag = next((t for t in reversed(stack) if t), None)
        if tag:
            rule, num = tag
            out.append(f"[{rule}{':' + num if num else ''}[{chunk}]")
        else:
            out.append(chunk)

    i = 0
    while i < len(text):
        m = TAJWEED_OPEN.match(text, i)
        if m:
            flush()
            stack.append((m.group(1), m.group(2)))
            i = m.end()
            continue
        c = text[i]
        if c == "[":
            flush()
            stack.append(None)
        elif c == "]":
            flush()
            if stack:
                stack.pop()
        else:
            buf.append(c)
        i += 1
    flush()
    return "".join(out)


def strip_leading_basmala(text: str) -> str:
    """Remove a leading basmala from ayah-1 text, returning the remainder."""
    words = text.split()
    if len(words) > 4 and _bare(" ".join(words[:4])) == BASMALA_BARE:
        return " ".join(words[4:])
    return text


def count_words(text: str) -> int:
    return len([w for w in text.split() if w.strip()])


def count_letters(text: str) -> int:
    return len(ARABIC_LETTER.findall(DIACRITICS.sub("", text)))


def ensure_db() -> None:
    if DB.exists():
        return
    if DB_GZ.exists():
        print(f"Decompressing {DB_GZ.name} -> {DB.name} ...")
        with gzip.open(DB_GZ, "rb") as fi, open(DB, "wb") as fo:
            shutil.copyfileobj(fi, fo)
    else:
        sys.exit(f"ERROR: neither {DB} nor {DB_GZ} found.")


def parse_verse_mapping(mapping: str) -> list[tuple[int, int, int]]:
    """QUL `verse_mapping` JSON ({"2": "1-7", "3": "5"}) -> [(surah, from, to)]."""
    out = []
    for surah, rng in json.loads(mapping).items():
        lo, _, hi = rng.partition("-")
        out.append((int(surah), int(lo), int(hi or lo)))
    return out


def clean_footnotes(text: str) -> str:
    for pat in FOOTNOTE_RESIDUE:
        text = pat.sub("", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def group_tafsir(rows) -> dict[int, list[list]]:
    """Collapse QUL tafsir rows (surah, ayah, group_key, text) into passages:
    {surah: [[from_ayah, to_ayah, text], ...]}. QUL repeats a passage's text
    on every ayah of its group (group_key = "s:first_ayah"), so keep it once;
    passages with empty text are dropped."""
    groups: dict[tuple[int, str], list] = {}
    for surah, ayah, key, text in rows:
        g = groups.get((surah, key))
        if g is None:
            groups[(surah, key)] = [ayah, ayah, (text or "").strip()]
        else:
            g[0] = min(g[0], ayah)
            g[1] = max(g[1], ayah)
    out: dict[int, list[list]] = {}
    for (surah, _), g in groups.items():
        if g[2]:
            out.setdefault(surah, []).append(g)
    for passages in out.values():
        passages.sort(key=lambda g: g[0])
    return out


def pair_wbw(arabic: str, glosses: list[str]) -> list[list[str]]:
    """Pair an ayah's Arabic words with QUL word-by-word glosses. Pause marks
    are dropped; if the Arabic still has more tokens than glosses (37:130
    splits إِلْ يَاسِينَ), the surplus joins the last word."""
    if glosses and WBW_AYAH_END.match(glosses[-1].strip()):
        glosses = glosses[:-1]
    words = [w for w in arabic.split() if not PAUSE_MARK.match(w)]
    if len(words) > len(glosses) > 0:
        words = words[:len(glosses) - 1] + [" ".join(words[len(glosses) - 1:])]
    if len(words) != len(glosses):
        raise ValueError(f"{len(words)} words vs {len(glosses)} glosses")
    return [[w, g] for w, g in zip(words, glosses)]


def load_topic_names(path: Path) -> tuple[dict[int, str], dict[int, str], dict[int, str]]:
    """topic_names_id.tsv: QUL id <TAB> Indonesian [<TAB> English [<TAB> Arabic]];
    the English and Arabic columns override QUL's names and may be empty."""
    names_id: dict[int, str] = {}
    names_en: dict[int, str] = {}
    names_ar: dict[int, str] = {}
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip() or line.startswith("#"):
            continue
        cols = line.split("\t")
        if len(cols) not in (2, 3, 4) or not cols[0].isdigit() or not cols[1].strip():
            sys.exit(f"{path.name}:{n}: expected 'id<TAB>name[<TAB>English[<TAB>Arabic]]'")
        tid = int(cols[0])
        if tid in names_id:
            sys.exit(f"{path.name}:{n}: topic {tid} listed twice")
        names_id[tid] = cols[1]
        if len(cols) >= 3 and cols[2].strip():
            names_en[tid] = cols[2]
        if len(cols) == 4 and cols[3].strip():
            names_ar[tid] = cols[3]
    return names_id, names_en, names_ar


def build_topic_tree(qul: sqlite3.Connection) -> list[dict]:
    """QUL topics -> curated tree nodes with (surah, ayah) pairs in `v`."""
    tagged: dict = {}
    for tid, s, a in qul.execute("SELECT topic_id, surah, ayah FROM topic_ayahs"):
        tagged.setdefault(tid, set()).add((s, a))
    raw = [topics_mod.RawTopic(
        id=tid, name=name or "", ar=ar or "", desc=desc or "",
        parent=p or None, tparent=tp or None, oparent=op or None,
        thematic=bool(th), ontology=bool(on), ayahs=frozenset(tagged.get(tid, ())))
        for tid, name, ar, desc, p, tp, op, th, on in qul.execute(
            "SELECT topic_id, name, arabic_name, description, parent_id, "
            "thematic_parent_id, ontology_parent_id, thematic, ontology FROM topics")]
    tax = json.loads(TOPIC_TAXONOMY.read_text(encoding="utf-8"))
    names_id, names_en, names_ar = load_topic_names(TOPIC_NAMES)
    clusters = topics_mod.cluster_topics(raw, tax["merge"])
    try:
        topics_mod.split_clusters(clusters, tax.get("split", []))
        topics_mod.adjust_verses(clusters, tax.get("verses", {}))
        return topics_mod.build_tree(clusters, tax["tree"], names_id,
                                     tax["flatten"], names_en, names_ar)
    except topics_mod.TaxonomyError as e:
        sys.exit(f"topic taxonomy: {e}")


def export_reference_extras(key_to_id: dict, surah_type: dict) -> list[dict]:
    """Batch-2 exports from qul.db + hadith.db: section themes, topics,
    Indonesian word-by-word, surah introductions, verified asbab al-nuzul and
    the QUL Indonesian translations. Returns the extra edition entries."""
    if not HADITH_DB.exists():
        sys.exit(f"Missing {HADITH_DB} (needed for asbab al-nuzul). "
                 "Build it with reference/hadith/build_db.py.")
    qul = sqlite3.connect(f"file:{QUL_DB}?mode=ro", uri=True)
    aid = lambda s, a: key_to_id[(s, a)]  # noqa: E731

    # Section themes (English): [first ayah id, last ayah id, theme].
    # QUL lists every section twice; keep each (surah, range) once.
    rows = list(dict.fromkeys(qul.execute(
        "SELECT theme, surah, ayah_from, ayah_to FROM themes ORDER BY surah, ayah_from")))
    themes = [[aid(s, lo), aid(s, hi), t] for t, s, lo, hi in rows]
    write_json(OUT / "themes.json", themes)
    step(f"themes.json: {len(themes)} sections")
    # Indonesian headings: scripts/data/themes_id.json, keyed "surah:from-to"
    # (translated from QUL's English). Every section needs one.
    themes_id = json.loads(THEMES_ID.read_text(encoding="utf-8"))
    missing = [f"{s}:{lo}-{hi}" for _, s, lo, hi in rows
               if not themes_id.get(f"{s}:{lo}-{hi}", "").strip()]
    if missing:
        sys.exit(f"themes_id.json lacks {len(missing)} sections, e.g. {missing[:5]}")
    write_json(OUT / "themes-id.json",
               [[aid(s, lo), aid(s, hi), themes_id[f"{s}:{lo}-{hi}"]] for _, s, lo, hi in rows])
    step(f"themes-id.json: {len(rows)} sections")

    # Topics: QUL's duplicate-ridden topic list folded into the curated tree
    # (scripts/topics.py, scripts/data/topic_taxonomy.json + topic_names_id.tsv).
    nodes = build_topic_tree(qul)
    for n in nodes:
        if "v" in n:
            n["v"] = [aid(s, a) for s, a in n["v"]]
    write_json(OUT / "topics.json", nodes)
    step(f"topics.json: {len(nodes)} nodes, "
          f"{sum(1 for n in nodes if n['p'] == -1)} top categories")

    # Indonesian word-by-word, paired with QUL's own Arabic words (the gloss
    # boundaries follow QUL's text, not the `quran-wordbyword` edition).
    glosses: dict = {}
    for s, a, t in qul.execute(
            "SELECT surah, ayah, text FROM wbw WHERE edition='wbw-id' "
            "ORDER BY surah, ayah, word"):
        glosses.setdefault((s, a), []).append(t)
    wbw_id: list = [None] * (len(key_to_id) + 1)
    qverses = qul.execute("SELECT s, a, text FROM verses ORDER BY s, a").fetchall()
    for n, (s, a, text) in enumerate(qverses):
        nxt = qverses[n + 1] if n + 1 < len(qverses) else None
        text = fix_uthmani_marks(text, nxt[2] if nxt and nxt[0] == s else "")
        wbw_id[aid(s, a)] = pair_wbw(text, glosses[(s, a)])
    write_json(OUT / "wordbyword-id.json", wbw_id)
    step(f"wordbyword-id.json: {sum(1 for x in wbw_id if x)} ayahs")

    # Surah introductions (plain text, paragraphs separated by blank lines).
    for lang in ("en", "id"):
        info: list = [None] * 115
        for n, text in qul.execute(
                "SELECT surah, text FROM surah_info WHERE lang=?", (lang,)):
            info[n] = text.strip()
        write_json(OUT / f"surah-info-{lang}.json", info)
    step("surah-info-{en,id}.json: 114 surahs each")

    # QUL Indonesian translations -> extra editions.
    extra = []
    for qed, (ident, name, english) in QUL_TRANSLATIONS.items():
        arr: list = [None] * (len(key_to_id) + 1)
        for s, a, t in qul.execute(
                "SELECT surah, ayah, text FROM translations WHERE edition=?", (qed,)):
            arr[aid(s, a)] = clean_footnotes(t)
        write_json(TRANS_OUT / f"{ident}.json", arr)
        extra.append({"identifier": ident, "language": "id", "name": name,
                      "englishName": english, "type": "translation",
                      "count": sum(1 for x in arr if x)})
    step(f"translations/: {len(extra)} QUL Indonesian editions")

    # QUL Indonesian tafsirs -> tafsir/<ident>/<surah>.json passage lists.
    for qed, ident in QUL_TAFSIRS.items():
        by_surah = group_tafsir(qul.execute(
            "SELECT surah, ayah, group_key, text FROM tafsirs "
            "WHERE edition=? ORDER BY surah, ayah", (qed,)))
        if len(by_surah) != 114:
            sys.exit(f"{qed}: tafsir covers {len(by_surah)} surahs, expected 114")
        out_dir = OUT / "tafsir" / ident
        out_dir.mkdir(parents=True, exist_ok=True)
        for surah, passages in by_surah.items():
            write_json(out_dir / f"{surah}.json", passages)
        step(f"tafsir/{ident}/: {sum(map(len, by_surah.values()))} passages")
    qul.close()

    # Verified asbab al-nuzul (Arabic only): [first id, last id, [narrations]].
    # The source numbers al-ʿAlaq's last verse 20 (a non-Kufan count); clamp
    # ranges to the surah's last ayah in our (Kufan, 6236-ayah) numbering.
    last_ayah: dict = {}
    for s, a in key_to_id:
        last_ayah[s] = max(last_ayah.get(s, 0), a)
    hd = sqlite3.connect(f"file:{HADITH_DB}?mode=ro", uri=True)
    groups: dict = {}
    for s, lo, hi, text in hd.execute(
            "SELECT surah, ayah_from, ayah_to, text FROM asbab "
            "WHERE source='sahih-ar' ORDER BY surah, ayah_from, ayah_to, ord"):
        hi = min(hi, last_ayah[s])
        groups.setdefault((aid(s, lo), aid(s, hi)), []).append(text.strip())
    hd.close()
    write_json(OUT / "asbab.json", {
        "source": "Ibrahim Muhammad al-Ali, Sahih Asbab al-Nuzul "
                  "(صحيح أسباب النزول), via asbab-al-nuzul-dataset (MIT)",
        "items": [[lo, hi, texts] for (lo, hi), texts in groups.items()],
    })
    step(f"asbab.json: {len(groups)} ayah ranges")

    asbab_ids = {i for lo, hi in groups for i in range(lo, hi + 1)}
    chrono = json.loads(CHRONOLOGY.read_text(encoding="utf-8"))
    check_chronology(chrono, surah_type, key_to_id, asbab_ids)
    write_json(OUT / "chronology.json",
               {"periods": chrono["periods"], "surahs": chrono["surahs"]})
    step(f"chronology.json: {len(chrono['periods'])} periods, "
          f"{len(chrono['surahs'])} surahs")
    return extra


def parse_ref(ref: str) -> tuple[int, int, int]:
    """'2:142' -> (2, 142, 142); '24:11-23' -> (24, 11, 23)."""
    s, ayahs = ref.split(":")
    lo, _, hi = ayahs.partition("-")
    return int(s), int(lo), int(hi or lo)


def check_chronology(data: dict, surah_type: dict, key_to_id: dict,
                     asbab_ids: set) -> None:
    """Validate scripts/data/surah_chronology.json: every surah exactly once,
    known periods and events, phase matching the surah's Makki/Madani header
    (unless a typeNote explains why), and refs that exist, all covered by a
    verified asbab narration when basis is 'asbab'."""
    def fail(msg: str):
        sys.exit(f"surah_chronology: {msg}")
    periods = {p["id"]: p for p in data["periods"]}
    if len(periods) != len(data["periods"]):
        fail("duplicate period id")
    for p in data["periods"]:
        if p["phase"] not in ("Meccan", "Medinan"):
            fail(f"period {p['id']}: bad phase {p['phase']!r}")
    surahs = data["surahs"]
    if sorted(int(k) for k in surahs) != list(range(1, 115)):
        fail("surahs must list 1..114 exactly once")
    for k, e in surahs.items():
        s = int(k)
        p = periods.get(e["period"])
        if p is None:
            fail(f"surah {s}: unknown period {e['period']!r}")
        if "event" in e and not 0 <= e["event"] < len(p["events"]):
            fail(f"surah {s}: event {e['event']} out of range for {p['id']}")
        if e["basis"] not in CHRONO_BASES:
            fail(f"surah {s}: bad basis {e['basis']!r}")
        if p["phase"] != surah_type[s] and not e.get("typeNote"):
            fail(f"surah {s} is {surah_type[s]} but {p['id']} is {p['phase']}")
        if "span" in e:
            a, b = e["span"]
            if not (p["phase"] == "Medinan" and 1 <= a < b <= 11):
                fail(f"surah {s}: bad span {e['span']}")
        for ref in e.get("refs", []):
            rs, lo, hi = parse_ref(ref)
            ids = [key_to_id.get((rs, a)) for a in range(lo, hi + 1)]
            if rs != s or lo > hi or None in ids:
                fail(f"surah {s}: bad ref {ref!r}")
            if e["basis"] == "asbab" and not all(i in asbab_ids for i in ids):
                fail(f"surah {s}: ref {ref} has no verified asbab")
        if e["basis"] == "asbab" and not e.get("refs"):
            fail(f"surah {s}: basis 'asbab' needs refs")


def load_place_exceptions(key_to_id: dict, surah_type: dict) -> dict[int, str]:
    """Ayah id -> revelation place for ayahs whose place differs from their
    surah's classification (see scripts/data/ayah_place_exceptions.json)."""
    data = json.loads(PLACE_EXCEPTIONS.read_text(encoding="utf-8"))
    out = {}
    for s, a, place in data["items"]:
        if place not in PLACES:
            sys.exit(f"ayah_place_exceptions: bad place {place!r} at {s}:{a}")
        if (s, a) not in key_to_id:
            sys.exit(f"ayah_place_exceptions: no ayah {s}:{a}")
        if place == surah_type[s]:
            sys.exit(f"ayah_place_exceptions: {s}:{a} is already {place}")
        out[key_to_id[(s, a)]] = place
    return out


def check_revelation_order(order: dict[int, int]) -> None:
    """Every surah 1..114 needs a distinct revelation rank 1..114."""
    if sorted(order) != list(range(1, 115)) or sorted(order.values()) != list(range(1, 115)):
        sys.exit("qul.db chapters.revelation_order is not a permutation of 1..114")


def load_qul(key_to_id: dict) -> dict:
    """Ruku'/manzil per ayah id + deduplicated similar-ayah pairs from qul.db."""
    if not QUL_DB.exists():
        sys.exit(f"Missing {QUL_DB} (needed for ruku', manzil and similar ayahs). "
                 "Build it with reference/qul/build_db.py.")
    qul = sqlite3.connect(f"file:{QUL_DB}?mode=ro", uri=True)
    divisions = {}
    for table, col in (("meta_ruku", "ruku_number"), ("meta_manzil", "manzil_number")):
        of = {}
        for n, mapping in qul.execute(f"SELECT {col}, verse_mapping FROM {table}"):
            for surah, lo, hi in parse_verse_mapping(mapping):
                for a in range(lo, hi + 1):
                    of[key_to_id[(surah, a)]] = n
        divisions[table] = of
    # `similar` is directional (A->B and B->A are separate rows, with
    # different coverage). Keep one undirected pair with the higher score.
    best: dict = {}
    for vk, mk, words, score in qul.execute(
        "SELECT verse_key, matched_ayah_key, matched_words_count, score FROM similar"
    ):
        a = key_to_id[tuple(map(int, vk.split(":")))]
        b = key_to_id[tuple(map(int, mk.split(":")))]
        if a == b:
            continue
        k = (min(a, b), max(a, b))
        if k not in best or score > best[k][0]:
            best[k] = (score, words)
    revelation = dict(qul.execute("SELECT surah, revelation_order FROM chapters"))
    check_revelation_order(revelation)
    qul.close()
    pairs = sorted([a, b, sc, w] for (a, b), (sc, w) in best.items())
    return {"ruku": divisions["meta_ruku"], "manzil": divisions["meta_manzil"],
            "similar": pairs, "revelation": revelation}


def main() -> None:
    ensure_db()
    OUT.mkdir(parents=True, exist_ok=True)
    TRANS_OUT.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row

    # Map each ayah id -> hizb number (1-60) using the authoritative hizbs
    # table ranges. NB: ayahs.hizb_id is actually the rub' (quarter, 1-240)
    # index and does NOT divide evenly into the 60 hizbs, so we map by range.
    hizb_of = {}
    for h in db.execute(
        "SELECT hizb_number, start_ayah_id, end_ayah_id FROM hizbs"
    ):
        for aid in range(h["start_ayah_id"], h["end_ayah_id"] + 1):
            hizb_of[aid] = h["hizb_number"]

    # --- verses (core, always loaded) ---
    ayahs = db.execute(
        "SELECT id, text, number_in_surah, page, surah_id, hizb_id, juz_id, sajda "
        "FROM ayahs ORDER BY id"
    ).fetchall()
    key_to_id = {(r["surah_id"], r["number_in_surah"]): r["id"] for r in ayahs}
    qul = load_qul(key_to_id)
    surah_type = {r["id"]: r["type"] for r in db.execute("SELECT id, type FROM surahs")}
    place_of = load_place_exceptions(key_to_id, surah_type)
    verses = []
    # per-surah aggregates
    agg = {}
    # Surahs whose ayah 1 carried a leading basmala we stripped (i.e. the app
    # should render a basmala line above verse 1). Al-Fatiha (1) keeps it as
    # verse 1 and At-Tawbah (9) has none, so neither ends up here.
    has_basmala = set()
    texts = []
    for r in ayahs:
        text = r["text"]
        if r["number_in_surah"] == 1 and r["surah_id"] not in (1, 9):
            stripped = strip_leading_basmala(text)
            if stripped != text:
                text = stripped
                has_basmala.add(r["surah_id"])
        texts.append(text)
    for n, r in enumerate(ayahs):
        last = n + 1 == len(ayahs) or ayahs[n + 1]["surah_id"] != r["surah_id"]
        text = fix_uthmani_marks(texts[n], "" if last else texts[n + 1])
        w, l = count_words(text), count_letters(text)
        verses.append({
            "id": r["id"], "s": r["surah_id"], "a": r["number_in_surah"],
            "juz": r["juz_id"], "hizb": hizb_of.get(r["id"], 0),
            "rub": r["hizb_id"], "ruku": qul["ruku"][r["id"]],
            "manzil": qul["manzil"][r["id"]], "page": r["page"],
            "sajda": r["sajda"], "w": w, "l": l, "ar": text,
        })
        if r["id"] in place_of:
            verses[-1]["p"] = place_of[r["id"]]
        a = agg.setdefault(r["surah_id"], {
            "ayahCount": 0, "wordCount": 0, "letterCount": 0, "sajdaCount": 0,
            "pages": set(), "juzs": set(),
        })
        a["ayahCount"] += 1
        a["wordCount"] += w
        a["letterCount"] += l
        a["sajdaCount"] += r["sajda"]
        a["pages"].add(r["page"])
        a["juzs"].add(r["juz_id"])
    write_json(OUT / "verses.json", verses)
    step(f"verses.json: {len(verses)} verses")

    # Array length for ayah-id-indexed files (1-indexed, position 0 unused).
    # Computed from the DB rather than hardcoded so it tracks any upstream change.
    max_ayah_id = db.execute("SELECT MAX(id) FROM ayahs").fetchone()[0]
    ARR_LEN = max_ayah_id + 1

    # --- surahs ---
    surah_rows = db.execute(
        "SELECT id, number, name_ar, name_en, name_en_translation, type "
        "FROM surahs ORDER BY id"
    ).fetchall()
    surahs = []
    for r in surah_rows:
        a = agg[r["id"]]
        surahs.append({
            "id": r["id"], "number": r["number"],
            "nameAr": r["name_ar"], "nameEn": r["name_en"],
            "meaning": r["name_en_translation"], "type": r["type"],
            "ayahCount": a["ayahCount"], "wordCount": a["wordCount"],
            "letterCount": a["letterCount"], "sajdaCount": a["sajdaCount"],
            "firstPage": min(a["pages"]), "lastPage": max(a["pages"]),
            "firstJuz": min(a["juzs"]), "lastJuz": max(a["juzs"]),
            "hasBismillah": r["id"] in has_basmala,
            "revelationOrder": qul["revelation"][r["id"]],
            "exceptions": sum(1 for v in verses if v["s"] == r["id"] and "p" in v),
        })
    write_json(OUT / "surahs.json", surahs)
    step(f"surahs.json: {len(surahs)} surahs")

    # --- editions index (exported text editions only, no audio) ---
    edition_rows = db.execute(
        "SELECT id, identifier, language, name, english_name, type "
        "FROM editions WHERE type IN (?,?,?) ORDER BY language, type, identifier",
        EXPORT_TYPES,
    ).fetchall()
    editions = []
    # identifier -> editions.id, reused below to avoid an N+1 lookup per file.
    edition_db_ids: dict[str, int] = {}
    for r in edition_rows:
        # confirm this edition has non-audio text rows before exporting
        n = db.execute(
            "SELECT COUNT(*) FROM ayah_edition WHERE edition_id=? AND is_audio=0",
            (r["id"],),
        ).fetchone()[0]
        if n == 0:
            continue
        english_name = r["english_name"]
        if english_name == "Unknown" or not english_name:
            english_name = ENGLISH_NAME_OVERRIDES.get(r["identifier"], r["name"])
        edition_db_ids[r["identifier"]] = r["id"]
        editions.append({
            "identifier": r["identifier"], "language": r["language"],
            "name": r["name"], "englishName": english_name,
            "type": r["type"], "count": n,
        })
    # QUL Indonesian translations join the index after the DB's own `id` ones;
    # their files are written by export_reference_extras.
    extra_editions = export_reference_extras(key_to_id, surah_type)
    last_id = max((i for i, e in enumerate(editions) if e["language"] == "id"),
                  default=len(editions) - 1)
    editions[last_id + 1:last_id + 1] = extra_editions
    write_json(OUT / "editions.json", {
        "default": DEFAULT_TRANSLATION, "editions": editions,
    })
    step(f"editions.json: {len(editions)} editions")

    # --- per-edition translation files (ayah-id indexed, position 0 unused) ---
    for e in editions:
        ident = e["identifier"]
        if ident not in edition_db_ids:
            continue  # a QUL edition, already written
        eid = edition_db_ids[ident]
        rows = db.execute(
            "SELECT ayah_id, data FROM ayah_edition "
            "WHERE edition_id=? AND is_audio=0 ORDER BY ayah_id", (eid,),
        ).fetchall()
        arr = [None] * ARR_LEN  # 1-indexed by ayah id
        for ar in rows:
            arr[ar["ayah_id"]] = ar["data"]
        write_json(TRANS_OUT / f"{ident}.json", arr)
    step(f"translations/: {len(editions)} files")

    # --- tajweed (pre-annotated Arabic, lazy-loaded for the reader overlay) ---
    # The `quran-tajweed` edition is type='quran' (outside EXPORT_TYPES) and
    # carries rule markup like "بِسْمِ [h:1[ٱ]للَّهِ". We strip its leading
    # basmala on ayah 1 (same surahs as above) so it lines up with the plain
    # Arabic, and parse the tags client-side.
    taj = db.execute(
        "SELECT id FROM editions WHERE identifier='quran-tajweed'"
    ).fetchone()
    if taj:
        rows = db.execute(
            "SELECT a.surah_id, a.number_in_surah, ae.ayah_id, ae.data "
            "FROM ayah_edition ae JOIN ayahs a ON a.id=ae.ayah_id "
            "WHERE ae.edition_id=? AND ae.is_audio=0 ORDER BY ae.ayah_id",
            (taj[0],),
        ).fetchall()
        tarr = [None] * ARR_LEN
        for r in rows:
            data = flatten_tajweed(dagger_alif(r["data"]))
            if r["number_in_surah"] == 1 and r["surah_id"] not in (1, 9):
                data = strip_leading_basmala(data)
            tarr[r["ayah_id"]] = data
        write_json(OUT / "tajweed.json", tarr)
        step(f"tajweed.json: {sum(1 for x in tarr if x)} ayahs")

    # --- word-by-word (lazy-loaded for the reader overlay) ---
    # `quran-wordbyword` stores each word as "arabic|gloss|n|n|idx" joined by '$'
    # per ayah. We keep [arabic, gloss] pairs. Unlike `ayahs.text`, this edition
    # already excludes the basmala from ayah 1 (e.g. 2:1 is just "الٓمٓ"), so it
    # lines up with our stripped plain text with no extra handling.
    wbw = db.execute(
        "SELECT id FROM editions WHERE identifier='quran-wordbyword'"
    ).fetchone()
    if wbw:
        rows = db.execute(
            "SELECT ae.ayah_id, ae.data "
            "FROM ayah_edition ae "
            "WHERE ae.edition_id=? AND ae.is_audio=0 ORDER BY ae.ayah_id",
            (wbw[0],),
        ).fetchall()
        warr = [None] * ARR_LEN
        for r in rows:
            words = []
            for tok in r["data"].split("$"):
                if not tok.strip():
                    continue
                parts = tok.split("|")
                if len(parts) >= 2:
                    words.append([dagger_alif(parts[0]), parts[1]])
            warr[r["ayah_id"]] = words
        write_json(OUT / "wordbyword.json", warr)
        step(f"wordbyword.json: {sum(1 for x in warr if x)} ayahs")

    # --- morphology aggregate (from the Quranic Arabic Corpus edition) ---
    # `quran-corpus-qd` tags each segment "translit⚓gloss⚓POS|...|ROOT:xxx|..."
    # joined by '★'. We aggregate global root frequency + POS distribution into
    # one small file (we don't ship the per-word corpus). Roots are Buckwalter,
    # converted to Arabic for display.
    corpus = db.execute(
        "SELECT id FROM editions WHERE identifier='quran-corpus-qd'"
    ).fetchone()
    if corpus:
        from collections import Counter
        # Like the word-by-word edition, the corpus already excludes the basmala
        # from ayah 1 (e.g. 2:1 is just the initials), so no stripping is needed.
        rows = db.execute(
            "SELECT ae.ayah_id, ae.data FROM ayah_edition ae "
            "WHERE ae.edition_id=? AND ae.is_audio=0 ORDER BY ae.ayah_id",
            (corpus[0],),
        ).fetchall()
        roots: Counter = Counter()
        pos: Counter = Counter()
        root_gloss: dict = {}
        root_ayahs: dict = {}  # root -> ayah id per occurrence (repeats kept)
        total = 0
        for r in rows:
            for seg in r["data"].split("★"):
                fields = seg.split("⚓")
                if len(fields) < 3:
                    continue
                tags = fields[2].strip()
                if not tags:
                    continue
                total += 1
                parts = tags.split("|")
                p = parts[0].strip()
                if p:
                    pos[p] += 1
                for t in parts:
                    if t.startswith("ROOT:"):
                        root = t[5:].strip()
                        if root:
                            roots[root] += 1
                            root_ayahs.setdefault(root, []).append(r["ayah_id"])
                            gloss = fields[1].strip()
                            if root not in root_gloss and gloss:
                                root_gloss[root] = gloss
                        break
        top_roots = [
            {"ar": bw_to_arabic(bw), "bw": bw, "gloss": root_gloss.get(bw, ""),
             "count": c}
            for bw, c in roots.most_common(60)
        ]
        pos_out = [
            {"tag": t, "label": POS_LABEL.get(t, t), "count": c}
            for t, c in pos.most_common()
        ]
        write_json(OUT / "morphology.json", {
            "totalSegments": total,
            "distinctRoots": len(roots),
            "roots": top_roots,
            "pos": pos_out,
        })
        step(f"morphology.json: {len(roots)} roots, {len(pos)} POS tags, "
              f"{total} segments")
        # Every root with the ayah id of each occurrence, for the root explorer
        # (lazy-loaded). Per-surah counts are derived client-side.
        write_json(OUT / "roots.json", [
            {"ar": bw_to_arabic(bw), "bw": bw, "gloss": root_gloss.get(bw, ""),
             "v": root_ayahs[bw]}
            for bw, _ in roots.most_common()
        ])
        step(f"roots.json: {len(roots)} roots, "
              f"{sum(len(v) for v in root_ayahs.values())} occurrences")

    # --- similar ayahs (QUL similar-ayah/74): undirected [a, b, score, words] ---
    write_json(OUT / "similar.json", {
        "source": "Quranic Universal Library (QUL), similar-ayah resource 74",
        "pairs": qul["similar"],
    })
    step(f"similar.json: {len(qul['similar'])} pairs")

    # --- meta (juz/hizb ranges, pages, classification, provenance) ---
    juzs = [dict(r) for r in db.execute(
        "SELECT juz_number AS n, name_ar AS nameAr, start_ayah_id AS start, "
        "end_ayah_id AS end FROM juzs ORDER BY juz_number")]
    hizbs = [dict(r) for r in db.execute(
        "SELECT hizb_number AS n, juz_id AS juz, name_ar AS nameAr, "
        "start_ayah_id AS start, end_ayah_id AS end FROM hizbs ORDER BY hizb_number")]
    classification = {r["type"]: r["c"] for r in db.execute(
        "SELECT s.type AS type, COUNT(a.id) AS c FROM ayahs a "
        "JOIN surahs s ON s.id=a.surah_id GROUP BY s.type")}
    meta = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "quran-database-main (quran.db)",
        "totals": {
            "surahs": len(surahs), "ayahs": len(verses),
            "pages": max(v["page"] for v in verses),
            "juzs": len(juzs), "hizbs": len(hizbs),
            "rukus": max(v["ruku"] for v in verses),
            "manzils": max(v["manzil"] for v in verses),
            "sajdas": sum(v["sajda"] for v in verses),
            "words": sum(v["w"] for v in verses),
            "letters": sum(v["l"] for v in verses),
        },
        "classification": classification,
        # Ayah-level split using the per-ayah place exceptions (Hijra counted
        # separately); "classification" stays the surah-level count.
        "classificationByAyah": {
            p: sum(1 for v in verses if v.get("p", surah_type[v["s"]]) == p)
            for p in PLACES
        },
        "juzs": juzs, "hizbs": hizbs,
        "countMethod": "words=whitespace split; letters=Arabic letters after "
                       "stripping diacritics",
    }
    write_json(OUT / "meta.json", meta)
    step(f"meta.json: {meta['totals']}")

    # --- sanity checks: fail loudly if the source DB drifted unexpectedly ---
    assert len(verses) == max_ayah_id, (
        f"verse count {len(verses)} != max ayah id {max_ayah_id}"
    )
    assert len(verses) == 6236, f"expected 6236 ayahs, got {len(verses)}"
    assert len(surahs) == 114, f"expected 114 surahs, got {len(surahs)}"
    assert meta["totals"]["rukus"] == 558 and meta["totals"]["manzils"] == 7, (
        f"ruku'/manzil drift: {meta['totals']}"
    )
    # Al-Fatiha 1:1 must be 4 words / 19 letters (the documented basmala).
    fatiha1 = next(v for v in verses if v["s"] == 1 and v["a"] == 1)
    assert fatiha1["w"] == 4 and fatiha1["l"] == 19, (
        f"Al-Fatiha 1:1 count drift: {fatiha1['w']}w / {fatiha1['l']}l"
    )
    # No holes in the sparse translation arrays (every ayah id populated).
    if editions:
        first_ident = editions[0]["identifier"]
        first_arr = json.loads((TRANS_OUT / f"{first_ident}.json").read_text())
        assert all(first_arr[i] is not None for i in range(1, max_ayah_id + 1)), (
            f"{first_ident}.json has holes in the ayah-id range"
        )

    db.close()
    print("Done.")


# Progress lines for the background-task band: "n/total · (pct%) · what · eta m:ss".
ETL_STEPS = 19  # step() calls in a full run (tajweed/wordbyword/morphology count)
_etl_start = datetime.now(timezone.utc)
_etl_done = 0


def step(message: str) -> None:
    """Report one finished output, with the share done and a time estimate."""
    global _etl_done
    _etl_done = min(_etl_done + 1, ETL_STEPS)
    spent = (datetime.now(timezone.utc) - _etl_start).total_seconds()
    left = round(spent / _etl_done * (ETL_STEPS - _etl_done))
    print(f"{_etl_done}/{ETL_STEPS} · ({_etl_done / ETL_STEPS:.0%}) · {message} · "
          f"eta {left // 60}:{left % 60:02d}", flush=True)


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8")


if __name__ == "__main__":
    main()
