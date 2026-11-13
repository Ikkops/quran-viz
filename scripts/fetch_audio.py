#!/usr/bin/env python3
"""Download per-ayah recitation audio into quran-viz/audio/<reciter>/.

The audio is never committed or bundled: `audio/` is gitignored, and the Vite
plugin in vite.config.ts serves it at `audio/` only in `dev` and `preview`.

Files are named SSSAAA.mp3 (surah, ayah, zero-padded), as on everyayah.com.
001001.mp3 doubles as the basmalah played before ayah 1 of other surahs.

Usage (from quran-viz/):
    python3 scripts/fetch_audio.py                 # default reciter: shuraym
    python3 scripts/fetch_audio.py --surah 1 --surah 112   # only some surahs
    python3 scripts/fetch_audio.py --check         # verify, download nothing

Re-running resumes: complete files are skipped, partial ones (.part) restart.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
SURAHS = APP / "public" / "data" / "surahs.json"
AUDIO = APP / "audio"

RECITERS = {
    "shuraym": {
        "name": "Sa'ud ash-Shuraym",
        "nameAr": "سعود الشريم",
        "source": "https://everyayah.com/data/Saood_ash-Shuraym_64kbps/",
        "bitrate": 64,
        # ID3 tags: "HidayahOnline.Org MP3s", album VerseByVerseQuran.Com. No
        # recording date is published for either set.
        "origin": "HidayahOnline.org",
    },
    "yasser": {
        "name": "Yasser ad-Dosari",
        "nameAr": "ياسر الدوسري",
        "source": "https://everyayah.com/data/Yasser_Ad-Dussary_128kbps/",
        "bitrate": 128,
        # ID3 comment: "MP3s from download.quranicaudio.com/quran/yasser_ad-dussary/"
        "origin": "QuranicAudio.com",
    },
}

UA = "quran-viz-audio-fetch/1.0"


def ayah_list(surahs: list[int] | None) -> list[tuple[int, int]]:
    data = json.loads(SURAHS.read_text(encoding="utf-8"))
    out = []
    for s in data:
        if surahs and s["id"] not in surahs:
            continue
        out.extend((s["id"], a) for a in range(1, s["ayahCount"] + 1))
    return out


def fname(s: int, a: int) -> str:
    return f"{s:03d}{a:03d}.mp3"


def looks_like_mp3(p: Path) -> bool:
    try:
        with p.open("rb") as f:
            head = f.read(3)
    except OSError:
        return False
    return head == b"ID3" or (len(head) >= 2 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0)


def fetch_one(base: str, out: Path, s: int, a: int, retries: int = 4) -> tuple[str, str, int]:
    name = fname(s, a)
    dest = out / name
    if dest.exists() and dest.stat().st_size > 0 and looks_like_mp3(dest):
        return name, "skip", 0
    part = dest.with_suffix(".part")
    url = base + name
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                expected = int(r.headers.get("Content-Length") or 0)
                body = r.read()
            if expected and len(body) != expected:
                raise IOError(f"short read {len(body)}/{expected}")
            part.write_bytes(body)
            if not looks_like_mp3(part):
                raise IOError("not an mp3")
            part.replace(dest)
            return name, "ok", len(body)
        except (urllib.error.URLError, IOError, TimeoutError) as e:
            err = str(e)
            time.sleep(2 * (attempt + 1))
    part.unlink(missing_ok=True)
    return name, f"fail: {err}", 0


def progress_line(done: int, total: int, fetched: int, nbytes: int, fails: int, secs: float) -> str:
    """One line in the shape the bg-progress mod reads (count, %, speed, eta)."""
    parts = [f"{done}/{total}", f"({done / total * 100:.1f}%)"]
    if secs > 0 and fetched:
        parts.append(f"{nbytes / secs / 1e6:.1f}MB/s")
        left = (total - done) / (fetched / secs)
        parts.append(f"eta {int(left // 60)}:{int(left % 60):02d}")
    parts.append(f"fails={fails}")
    return " · ".join(parts)


def write_index(key: str, out: Path, ayahs: list[tuple[int, int]]) -> dict:
    meta = RECITERS[key]
    total = len(ayah_list(None))
    present = sum(1 for p in out.glob("*.mp3") if p.stat().st_size > 0)
    size = sum(p.stat().st_size for p in out.glob("*.mp3"))
    index = {
        "id": key,
        "name": meta["name"],
        "nameAr": meta["nameAr"],
        "source": meta["source"],
        "bitrate": meta["bitrate"],
        "origin": meta["origin"],
        "recorded": None,
        "files": present,
        "total": total,
        "complete": present >= total,
        "bytes": size,
        "pattern": "{surah3}{ayah3}.mp3",
    }
    (out / "index.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    return index


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reciter", default="shuraym", choices=sorted(RECITERS))
    ap.add_argument("--surah", type=int, action="append", help="limit to these surahs")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--check", action="store_true", help="verify only")
    args = ap.parse_args()

    meta = RECITERS[args.reciter]
    out = AUDIO / args.reciter
    out.mkdir(parents=True, exist_ok=True)
    ayahs = ayah_list(args.surah)

    if args.check:
        missing = [fname(s, a) for s, a in ayahs if not looks_like_mp3(out / fname(s, a))]
        idx = write_index(args.reciter, out, ayahs)
        print(f"{len(ayahs) - len(missing)}/{len(ayahs)} present; {idx['bytes'] / 1e6:.0f} MB")
        for m in missing[:20]:
            print("missing", m)
        return 1 if missing else 0

    write_index(args.reciter, out, ayahs)  # lets the app list it while downloading
    done = fails = fetched = nbytes = 0
    failed: list[str] = []
    t0 = time.time()
    total = len(ayahs)
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(fetch_one, meta["source"], out, s, a) for s, a in ayahs]
        for f in as_completed(futs):
            name, status, size = f.result()
            done += 1
            if status == "ok":
                fetched += 1
                nbytes += size
            elif status.startswith("fail"):
                fails += 1
                failed.append(f"{name}\t{status}")
            if done % 25 == 0 or done == total:
                print(progress_line(done, total, fetched, nbytes, fails, time.time() - t0), flush=True)
            if done % 250 == 0 or done == total:
                write_index(args.reciter, out, ayahs)

    log = out / "fetch-failures.log"
    if failed:
        log.write_text("\n".join(sorted(failed)) + "\n", encoding="utf-8")
    else:
        log.unlink(missing_ok=True)
    idx = write_index(args.reciter, out, ayahs)
    print(f"done: {idx['files']}/{idx['total']} files, {idx['bytes'] / 1e6:.0f} MB, fails={fails}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
