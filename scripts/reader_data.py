"""Reader data built from the snapshots of scripts/fetch_reader_data.py.

Called by build_data.py once verses.json and translations/ are written:

  translations/id.transliteration.json  Indonesian transliteration (equran.id)
  footnotes/<edition>.json              {ayah id: [[offset, note], ...]}, the
                                        offset into the app's own text of
                                        that edition (where the marker goes)
  mushaf/<layout>.json                  {pages, lines, page: [[line, ...]]},
                                        a line being [ayah id, first word]
                                        (1-based, words as `split_words`),
                                        ["s", surah] (surah name), ["sb",
                                        surah] (name and basmala on one
                                        line), ["b"] (basmala) or [] (blank)
  timings/<reciter>/<surah>.json        per ayah, flat [wordFrom, wordTo,
                                        startMs, endMs, ...] (0-based words,
                                        wordTo exclusive)
  words/<surah>.json                    per ayah, per app word: [translit,
                                        English, Indonesian, tags, lemma,
                                        root] (tags = the corpus POS and
                                        features, "N|M|GEN"; lemma and root
                                        1-based into lexicon.json, 0 = none)
  lexicon.json                          {roots: [[ar, bw, count]], lemmas:
                                        [[ar, root, count, en, id]]}
  lexicon-occ.json                      per lemma (index 0 unused): flat
                                        [ayah id, word (0-based), ...]
"""

from __future__ import annotations

import difflib
import gzip
import html
import json
import re
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"

# Tokens that are only pause marks or signs: they belong to a word, not
# words of their own (quran.com and quran-align count the same way).
MARK_TOKEN = re.compile(r"^[؀-؅ؕ-ؚۖ-ۭ]+$")
# quran.com writes these as two words where the app's text has one.
JOINED = {"بعدما": 2}
_DIAC = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")


def load_gz(path: Path):
    return json.loads(gzip.decompress(path.read_bytes()).decode("utf-8"))


def split_words(ar: str) -> list[str]:
    """The ayah's words: pause marks join the word before, a leading sign
    (۞) the word after. MIRRORS src/data/mushafLayout.ts:splitWords."""
    words: list[str] = []
    lead = ""
    for tok in ar.split():
        if MARK_TOKEN.match(tok):
            if words:
                words[-1] += " " + tok
            else:
                lead += tok + " "
        else:
            words.append(lead + tok)
            lead = ""
    return words


def qc_word_map(ar: str) -> list[int]:
    """quran.com word position (1-based, index 0 unused) → the app's word."""
    out = [0]
    for i, w in enumerate(split_words(ar), 1):
        main = next(t for t in w.split() if not MARK_TOKEN.match(t))
        out += [i] * JOINED.get(_DIAC.sub("", main), 1)
    return out


def export_translit(out: Path, write_json) -> int:
    texts = load_gz(DATA / "translit" / "id.json.gz")
    write_json(out / "translations" / "id.transliteration.json", [None, *texts])
    return len(texts)


_SUP = re.compile(r"<sup foot_note=\"?(\d+)\"?>\s*\d+\s*</sup>")


def _note_text(raw: str) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", "", raw))
    return re.sub(r"\s+", " ", text).strip().lstrip("*").strip()


def place_notes(theirs: str, ours: str) -> tuple[list[tuple[int, str]], bool]:
    """Marker offsets of `theirs` (quran.com text with <sup> markers) moved
    onto `ours`. Returns the offsets with note ids, and whether the texts
    matched exactly once the markers were removed."""
    plain = ""
    marks: list[tuple[int, str]] = []
    at = 0
    for m in _SUP.finditer(theirs):
        plain += theirs[at:m.start()]
        marks.append((len(plain), m.group(1)))
        at = m.end()
    plain += theirs[at:]
    plain = html.unescape(re.sub(r"<[^>]+>", "", plain))
    if plain.strip() == ours.strip():
        lead = len(plain) - len(plain.lstrip())
        return [(min(len(ours), max(0, o - lead)), n) for o, n in marks], True
    sm = difflib.SequenceMatcher(None, plain, ours, autojunk=False)
    blocks = sm.get_matching_blocks()

    def move(o: int) -> int:
        best = len(ours)
        for a, b, size in blocks:
            if a <= o <= a + size:
                return b + (o - a)
            if a > o:
                return b
        return best

    return [(move(o), n) for o, n in marks], False


def export_footnotes(out: Path, write_json, editions: list[str]) -> dict[str, tuple[int, int]]:
    stats: dict[str, tuple[int, int]] = {}
    (out / "footnotes").mkdir(parents=True, exist_ok=True)
    for ed in editions:
        snap = load_gz(DATA / "footnotes" / f"{ed}.json.gz")
        ours = json.loads((out / "translations" / f"{ed}.json").read_text(encoding="utf-8"))
        notes: dict[str, list] = {}
        exact = 0
        for i, row in enumerate(snap, 1):
            if not row or not ours[i]:
                continue
            placed, same = place_notes(row["t"], ours[i])
            exact += same
            got = []
            for off, nid in placed:
                text = _note_text(row["n"].get(nid, ""))
                if text:
                    # Never inside a word: move to the end of it.
                    while off < len(ours[i]) and ours[i][off].isalnum():
                        off += 1
                    got.append([off, text])
            if got:
                notes[str(i)] = sorted(got, key=lambda x: x[0])
        write_json(out / "footnotes" / f"{ed}.json", notes)
        stats[ed] = (sum(len(v) for v in notes.values()), exact)
    return stats


def build_layout(snap: dict, verses: list[dict], basmala: set[int]) -> dict:
    """Pages of line entries from the snapshot's line starts. Empty lines
    before a surah's first ayah (across a page break too) are its name and,
    when it has one, its basmala; other empty lines are blank."""
    pages, lines = snap["pages"], snap["lines"]
    key_to_id = {(v["s"], v["a"]): v["id"] for v in verses}
    maps: dict[int, list[int]] = {}

    def word(s: int, a: int, qc: int) -> int:
        vid = key_to_id[(s, a)]
        if vid not in maps:
            maps[vid] = qc_word_map(verses[vid - 1]["ar"])
        m = maps[vid]
        return m[min(qc, len(m) - 1)]

    starts = {(p, ln): (s, a, w) for p, ln, s, a, w in snap["starts"]}
    stream: list[list] = []  # [page, entry or None]
    for p in range(1, pages + 1):
        for ln in range(1, lines + 1):
            st = starts.get((p, ln))
            stream.append([p, [key_to_id[st[:2]], word(*st)] if st else None])
    # A surah whose first ayah starts mid-line (Al-Hijr in IndoPak 15): the
    # line is split so the surah starts a line of its own.
    begun = {tuple(e) for _, e in stream if e}
    for v in verses:
        if v["a"] != 1 or v["s"] == 1 or (v["id"], 1) in begun:
            continue
        before = max(
            (i for i, (_, e) in enumerate(stream) if e and tuple(e) < (v["id"], 1)),
            default=None,
        )
        if before is not None:
            stream.insert(before + 1, [stream[before][0], [v["id"], 1]])
    # Name and basmala lines: walk back from each surah start. Two empty
    # lines: name, basmala. One: the name, with the basmala on the same line
    # when the surah has one (["sb", surah], as IndoPak prints do). None (a
    # few IndoPak pages): a name line is added before the first ayah.
    inserts: dict[int, list] = {}
    for i, (_, e) in enumerate(stream):
        if not e or isinstance(e[0], str):
            continue
        v = verses[e[0] - 1]
        if v["a"] != 1 or e[1] != 1:
            continue
        has_b = v["s"] in basmala
        gap = 0
        while i - gap - 1 >= 0 and stream[i - gap - 1][1] is None:
            gap += 1
        if gap >= 2 and has_b:
            stream[i - 1][1] = ["b"]
            stream[i - 2][1] = ["s", v["s"]]
        elif gap >= 1:
            stream[i - 1][1] = ["sb" if has_b else "s", v["s"]]
        else:
            inserts[i] = ["sb" if has_b else "s", v["s"]]
    stream = [
        x
        for i, row in enumerate(stream)
        for x in ([[row[0], inserts[i]], row] if i in inserts else [row])
    ]
    out_pages: list[list] = [[] for _ in range(pages)]
    for p, e in stream:
        out_pages[p - 1].append(e if e is not None else [])
    # Blank lines at a page's top and bottom are dropped (pages 1 and 2 hold
    # fewer lines, set in the middle); the page keeps its height in the app.
    for pg in out_pages:
        while pg and pg[-1] == []:
            pg.pop()
        while pg and pg[0] == []:
            pg.pop(0)
    return {"pages": pages, "lines": lines, "page": out_pages}


def check_layout(name: str, lay: dict, verses: list[dict]) -> None:
    """Every word of every ayah sits on exactly one line, in order."""
    seen: list[tuple[int, int]] = [
        (e[0], e[1]) for pg in lay["page"] for e in pg if len(e) == 2 and isinstance(e[0], int)
    ]
    if seen != sorted(seen) or len(set(seen)) != len(seen):
        raise SystemExit(f"mushaf/{name}: line starts out of order")
    if seen[0] != (1, 1):
        raise SystemExit(f"mushaf/{name}: does not start at 1:1")
    for vid, w in seen:
        if w > len(split_words(verses[vid - 1]["ar"])):
            raise SystemExit(f"mushaf/{name}: ayah id {vid} has no word {w}")
    names = sum(1 for pg in lay["page"] for e in pg if e[:1] in (["s"], ["sb"]))
    if names != 114:
        raise SystemExit(f"mushaf/{name}: {names} surah name lines, expected 114")


def export_mushaf(out: Path, write_json, verses: list[dict], basmala: set[int]) -> list[str]:
    (out / "mushaf").mkdir(parents=True, exist_ok=True)
    done = []
    for path in sorted((DATA / "mushaf").glob("*.json.gz")):
        name = path.name.removesuffix(".json.gz")
        lay = build_layout(load_gz(path), verses, basmala)
        check_layout(name, lay, verses)
        write_json(out / "mushaf" / f"{name}.json", lay)
        done.append(f"{name} ({lay['pages']} pages)")
    return done


def export_timings(out: Path, write_json, verses: list[dict]) -> list[str]:
    done = []
    counts: dict[int, int] = {}
    for v in verses:
        counts[v["s"]] = counts.get(v["s"], 0) + 1
    for path in sorted((DATA / "timings").glob("*.json.gz")):
        rid = path.name.removesuffix(".json.gz")
        rows = load_gz(path)
        if len(rows) != len(verses):
            raise SystemExit(f"timings/{rid}: {len(rows)} ayahs")
        d = out / "timings" / rid
        d.mkdir(parents=True, exist_ok=True)
        i = 0
        for s in range(1, 115):
            surah = []
            for _ in range(counts[s]):
                # quran-align splits words as quran.com does (بعد ما).
                m = qc_word_map(verses[i]["ar"])
                segs = rows[i]
                flat = []
                for k in range(0, len(segs), 4):
                    a, b, t0, t1 = segs[k : k + 4]
                    if a + 1 >= len(m):
                        continue
                    flat += [m[a + 1] - 1, m[min(b, len(m) - 1)], t0, t1]
                surah.append(flat)
                i += 1
            write_json(d / f"{s}.json", surah)
        done.append(rid)
    return done


# Buckwalter (the corpus's extended set) → Arabic.
_BW = {
    "'": "ء", "|": "آ", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ", "A": "ا",
    "b": "ب", "p": "ة", "t": "ت", "v": "ث", "j": "ج", "H": "ح", "x": "خ",
    "d": "د", "*": "ذ", "r": "ر", "z": "ز", "s": "س", "$": "ش", "S": "ص",
    "D": "ض", "T": "ط", "Z": "ظ", "E": "ع", "g": "غ", "_": "ـ", "f": "ف",
    "q": "ق", "k": "ك", "l": "ل", "m": "م", "n": "ن", "h": "ه", "w": "و",
    "Y": "ى", "y": "ي", "F": "ً", "N": "ٌ", "K": "ٍ", "a": "َ", "u": "ُ",
    "i": "ِ", "~": "ّ", "o": "ْ", "`": "ٰ", "{": "ٱ", "^": "ٓ", "#": "ٔ",
    ":": "ۜ", "@": "۟", '"': "۠", "[": "ۢ", ";": "ۥ", ",": "ۦ", ".": "ۭ",
    "!": "ۨ", "-": "۪", "+": "۫", "%": "۬", "]": "ۭ",
}


def buckwalter(bw: str) -> str:
    return "".join(_BW.get(c, "") for c in bw)


def _skeleton(ar: str) -> str:
    """Letters only, alif and hamza forms and ta marbuta folded."""
    out = _DIAC.sub("", ar)
    for a, b in (("ٱ", ""), ("ا", ""), ("أ", ""), ("إ", ""), ("آ", ""), ("ء", ""),
                 ("ؤ", "و"), ("ئ", "ي"), ("ى", "ي"), ("ة", "ه"), (" ", "")):
        out = out.replace(a, b)
    # The short vowels too (مِن is not مَن).
    return out + "|" + "".join(c for c in ar if c in "َُِ")


# Ayahs whose quran.com glosses are shifted against its own words: the
# glosses in word order. 2:181 (id) splits بعدما into two glosses and drops
# the last one.
GLOSS_FIXES = {
    "id": {
        (2, 181): [
            "maka barang siapa", "mengubahnya", "setelah apa", "yang mendengarnya",
            "maka sesungguhnya hanyalah", "dosanya", "atas", "orang-orang yang",
            "(mereka) mengubahnya", "sesungguhnya", "Allah", "Maha Mendengar",
            "Maha Mengetahui",
        ],
    },
}


def qdc_targets(ar: str, n: int) -> list[list[int]] | None:
    """For each of the `n` words quran.com's word data gives an ayah, the
    app's words (0-based) it covers. It mostly splits as the app does; in
    some ayahs it splits بعدما as quran-align does (`qc_word_map`), and in
    37:130 it writes إل ياسين as one word."""
    k = len(split_words(ar))
    if n == k:
        return [[i] for i in range(n)]
    m = qc_word_map(ar)
    if n == len(m) - 1:
        return [[m[q] - 1] for q in range(1, n + 1)]
    if 0 < n < k:
        return [[i] for i in range(n - 1)] + [list(range(n - 1, k))]
    return None


def _most_common(xs: list[str]) -> str:
    best: dict[str, int] = {}
    for x in xs:
        if x:
            best[x] = best.get(x, 0) + 1
    return max(best, key=lambda k: (best[k], -len(k))) if best else ""


def export_words(
    out: Path,
    write_json,
    verses: list[dict],
    corpus: dict[int, list[str]],
    lemma_at: dict[str, str],
    bw_to_arabic,
) -> dict[str, int]:
    """Per-word files for the reader's word meanings and word details.

    `corpus` maps ayah id → the corpus tag string of each quran.com word
    ("N|LEM:kita`b|ROOT:ktb|M|NOM"); `lemma_at` maps "s:a:w" → QUL's lemma
    (vowelled Arabic). Glosses and transliteration come from the words
    snapshots, in the same word numbering."""
    gl = {lang: load_gz(DATA / "words" / f"{lang}.json.gz") for lang in ("en", "id")}
    for lang, rows in gl.items():
        # 2:181 lists its ayah number as a word ("", "(181)").
        gl[lang] = [[w for w in ws if w[0]] for ws in rows]
        for (s, a), fix in GLOSS_FIXES.get(lang, {}).items():
            i = next(k for k, v in enumerate(verses) if v["s"] == s and v["a"] == a)
            gl[lang][i] = [[w[0], g] for w, g in zip(gl[lang][i], fix)]
    for lang, rows in gl.items():
        if len(rows) != len(verses):
            raise SystemExit(f"words/{lang}: {len(rows)} ayahs")
    roots: dict[str, int] = {}
    root_list: list[list] = []
    lemmas: dict[str, int] = {}
    lemma_list: list[list] = []  # [ar, root, count, [en...], [id...]]
    occ: list[list[int]] = [[]]
    by_surah: dict[int, list] = {}
    mismatched = 0
    for i, v in enumerate(verses):
        en, idg = gl["en"][i], gl["id"][i]
        tags = corpus.get(v["id"], [])
        targets = qdc_targets(v["ar"], len(en))
        if targets is None or len(idg) != len(en):
            raise SystemExit(f"words {v['s']}:{v['a']}: {len(en)}/{len(idg)} glosses")
        if len(tags) != len(en):
            mismatched += 1
            tags = []
        words: list[list | None] = [None] * len(split_words(v["ar"]))
        for q in range(1, len(en) + 1):
            tr, ge, gi = en[q - 1][0], en[q - 1][1], idg[q - 1][1]
            t = tags[q - 1] if tags else ""
            parts = [x for x in t.split("|") if x]
            lem_bw = next((x[4:] for x in parts if x.startswith("LEM:")), "")
            root_bw = next((x[5:] for x in parts if x.startswith("ROOT:")), "")
            feat = "|".join(x for x in parts if not x.startswith(("LEM:", "ROOT:")))
            r = 0
            if root_bw:
                if root_bw not in roots:
                    root_list.append([bw_to_arabic(root_bw), root_bw, 0])
                    roots[root_bw] = len(root_list)
                r = roots[root_bw]
                root_list[r - 1][2] += 1
            lm = 0
            lem_ar = ""
            if lem_bw:
                # QUL's lemma when it is the corpus's (QUL numbers some
                # ayahs' words differently), else the corpus's spelled out.
                qul = lemma_at.get(f"{v['s']}:{v['a']}:{q}", "")
                mine = buckwalter(lem_bw)
                lem_ar = qul if qul and _skeleton(qul) == _skeleton(mine) else mine
            if lem_ar:
                key = f"{lem_ar}|{r}"
                if key not in lemmas:
                    lemma_list.append([lem_ar, r, 0, [], []])
                    occ.append([])
                    lemmas[key] = len(lemma_list)
                lm = lemmas[key]
                row = lemma_list[lm - 1]
                row[2] += 1
                row[3].append(ge)
                row[4].append(gi)
            for app in targets[q - 1]:
                if lm and occ[lm][-2:] != [v["id"], app]:
                    occ[lm] += [v["id"], app]
                w = words[app]
                if w is None:
                    words[app] = [tr, ge, gi, feat, lm, r]
                elif len(targets[q - 1]) == 1:
                    # quran.com's second half of a word the app writes as one.
                    w[0], w[1], w[2] = f"{w[0]} {tr}", f"{w[1]} {ge}", f"{w[2]} {gi}"
        if any(w is None for w in words):
            raise SystemExit(f"words {v['s']}:{v['a']}: a word without data")
        by_surah.setdefault(v["s"], []).append(words)
    (out / "words").mkdir(parents=True, exist_ok=True)
    for s, rows in by_surah.items():
        write_json(out / "words" / f"{s}.json", rows)
    write_json(out / "lexicon.json", {
        "roots": root_list,
        "lemmas": [
            [ar, r, c, _most_common(e), _most_common(i)]
            for ar, r, c, e, i in lemma_list
        ],
    })
    write_json(out / "lexicon-occ.json", occ)
    return {"roots": len(root_list), "lemmas": len(lemma_list), "mismatched": mismatched}
