#!/usr/bin/env python3
"""Fetch reader data that is not in quran.db / qul.db into checked-in
snapshots under scripts/data/, which build_data.py reads.

Snapshots are gzipped JSON written reproducibly (gzip mtime 0, sorted keys),
so re-fetching unchanged data leaves git clean.

  footnotes  Translator footnotes for four editions, from the quran.com API v4
             (`/quran/translations/<id>?chapter_number=N&foot_notes=true`,
             114 requests per edition). Saved per ayah as quran.com's text
             with `<sup foot_note=ID>n</sup>` markers plus the notes; the ETL
             places the markers on the app's own text of that edition.
  translit   Indonesian transliteration (Kemenag/SKB style, `teksLatin`),
             equran.id API v2 `/surat/<n>` (114 requests).
  mushaf     Line layouts of four printed mushafs, from the quran.com QDC API
             (`/verses/by_page/<p>?mushaf=<m>&words=true`, one request per
             page). Saved as line starts: [page, line, surah, ayah, word]
             (word = 1-based position among the ayah's words, the same
             words the app splits on, pause marks not counted).
  timings    Word timings for twelve everyayah.com reciters from quran-align
             (cpfair/quran-align, release 2016-11-24, CC BY 4.0), keyed by
             the app's reciter ids. The other bitrates of a set are the same
             recording (durations match within 0.1 s), so the timings hold.
  words      Per-word transliteration and English / Indonesian glosses from
             the quran.com QDC API (`/verses/by_chapter/<n>?words=true&
             word_translation_language=<en|id>`, 2 × 114 requests), in
             quran.com's word numbering (the corpus and quran-align's).

Usage (from quran-viz/):
    python3 -u scripts/fetch_reader_data.py               # everything
    python3 -u scripts/fetch_reader_data.py mushaf        # one part
"""

from __future__ import annotations

import argparse
import gzip
import io
import json
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
DATA = Path(__file__).resolve().parent / "data"
SURAHS = APP / "public" / "data" / "surahs.json"
UA = "quran-viz-etl"
TOTAL = 6236

# quran.com translation id → the app's edition id
FOOTNOTE_EDITIONS = {
    "id.kemenag-qul": 33,
    "id.kfc-qul": 134,
    "id.sabiq-qul": 141,
    "en.sahih": 20,
}

# app layout id → (quran.com mushaf id, pages)
MUSHAF_LAYOUTS = {
    "madinah-1441": (1, 604),
    "madinah-1405": (2, 604),
    "indopak-15": (6, 610),
    "indopak-16": (7, 548),
}

ALIGN_ZIP = (
    "https://github.com/cpfair/quran-align/releases/download/"
    "release-2016-11-24/quran-align-data-2016-11-24.zip"
)
# app reciter id → quran-align file
TIMING_RECITERS = {
    "shuraym": "Saood_ash-Shuraym_128kbps",
    "abdulbasit-mujawwad": "Abdul_Basit_Mujawwad_128kbps",
    "abdulbasit": "Abdul_Basit_Murattal_64kbps",
    "sudais": "Abdurrahmaan_As-Sudais_192kbps",
    "shatri": "Abu_Bakr_Ash-Shaatree_128kbps",
    "rifai": "Hani_Rifai_192kbps",
    "husary-muallim": "Husary_Muallim_128kbps",
    "husary": "Husary_64kbps",
    "alafasy": "Alafasy_128kbps",
    "minshawi-mujawwad": "Minshawy_Mujawwad_192kbps",
    "minshawi": "Minshawy_Murattal_128kbps",
    "tablawi": "Mohammad_al_Tablaway_128kbps",
}


def write_gz(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", mtime=0) as g:
        g.write(raw)
    path.write_bytes(buf.getvalue())
    print(f"wrote {path.relative_to(APP)} ({len(buf.getvalue()) / 1e6:.2f} MB)", flush=True)


def get(url: str, retries: int = 5) -> bytes:
    err = ""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            err = str(e)
            time.sleep(3 * (attempt + 1))
    raise SystemExit(f"giving up on {url}: {err}")


def get_json(url: str):
    return json.loads(get(url).decode("utf-8"))


def progress(label: str, done: int, total: int, t0: float) -> None:
    el = time.time() - t0
    eta = el / done * (total - done) if done else 0
    print(f"{label} {done}/{total} · ({100 * done / total:.1f}%) · eta {int(eta // 60)}:{int(eta % 60):02d}", flush=True)


def ayah_counts() -> list[int]:
    return [s["ayahCount"] for s in json.loads(SURAHS.read_text(encoding="utf-8"))]


def fetch_footnotes() -> None:
    counts = ayah_counts()
    for ed, qid in FOOTNOTE_EDITIONS.items():
        out: list = []
        t0 = time.time()
        for s in range(1, 115):
            d = get_json(
                f"https://api.quran.com/api/v4/quran/translations/{qid}?chapter_number={s}&foot_notes=true"
            )
            rows = d["translations"]
            if len(rows) != counts[s - 1]:
                raise SystemExit(f"{ed} surah {s}: {len(rows)} ayahs, expected {counts[s - 1]}")
            for r in rows:
                notes = r.get("foot_notes") or {}
                out.append({"t": r["text"], "n": notes} if notes else None)
            if s % 10 == 0 or s == 114:
                progress(ed, s, 114, t0)
            time.sleep(0.4)
        assert len(out) == TOTAL
        write_gz(DATA / "footnotes" / f"{ed}.json.gz", out)


def fetch_translit() -> None:
    counts = ayah_counts()
    out: list[str] = []
    t0 = time.time()
    for s in range(1, 115):
        ayat = get_json(f"https://equran.id/api/v2/surat/{s}")["data"]["ayat"]
        if len(ayat) != counts[s - 1]:
            raise SystemExit(f"surah {s}: {len(ayat)} ayahs, expected {counts[s - 1]}")
        out += [a["teksLatin"].strip() for a in ayat]
        if s % 10 == 0 or s == 114:
            progress("translit", s, 114, t0)
        time.sleep(1.0)
    write_gz(DATA / "translit" / "id.json.gz", out)


def fetch_mushaf(only: list[str] | None = None) -> None:
    for name, (mid, pages) in MUSHAF_LAYOUTS.items():
        if only and name not in only:
            continue
        starts: list[list[int]] = []
        t0 = time.time()
        max_line = 0
        for p in range(1, pages + 1):
            d = get_json(
                f"https://api.qurancdn.com/api/qdc/verses/by_page/{p}?words=true&mushaf={mid}"
                "&word_fields=line_number,page_number&per_page=all"
            )
            last = None
            for v in d["verses"]:
                s, a = map(int, v["verse_key"].split(":"))
                n = 0
                for w in v["words"]:
                    if w["char_type_name"] != "word":
                        continue
                    n += 1
                    pg, ln = w.get("page_number", p), w["line_number"]
                    max_line = max(max_line, ln)
                    if (pg, ln) != last:
                        starts.append([pg, ln, s, a, n])
                        last = (pg, ln)
            if p % 25 == 0 or p == pages:
                progress(name, p, pages, t0)
            time.sleep(0.25)
        # A page fetch can include words on the next page (mushaf 7 does);
        # keep the first start of each (page, line).
        seen: set[tuple[int, int]] = set()
        uniq = []
        for st in sorted(starts, key=lambda x: (x[0], x[1], x[2], x[3], x[4])):
            if (st[0], st[1]) not in seen:
                seen.add((st[0], st[1]))
                uniq.append(st)
        write_gz(
            DATA / "mushaf" / f"{name}.json.gz",
            {"pages": pages, "lines": max_line, "starts": uniq},
        )


def fetch_timings() -> None:
    z = zipfile.ZipFile(io.BytesIO(get(ALIGN_ZIP)))
    for rid, fname in TIMING_RECITERS.items():
        raw = z.read(f"{fname}.json").decode("utf-8")
        # The Sudais file starts with a line of the aligner's crash log.
        rows = json.loads(raw[raw.index("\n[") + 1 :] if not raw.startswith("[") else raw)
        by = {(r["surah"], r["ayah"]): r.get("segments") or [] for r in rows}
        if len(by) != TOTAL:
            raise SystemExit(f"{fname}: {len(by)} ayahs")
        out = []
        counts = ayah_counts()
        for s, n in enumerate(counts, 1):
            for a in range(1, n + 1):
                # [wordFrom, wordTo (exclusive), startMs, endMs], 0-based words
                out.append([x for seg in by[(s, a)] for x in seg])
        write_gz(DATA / "timings" / f"{rid}.json.gz", out)


WORD_LANGS = ("en", "id")


def fetch_words() -> None:
    counts = ayah_counts()
    for lang in WORD_LANGS:
        out: list = []  # per ayah: [[transliteration, gloss], ...]
        t0 = time.time()
        for s in range(1, 115):
            page, verses = 1, []
            while page:
                d = get_json(
                    f"https://api.qurancdn.com/api/qdc/verses/by_chapter/{s}?words=true"
                    f"&word_translation_language={lang}&per_page=50&page={page}"
                    "&word_fields=text_uthmani"
                )
                verses += d["verses"]
                page = d["pagination"]["next_page"]
                time.sleep(0.25)
            if len(verses) != counts[s - 1]:
                raise SystemExit(f"words {lang} surah {s}: {len(verses)} ayahs")
            for v in verses:
                out.append([
                    [(w.get("transliteration") or {}).get("text") or "",
                     (w.get("translation") or {}).get("text") or ""]
                    for w in v["words"] if w["char_type_name"] == "word"
                ])
            if s % 10 == 0 or s == 114:
                progress(f"words-{lang}", s, 114, t0)
        assert len(out) == TOTAL
        write_gz(DATA / "words" / f"{lang}.json.gz", out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("parts", nargs="*")
    ap.add_argument("--layout", action="append")
    args = ap.parse_args()
    parts = args.parts or ["timings", "translit", "footnotes", "mushaf", "words"]
    if not SURAHS.exists():
        sys.exit(f"Missing {SURAHS}; run `npm run build:data` once first.")
    for p in parts:
        if p == "mushaf":
            fetch_mushaf(args.layout)
        else:
            globals()[f"fetch_{p}"]()


if __name__ == "__main__":
    main()
