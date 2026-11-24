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
  qul        Word timings from a QUL (qul.tarteel.ai) ayah-by-ayah "Download
             json" file, downloaded by hand since QUL needs a login. Not in
             the default run: `qul --qul yasser=<file>` (QUL #103). Checked
             against audio/<reciter>/ MP3s when present.
  mp3quran   Ayah clips for whole-surah reciters from mp3quran.net's API v3
             (`/ayat_timing?surah=N&read=R`, 114 requests per reciter, plus
             one HEAD per surah file for the set's size). Not in the default
             run: `mp3quran --mp3quran bandar-baleela=217` (R from
             `/ayat_timing/reads`). Prints the reciter's `RECITER_INFO` entry.
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


def fetch_qul(files: list[str]) -> None:
    """QUL segment JSON, downloaded by hand (QUL needs a login): `qul --qul
    yasser=file.json`. QUL segments are [word (1-based), startMs, endMs] in
    quran.com's word numbering, as quran-align's are. Ayah-by-ayah files time
    each ayah's own MP3; surah-by-surah ones (segments.json, with
    `timestamp_from`/`timestamp_to`) time the surah's MP3, so the ayahs
    become clips of it (`clips/<reciter>.json.gz`) and their words are
    timed from the clip's start. `align_recitation.py` adds the basmalah as
    "s:0"."""
    if not files:
        raise SystemExit("qul: pass --qul <reciter>=<file.json>")
    counts = ayah_counts()
    for spec in files:
        rid, path = spec.split("=", 1)
        d = json.loads(Path(path).expanduser().read_text("utf-8"))
        # The download is keyed "surah:ayah"; the docs show a list of rows.
        if isinstance(d, dict):
            by = {tuple(map(int, k.split(":"))): r for k, r in d.items()}
        else:
            by = {(r["surah"], r["ayah"]): r for r in d}
        basmalah = {k[0]: r for k, r in by.items() if k[1] == 0}
        by = {k: r for k, r in by.items() if k[1]}
        if len(by) != TOTAL:
            raise SystemExit(f"{path}: {len(by)} ayahs")
        # Some QUL segments carry only a word number: no time, skip.
        segs = {k: [g for g in r.get("segments") or [] if len(g) >= 3] for k, r in by.items()}
        if "timestamp_from" in next(iter(by.values())):
            clips, opening = surah_clips(by, counts, basmalah)
            out = [
                [x for w, t0, t1, *_ in segs[k] for x in (w - 1, w, max(0, t0 - c0), max(0, t1 - c0))]
                for k, (c0, _) in zip(ayah_keys(counts), clips)
            ]
            check_surah_files(rid, clips, counts)
            write_gz(DATA / "clips" / f"{rid}.json.gz", [x for c in clips + opening for x in c])
        else:
            out = [[x for w, t0, t1, *_ in segs[k] for x in (w - 1, w, t0, t1)] for k in ayah_keys(counts)]
            urls = {str(r.get("audio_url", "")).rsplit("/", 1)[0] for r in by.values()}
            print(f"qul/{rid}: audio from {sorted(urls)[:3]}")
            check_against_local_audio(rid, out, counts)
        write_gz(DATA / "timings" / f"{rid}.json.gz", out)


MP3QURAN = "https://www.mp3quran.net/api/v3"
BITRATES = (32, 40, 48, 64, 96, 128, 160, 192, 256, 320)


def mp3quran_rows(timings: dict[int, list], counts: list[int]) -> dict:
    """mp3quran's ayat_timing rows per surah as `surah_clips` input, checked:
    every ayah once, in order, each starting no earlier than the one before.
    Its bounds are ayah starts (an ayah ends where the next begins), so the
    cut between two clips lands on the next ayah's start."""
    by = {}
    for s, rows in timings.items():
        rows = [r for r in rows if r["ayah"] > 0]
        if [r["ayah"] for r in rows] != list(range(1, counts[s - 1] + 1)):
            raise ValueError(f"surah {s}: ayahs {[r['ayah'] for r in rows][:5]}…")
        for prev, r in zip([None, *rows], rows):
            if r["end_time"] <= r["start_time"] or (prev and r["start_time"] < prev["start_time"]):
                raise ValueError(f"surah {s} ayah {r['ayah']}: {r['start_time']}–{r['end_time']} ms")
            by[(s, r["ayah"])] = {"timestamp_from": r["start_time"], "timestamp_to": r["end_time"]}
    return by


def head_size(url: str) -> int:
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return int(r.headers["Content-Length"])


def fetch_mp3quran(specs: list[str]) -> None:
    if not specs:
        raise SystemExit("mp3quran: pass --mp3quran <reciter>=<read id>")
    counts = ayah_counts()
    reads = {r["id"]: r for r in get_json(f"{MP3QURAN}/ayat_timing/reads")}
    for spec in specs:
        rid, read = spec.split("=", 1)
        info = reads[int(read)]
        folder = info["folder_url"]
        timings, size, t0 = {}, 0, time.time()
        for s in range(1, 115):
            timings[s] = get_json(f"{MP3QURAN}/ayat_timing?surah={s}&read={read}")
            size += head_size(f"{folder}{s:03}.mp3")
            time.sleep(0.2)
            if s % 19 == 0 or s == 114:
                progress(f"mp3quran/{rid}", s, 114, t0)
        try:
            by = mp3quran_rows(timings, counts)
        except ValueError as e:
            print(f"mp3quran/{rid}: skipped, {e}")
            continue
        clips, opening = surah_clips(by, counts, {})
        write_gz(DATA / "clips" / f"{rid}.json.gz", [x for c in clips + opening for x in c])
        ms = sum(timings[s][-1]["end_time"] for s in timings)
        kbps = min(BITRATES, key=lambda b: abs(b - size * 8 / ms))
        print(f'  "{rid}": {{ nameAr: "{info["name"]}", source: "{folder}", '
              f'bitrate: {kbps}, bytes: {size:_}, surahFiles: true }},', flush=True)


def ayah_keys(counts: list[int]) -> list[tuple[int, int]]:
    return [(s, a) for s, n in enumerate(counts, 1) for a in range(1, n + 1)]


LEAD_MS = 300  # before a surah's first ayah (after its basmalah)
TAIL_MS = 1500  # after its last; the file's end comes first if sooner


def surah_clips(
    by: dict, counts: list[int], basmalah: dict
) -> tuple[list[tuple[int, int]], list[tuple[int, int]]]:
    """Each ayah's [fromMs, toMs) in its surah's file: the cut between two
    ayahs is the middle of the pause between them, so a clip keeps its
    breath, as an ayah-by-ayah file does. Then each surah's basmalah clip:
    its own words when timed (a file can open with an announcement, and
    002.mp3 has al-Fatiha between the basmalah and 2:1), else the part of the
    file before the first clip."""
    def span(r: dict) -> tuple[int, int]:
        # The words, when timed: QUL's own ayah bounds slip (36:3 starts
        # 3 s before its first word, inside 36:2).
        w = [g for g in r.get("segments") or [] if len(g) >= 3]
        return (w[0][1], w[-1][2]) if w else (r["timestamp_from"], r["timestamp_to"])

    out, opening = [], []
    for s, n in enumerate(counts, 1):
        spans = [span(by[(s, a)]) for a in range(1, n + 1)]
        cuts = [max(0, spans[0][0] - LEAD_MS)]
        for (_, a), (b, _) in zip(spans, spans[1:]):
            cuts.append(max(cuts[-1] + 1, (a + b) // 2 if b > a else b))
        cuts.append(max(cuts[-1] + 1, spans[-1][1] + TAIL_MS))
        out += list(zip(cuts, cuts[1:]))
        if s in basmalah:
            b0, b1 = span(basmalah[s])
            gap = spans[0][0] - b1
            opening.append((max(0, b0 - LEAD_MS), b1 + max(0, min(gap // 2, TAIL_MS))))
        else:
            opening.append((0, cuts[0]))
    return out, opening


def check_surah_files(rid: str, clips: list[tuple[int, int]], counts: list[int]) -> None:
    """Every sampled surah's last ayah must end near the end of its local file."""
    folder = APP / "audio" / rid
    if not (folder / "001.mp3").exists():
        print(f"qul/{rid}: no local surah files, recording not checked")
        return
    import subprocess

    bad, last = [], 0
    for s, n in enumerate(counts, 1):
        last += n
        mp3 = folder / f"{s:03}.mp3"
        if s % 6 != 1 or not mp3.exists():
            continue
        dur = float(subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3],
            capture_output=True, text=True, check=True,
        ).stdout) * 1000
        end = clips[last - 1][1] - TAIL_MS
        if not (dur - 15000 <= end <= dur + 300):
            bad.append(f"surah {s} ends {end} ms, file {dur:.0f} ms")
    if bad:
        raise SystemExit(f"qul/{rid}: not the local recording?\n  " + "\n  ".join(bad))
    print(f"qul/{rid}: clips fit the local surah files")


def check_against_local_audio(rid: str, rows: list, counts: list[int]) -> None:
    """Same recording? Each sampled ayah's last word must end inside its local
    MP3, with little left over. Skipped when audio/<rid>/ isn't here."""
    folder = APP / "audio" / rid
    if not folder.is_dir():
        print(f"qul/{rid}: no local audio, recording not checked")
        return
    import subprocess

    keys = ayah_keys(counts)
    bad, n = [], 0
    for i in range(0, TOTAL, TOTAL // 40):
        if not rows[i]:
            continue
        s, a = keys[i]
        mp3 = folder / f"{s:03}{a:03}.mp3"
        dur = float(subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3],
            capture_output=True, text=True, check=True,
        ).stdout) * 1000
        end, n = rows[i][-1], n + 1
        if not (dur - 2500 <= end <= dur + 300):
            bad.append(f"{s}:{a} ends {end} ms, file {dur:.0f} ms")
    # A few ayahs trail long silence (Yasser: median gap 27 ms, one of 200 at 3 s).
    if len(bad) > n // 10:
        raise SystemExit(f"qul/{rid}: not the local recording?\n  " + "\n  ".join(bad))
    print(f"qul/{rid}: timings fit the local MP3s")


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
    ap.add_argument("--qul", action="append", default=[])
    ap.add_argument("--mp3quran", action="append", default=[])
    args = ap.parse_args()
    parts = args.parts or ["timings", "translit", "footnotes", "mushaf", "words"]
    if not SURAHS.exists():
        sys.exit(f"Missing {SURAHS}; run `npm run build:data` once first.")
    for p in parts:
        if p == "mushaf":
            fetch_mushaf(args.layout)
        elif p == "qul":
            fetch_qul(args.qul)
        elif p == "mp3quran":
            fetch_mp3quran(args.mp3quran)
        else:
            globals()[f"fetch_{p}"]()


if __name__ == "__main__":
    main()
