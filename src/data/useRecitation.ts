import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Verse } from "../types/quran";
import {
  advance,
  audioIndexUrl,
  ayahAudioUrl,
  basmalahAudioUrl,
  cursorAt,
  type Cursor,
  type LoopRange,
  type RecitationOptions,
} from "./recitation";

export type { RecitationOptions };

/** `audio/<reciter>/index.json`, written by scripts/fetch_audio.py. */
export interface ReciterIndex {
  id: string;
  name: string;
  nameAr: string;
  bitrate: number;
  /** Where the MP3s were published (from their ID3 tags). */
  origin?: string;
  /** Recording date, when a source gives one (none does so far). */
  recorded?: string | null;
  files: number;
  total: number;
  complete: boolean;
}

// Per reciter: the index, or null when the audio folder isn't there (Android,
// a static host, or not downloaded yet).
const indexCache = new Map<string, Promise<ReciterIndex | null>>();

function loadIndex(reciter: string): Promise<ReciterIndex | null> {
  let p = indexCache.get(reciter);
  if (!p) {
    p = fetch(audioIndexUrl(reciter))
      .then((r) => (r.ok ? (r.json() as Promise<ReciterIndex>) : null))
      .then((ix) => (ix && ix.files > 0 ? ix : null))
      .catch(() => null);
    indexCache.set(reciter, p);
  }
  return p;
}

/** Indexes of the reciters whose audio is present locally, in `ids` order;
 *  null while checking. Empty on Android or a static host. */
export function useReciters(ids: readonly string[]): ReciterIndex[] | null {
  const [list, setList] = useState<ReciterIndex[] | null>(null);
  const key = ids.join(",");
  useEffect(() => {
    let alive = true;
    Promise.all(key.split(",").map(loadIndex)).then(
      (all) => alive && setList(all.filter((ix): ix is ReciterIndex => !!ix)),
    );
    return () => {
      alive = false;
    };
  }, [key]);
  return list;
}

export interface Recitation {
  cursor: Cursor | null;
  playing: boolean;
  error: string | null;
  play: (id: number) => void;
  toggle: () => void;
  stop: () => void;
  step: (delta: 1 | -1) => void;
}

/** Per-ayah playback through one <audio> element, looping over `range`.
 *  `range` and `options` are read when each file ends, so changing them never
 *  interrupts the ayah that is playing. */
export function useRecitation({
  reciter,
  enabled,
  verses,
  range,
  options,
  needsBasmalah,
}: {
  reciter: string;
  /** False stops playback (player hidden). */
  enabled: boolean;
  verses: Verse[];
  range: LoopRange;
  options: RecitationOptions;
  needsBasmalah: (id: number) => boolean;
}): Recitation {
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const warmRef = useRef<HTMLAudioElement | null>(null);
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorRef = useRef<Cursor | null>(null);
  const live = useRef({ range, options, needsBasmalah, verses });
  useLayoutEffect(() => {
    live.current = { range, options, needsBasmalah, verses };
  });

  const srcOf = useCallback(
    (c: Cursor): string | null => {
      if (c.basmalah) return basmalahAudioUrl(reciter);
      const v = live.current.verses[c.id - 1];
      return v ? ayahAudioUrl(reciter, v.s, v.a) : null;
    },
    [reciter],
  );

  const clearGap = () => {
    if (gapTimer.current) clearTimeout(gapTimer.current);
    gapTimer.current = null;
  };

  const setAt = (c: Cursor | null) => {
    cursorRef.current = c;
    setCursor(c);
  };

  const start = useCallback(
    (c: Cursor) => {
      const audio = audioRef.current ?? (audioRef.current = new Audio());
      const src = srcOf(c);
      if (!src) return;
      clearGap();
      setError(null);
      setAt(c);
      // Re-assigning the same src would not restart a repeat, so rewind instead.
      if (audio.src === new URL(src, location.href).href) audio.currentTime = 0;
      else audio.src = src;
      audio.playbackRate = live.current.options.rate;
      setPlaying(true);
      const p = audio.play();
      if (p)
        p.catch((e: unknown) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setPlaying(false);
          setError(src.split("/").pop() ?? src);
        });
      // Warm the cache with the next file so the gap between ayahs stays short.
      const { range: r, options: o, needsBasmalah: nb } = live.current;
      const nxt = advance(c, r, o, nb);
      const nsrc = nxt && srcOf(nxt);
      if (nsrc && nsrc !== src) {
        const warm = warmRef.current ?? (warmRef.current = new Audio());
        warm.preload = "auto";
        warm.src = nsrc;
      }
    },
    [srcOf],
  );

  const onEnded = useCallback(() => {
    const cur = cursorRef.current;
    if (!cur) return;
    const { range: r, options: o, needsBasmalah: nb } = live.current;
    const nxt = advance(cur, r, o, nb);
    if (!nxt) {
      setPlaying(false);
      setAt(null);
      return;
    }
    // No gap between the basmalah and its ayah.
    const gap = cur.basmalah ? 0 : o.gap;
    if (gap > 0) gapTimer.current = setTimeout(() => start(nxt), gap * 1000);
    else start(nxt);
  }, [start]);

  // Attach listeners once the element exists; it is created on first play.
  useEffect(() => {
    if (!playing) return;
    const audio = audioRef.current;
    if (!audio) return;
    const onError = () => {
      setPlaying(false);
      setError(audio.src.split("/").pop() ?? audio.src);
    };
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [playing, onEnded]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = options.rate;
  }, [options.rate]);

  const stop = useCallback(() => {
    clearGap();
    audioRef.current?.pause();
    setPlaying(false);
    setAt(null);
  }, []);

  // Closing the reader (or turning the player off) silences it.
  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);
  useEffect(
    () => () => {
      clearGap();
      audioRef.current?.pause();
      audioRef.current = null;
      warmRef.current = null;
    },
    [],
  );

  const play = useCallback(
    (id: number) => start(cursorAt(id, live.current.needsBasmalah)),
    [start],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    const cur = cursorRef.current;
    if (playing) {
      clearGap();
      audio?.pause();
      setPlaying(false);
      return;
    }
    if (!cur || !audio) {
      play(live.current.range.from);
      return;
    }
    // Paused during the gap after a file ended: move on rather than replay it.
    if (audio.ended) {
      setPlaying(true);
      onEnded();
      return;
    }
    // Reciter changed while paused: restart this ayah in the new voice.
    const want = srcOf(cur);
    if (want && audio.src !== new URL(want, location.href).href) {
      start(cur);
      return;
    }
    setPlaying(true);
    audio.play()?.catch(() => setPlaying(false));
  }, [playing, play, onEnded, srcOf, start]);

  const step = useCallback(
    (delta: 1 | -1) => {
      const cur = cursorRef.current;
      const base = cur ? cur.id : live.current.range.from - delta;
      const id = Math.min(live.current.verses.length, Math.max(1, base + delta));
      start(cursorAt(id, live.current.needsBasmalah, cur?.rangePass ?? 0));
    },
    [start],
  );

  // Switching reciter mid-play restarts the current ayah in the new voice.
  const shownReciter = useRef(reciter);
  useEffect(() => {
    if (shownReciter.current === reciter) return;
    shownReciter.current = reciter;
    const cur = cursorRef.current;
    if (cur && playing) start(cur);
  }, [reciter, playing, start]);

  return { cursor, playing, error, play, toggle, stop, step };
}
