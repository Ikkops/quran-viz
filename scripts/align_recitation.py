#!/usr/bin/env python3
"""Word timings for a whole-surah recitation that has none (QUL #402, the
older Sa'ud ash-Shuraym), by CTC forced alignment with torchaudio's MMS_FA
model on the app's own Uthmani text, romanized by uroman.

Writes QUL's surah-by-surah segment format (`{"s:a": {segments: [[word,
startMs, endMs]], timestamp_from, timestamp_to}}`, words in quran.com's
numbering), so `fetch_reader_data.py qul` imports it like a QUL download,
plus `"s:0"` for the basmalah where the surah has one.

Long surahs are aligned in blocks of ~2 minutes: each block plus a little
look-ahead text inside a window that starts where the previous block ended;
a star token at each end soaks up what the text doesn't cover (isti'adha,
the look-ahead's overflow). The look-ahead is half a block: its words
are aligned but not kept, so a block's tail can't latch onto later audio.
Alignment itself takes seconds; the model pass takes the time, so `--cache`
keeps it per surah and a rerun with other block settings is quick.

Needs torch, so it runs in its own environment (CPU is fine, ~1 GB model
download on first run), from quran-viz/:

    uv run --python 3.12 --index https://download.pytorch.org/whl/cpu \\
      --with torch==2.5.1 --with torchaudio==2.5.1 --with uroman \\
      python scripts/align_recitation.py audio/shuraym-old out.json [--surah 36]

About 4x real time on 16 CPU cores, which one run doesn't keep busy: three
runs over different surahs (`--threads 5`, separate out files, merged after)
go about three times as fast. With an NVIDIA GPU the model runs on it (CUDA
wheels: `--index https://download.pytorch.org/whl/cu124`), far faster; a
6 GB card holds the 30 s chunks.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import torch
import torchaudio
import uroman

sys.path.insert(0, str(Path(__file__).resolve().parent))
from reader_data import JOINED, MARK_TOKEN, _DIAC, split_words  # noqa: E402

APP = Path(__file__).resolve().parent.parent
SR = 16000
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
BLOCK_S = 120  # expected seconds of text per block
AHEAD_S = 60  # expected seconds of look-ahead text; 12 s let a repeated phrase
# just past the block pull its last ayah minutes late (8:31, older Shuraym)
BASMALAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"
# The opening letters (الٓمٓ) are recited by name, alif lam mim, so they are
# romanized that way; spelled as three letters they took a word of 2:2 with them.
LETTER_NAMES = {
    "ا": "alif", "ل": "lam", "م": "mim", "ص": "sad", "ر": "ra", "ك": "kaf", "ه": "ha",
    "ي": "ya", "ع": "ayn", "ط": "ta", "س": "sin", "ح": "ha", "ق": "qaf", "ن": "nun",
}
MUQATTAAT = {"الم", "المص", "الر", "المر", "كهيعص", "طه", "طسم", "طس", "يس", "ص", "حم", "عسق", "ق", "ن"}


def decode(mp3: Path) -> torch.Tensor:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(mp3), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return torch.frombuffer(bytearray(raw), dtype=torch.float32)


def emissions(model, wav: torch.Tensor, chunk_s: int = 30, ctx_s: int = 2) -> torch.Tensor:
    """Log-probs per 20 ms frame, computed in chunks with context on each side."""
    out, step, ctx = [], chunk_s * SR, ctx_s * SR
    for s in range(0, len(wav), step):
        a, b = max(0, s - ctx), min(len(wav), s + step + ctx)
        with torch.inference_mode():
            e, _ = model(wav[a:b].unsqueeze(0).to(DEVICE))
        e = e[0].float().cpu()
        per = (b - a) / e.shape[0]  # samples per frame
        lo = round((s - a) / per)
        hi = lo + round((min(s + step, len(wav)) - s) / per)
        out.append(e[lo:hi])
    return torch.cat(out)


class Words:
    """One unit's (basmalah or ayah) words: romanized tokens and quran.com positions."""

    def __init__(self, ar: str, roman: uroman.Uroman, vocab: dict[str, int]):
        self.tokens: list[list[int]] = []
        self.qc: list[int] = []  # quran.com positions each app word covers (count)
        for i, w in enumerate(split_words(ar)):
            main = next(t for t in w.split() if not MARK_TOKEN.match(t))
            bare = _DIAC.sub("", main)
            if i == 0 and bare in MUQATTAAT and ("\u0653" in main or bare == "طه"):
                r = "".join(LETTER_NAMES[c] for c in bare)
            else:
                r = roman.romanize_string(main).lower()
            toks = [vocab[c] for c in r if c in vocab and c not in "-*"] or [vocab["a"]]
            self.tokens.append(toks)
            self.qc.append(JOINED.get(_DIAC.sub("", main), 1))
        self.letters = sum(len(t) for t in self.tokens)


def align_block(
    emis: torch.Tensor, units: list[Words], star: int, gap_after_first: bool = False
) -> list[list[tuple[int, int]]]:
    """Frame spans [start, end) of every word of `units` inside `emis`.
    `gap_after_first` puts a star after the first unit as well: a file's
    basmalah can be followed by something the text lacks (002.mp3 has al-Fatiha
    between it and 2:1)."""
    flat, keep = [star], [False]
    for n, u in enumerate(units):
        for w in u.tokens:
            flat += w
            keep += [True] * len(w)
        if n == 0 and gap_after_first:
            flat.append(star)
            keep.append(False)
    flat.append(star)
    keep.append(False)
    targets = torch.tensor([flat], dtype=torch.int32)
    labels, scores = torchaudio.functional.forced_align(emis.unsqueeze(0), targets, blank=0)
    # A forced path visits every target, so there is one span per token.
    spans = torchaudio.functional.merge_tokens(labels[0], scores[0].exp())
    assert len(spans) == len(flat), (len(spans), len(flat))
    spans = [sp for sp, k in zip(spans, keep) if k]
    out, i = [], 0
    for u in units:
        ws = []
        for w in u.tokens:
            ws.append((spans[i].start, spans[i + len(w) - 1].end))
            i += len(w)
        out.append(ws)
    return out


def align_surah(
    emis: torch.Tensor, units: list[Words], star: int, fps: float, lead: bool = False
) -> list[list[tuple[int, int]]]:
    """`lead`: units[0] is the basmalah, which may be preceded and followed by
    audio the text lacks (an announcement, the isti'adha, al-Fatiha)."""
    total = sum(u.letters for u in units)
    sec_per_letter = emis.shape[0] / fps / max(1, total)
    result: list[list[tuple[int, int]]] = []
    cur, i = 0, 0
    while i < len(units):
        j, exp = i, 0.0
        while j < len(units) and (exp < BLOCK_S or j == i):
            exp += units[j].letters * sec_per_letter
            j += 1
        k, ahead = j, 0.0
        while k < len(units) and ahead < AHEAD_S:
            ahead += units[k].letters * sec_per_letter
            k += 1
        end = emis.shape[0] if k >= len(units) else min(
            emis.shape[0], cur + int(((exp + ahead) * 1.3 + 10) * fps)
        )
        spans = align_block(emis[cur:end], units[i:k], star, lead and i == 0)
        block = [[(cur + a, cur + b) for a, b in ws] for ws in spans[: j - i]]
        result += block
        cur = block[-1][-1][1]
        i = j
    return result


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("audio", type=Path, help="folder of SSS.mp3")
    ap.add_argument("out", type=Path)
    ap.add_argument("--surah", type=int, action="append")
    ap.add_argument("--cache", type=Path, help="folder for per-surah model output (SSS.pt)")
    ap.add_argument("--threads", type=int, help="torch threads (several runs side by side go faster)")
    args = ap.parse_args()

    if args.threads:
        torch.set_num_threads(args.threads)
    bundle = torchaudio.pipelines.MMS_FA
    model = bundle.get_model(with_star=True).eval().to(DEVICE)
    print(f"model on {DEVICE}", flush=True)
    vocab = bundle.get_dict(star="*")
    star = vocab["*"]
    roman = uroman.Uroman()
    verses = json.loads((APP / "public" / "data" / "verses.json").read_text("utf-8"))
    surahs = json.loads((APP / "public" / "data" / "surahs.json").read_text("utf-8"))

    out = json.loads(args.out.read_text("utf-8")) if args.out.exists() else {}
    t0 = time.time()
    todo = args.surah or list(range(1, 115))
    for n, s in enumerate(todo, 1):
        meta = surahs[s - 1]
        vs = [v for v in verses if int(v["s"]) == s]
        units = [Words(v["ar"], roman, vocab) for v in vs]
        lead = 1 if meta.get("hasBismillah") and s != 1 else 0
        if lead:
            units.insert(0, Words(BASMALAH, roman, vocab))
        cached = args.cache / f"{s:03d}.pt" if args.cache else None
        if cached and cached.exists():
            emis, fps = torch.load(cached)
            emis = emis.float()
        else:
            wav = decode(args.audio / f"{s:03d}.mp3")
            emis = emissions(model, wav)
            fps = emis.shape[0] / (len(wav) / SR)
            if cached:
                cached.parent.mkdir(parents=True, exist_ok=True)
                torch.save((emis.half(), fps), cached)
        spans = align_surah(emis, units, star, fps, bool(lead))
        ms = lambda f: round(f / fps * 1000)  # noqa: E731
        # The basmalah is "s:0" (not a QUL key): its own clip, so the player
        # skips whatever the file has around it.
        keyed = [(0, units[0], spans[0])] if lead else []
        keyed += [(v["a"], u, ws) for v, u, ws in zip(vs, units[lead:], spans[lead:])]
        for ayah, u, ws in keyed:
            segs, p = [], 1
            for (a, b), q in zip(ws, u.qc):
                for _ in range(q):
                    segs.append([p, ms(a), ms(b)])
                    p += 1
            out[f"{s}:{ayah}"] = {
                "segments": segs,
                "timestamp_from": segs[0][1],
                "timestamp_to": segs[-1][2],
            }
        args.out.write_text(json.dumps(out, separators=(",", ":")), "utf-8")
        el = time.time() - t0
        eta = el / n * (len(todo) - n)
        print(f"{n}/{len(todo)} · ({n / len(todo) * 100:.0f}%) · surah {s} · eta {int(eta // 60)}:{int(eta % 60):02d}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
