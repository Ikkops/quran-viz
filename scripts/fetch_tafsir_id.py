#!/usr/bin/env python3
"""Fetch the Indonesian tafsirs that are not in quran.db / qul.db into
checked-in snapshots under scripts/data/tafsir/, which build_data.py reads.

Each snapshot is a gzipped JSON array of 6,236 strings in mushaf order
(1:1 … 114:6), one note per ayah, written byte-for-byte reproducibly
(gzip mtime 0), so re-fetching unchanged text leaves git clean.

Sources (all text by Kementerian Agama RI unless noted):
  jalalayn  Tafsir Jalalain (Indonesian), api.alquran.cloud `id.jalalayn`
            (one request for the whole Qur'an).
  tahlili   Tafsir Kemenag (Tahlili), equran.id API v2 /tafsir/<surah>
            (114 requests, one per surah, 1 s apart). Kemenag repeats one
            note over the ayahs of a passage; the ETL collapses those runs.
  wajiz     Tafsir Wajiz Kemenag: the `tafsir.id.short` field of the
            gadingnst/quran-api dataset (crawled from quran.kemenag.go.id),
            pinned to one commit. Kemenag's own API refuses scripted clients.

Usage (from quran-viz/):
    python3 scripts/fetch_tafsir_id.py              # all three
    python3 scripts/fetch_tafsir_id.py tahlili      # just one
    python3 scripts/fetch_tafsir_id.py --check      # validate snapshots only

Needs public/data/surahs.json (ayah counts), i.e. one prior `npm run build:data`.
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
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
SURAHS = APP / "public" / "data" / "surahs.json"
OUT = Path(__file__).resolve().parent / "data" / "tafsir"
UA = "quran-viz-etl"
DELAY = 1.0  # seconds between requests to the same host
TOTAL = 6236

WAJIZ_COMMIT = "0d9497128748181fed96d29005c00afcec29d96d"  # 2021-01-19
SOURCES = {
    "jalalayn": "https://api.alquran.cloud/v1/quran/id.jalalayn",
    "tahlili": "https://equran.id/api/v2/tafsir/{surah}",
    "wajiz": f"https://raw.githubusercontent.com/gadingnst/quran-api/{WAJIZ_COMMIT}/data/quran.json",
}


def snapshot_path(name: str) -> Path:
    return OUT / f"{name}.json.gz"


def get_json(url: str, retries: int = 4):
    err = ""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
            err = str(e)
            time.sleep(3 * (attempt + 1))
    raise SystemExit(f"giving up on {url}: {err}")


def ayah_counts() -> list[int]:
    if not SURAHS.exists():
        raise SystemExit(f"Missing {SURAHS}; run `npm run build:data` once first.")
    return [s["ayahCount"] for s in json.loads(SURAHS.read_text(encoding="utf-8"))]


def clean(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.replace("\r\n", "\n").split("\n")).strip()


def validate(texts: list, name: str) -> None:
    if not isinstance(texts, list) or len(texts) != TOTAL:
        raise SystemExit(f"{name}: expected {TOTAL} entries, got {len(texts) if isinstance(texts, list) else type(texts)}")
    empty = [i for i, t in enumerate(texts) if not isinstance(t, str) or not t.strip()]
    if empty:
        raise SystemExit(f"{name}: {len(empty)} empty entries (first at index {empty[0]})")


def write_snapshot(name: str, texts: list[str]) -> None:
    validate(texts, name)
    OUT.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(texts, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    buf = io.BytesIO()
    with gzip.GzipFile(filename="", mode="wb", fileobj=buf, mtime=0, compresslevel=9) as gz:
        gz.write(raw)
    snapshot_path(name).write_bytes(buf.getvalue())
    print(f"{name}: {len(texts)} ayahs, {len(raw) / 1e6:.1f} MB text, "
          f"{len(buf.getvalue()) / 1e6:.1f} MB gz -> {snapshot_path(name).relative_to(APP)}", flush=True)


def fetch_jalalayn(counts: list[int]) -> list[str]:
    data = get_json(SOURCES["jalalayn"])["data"]["surahs"]
    texts = []
    for s, surah in enumerate(data, 1):
        ayahs = surah["ayahs"]
        if surah["number"] != s or [a["numberInSurah"] for a in ayahs] != list(range(1, counts[s - 1] + 1)):
            raise SystemExit(f"jalalayn: surah {s} numbering does not match")
        texts.extend(clean(a["text"]) for a in ayahs)
    return texts


def fetch_tahlili(counts: list[int]) -> list[str]:
    texts: list[str] = []
    t0 = time.time()
    for s in range(1, 115):
        rows = get_json(SOURCES["tahlili"].format(surah=s))["data"]["tafsir"]
        if [r["ayat"] for r in rows] != list(range(1, counts[s - 1] + 1)):
            raise SystemExit(f"tahlili: surah {s} has ayat {[r['ayat'] for r in rows][:5]}…, "
                             f"expected 1..{counts[s - 1]}")
        texts.extend(clean(r["teks"]) for r in rows)
        spent = time.time() - t0
        left = round(spent / s * (114 - s))
        print(f"{s}/114 · ({s / 114:.0%}) · tahlili surah {s} · eta {left // 60}:{left % 60:02d}", flush=True)
        if s < 114:
            time.sleep(DELAY)
    return texts


def fetch_wajiz(counts: list[int]) -> list[str]:
    data = get_json(SOURCES["wajiz"])["data"]
    texts = []
    for s, surah in enumerate(data, 1):
        verses = surah["verses"]
        if surah["number"] != s or [v["number"]["inSurah"] for v in verses] != list(range(1, counts[s - 1] + 1)):
            raise SystemExit(f"wajiz: surah {s} numbering does not match")
        texts.extend(clean(v["tafsir"]["id"]["short"]) for v in verses)
    return texts


FETCHERS = {"jalalayn": fetch_jalalayn, "tahlili": fetch_tahlili, "wajiz": fetch_wajiz}


def read_snapshot(name: str) -> list[str]:
    return json.loads(gzip.decompress(snapshot_path(name).read_bytes()).decode("utf-8"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("sources", nargs="*", metavar="SOURCE",
                    help=f"which tafsirs: {', '.join(FETCHERS)} (default: all)")
    ap.add_argument("--check", action="store_true", help="validate snapshots, fetch nothing")
    args = ap.parse_args()
    unknown = [s for s in args.sources if s not in FETCHERS]
    if unknown:
        ap.error(f"unknown source(s) {unknown}; choose from {list(FETCHERS)}")
    names = args.sources or list(FETCHERS)

    if args.check:
        bad = 0
        for name in names:
            p = snapshot_path(name)
            if not p.exists():
                print(f"{name}: missing {p.relative_to(APP)}")
                bad += 1
                continue
            validate(read_snapshot(name), name)
            print(f"{name}: ok ({p.stat().st_size / 1e6:.1f} MB gz)")
        return 1 if bad else 0

    counts = ayah_counts()
    if sum(counts) != TOTAL:
        raise SystemExit(f"surahs.json counts {sum(counts)} ayahs, expected {TOTAL}")
    for n, name in enumerate(names):
        if n:
            time.sleep(DELAY)
        write_snapshot(name, FETCHERS[name](counts))
    return 0


if __name__ == "__main__":
    sys.exit(main())
