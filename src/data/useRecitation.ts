import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Verse } from "../types/quran";
import { isNativeApp } from "./audioStore";
import { bindMediaControls, clearNowPlaying, showNowPlaying } from "./mediaControls";
import { setListening } from "../lib/readingStore";
import {
  RECITER_INFO,
  WEB_AUDIO_BASE,
  advance,
  audioIndexUrl,
  ayahAudioUrl,
  basmalahAudioUrl,
  cursorAt,
  type Cursor,
  type LoopRange,
  type RecitationOptions,
  type ReciterId,
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

/** In the Android app every known reciter is offered: its audio is
 *  downloaded per surah into device storage (data/audioStore.ts). */
function nativeIndex(id: string): ReciterIndex | null {
  const info = RECITER_INFO[id as ReciterId];
  return info
    ? { id, ...info, recorded: null, files: 6236, total: 6236, complete: true }
    : null;
}

/** Indexes of the reciters whose audio is present locally, in `ids` order;
 *  null while checking. Empty on a static host; every reciter in the app. */
export function useReciters(ids: readonly string[]): ReciterIndex[] | null {
  const [list, setList] = useState<ReciterIndex[] | null>(null);
  const key = ids.join(",");
  useEffect(() => {
    if (isNativeApp()) {
      setList(
        key.split(",").flatMap((id) => {
          const ix = nativeIndex(id);
          return ix ? [ix] : [];
        }),
      );
      return;
    }
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

/** Where the audio element is, for the seek bar. It changes several times a
 *  second, so it is read through `subscribe` instead of React state (the
 *  reader would otherwise re-render on every tick). */
export interface PlayClock {
  subscribe: (fn: () => void) => () => void;
  get: () => ClockTime;
}
export interface ClockTime {
  /** The ayah loaded in the player, or null. */
  id: number | null;
  /** Seconds into the ayah (0 while its basmalah plays). */
  t: number;
  /** Bumped whenever an ayah's real length becomes known. */
  rev: number;
}

// Real lengths of the files played so far, `${reciter}/${ayah id}` → seconds.
const learned = new Map<string, number>();

export interface Recitation {
  cursor: Cursor | null;
  playing: boolean;
  error: string | null;
  /** The ayah playback stopped at because its surah isn't downloaded (app). */
  missing: number | null;
  play: (id: number) => void;
  toggle: () => void;
  stop: () => void;
  step: (delta: 1 | -1) => void;
  /** Play the current ayah again from its beginning. */
  restart: () => void;
  /** Play ayah `id` from `offset` seconds in. */
  seek: (id: number, offset: number) => void;
  clock: PlayClock;
  /** Length of an ayah in seconds: measured once played, else estimated. */
  lengthOf: (id: number) => number;
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
  base = WEB_AUDIO_BASE,
  available,
  estimate,
  describe,
}: {
  reciter: string;
  /** False stops playback (player hidden). */
  enabled: boolean;
  verses: Verse[];
  range: LoopRange;
  options: RecitationOptions;
  needsBasmalah: (id: number) => boolean;
  /** Folder URL the reciter folders live under; null while it is resolved. */
  base?: string | null;
  /** False for an ayah whose audio isn't on the device (Android app). */
  available?: (id: number) => boolean;
  /** Estimated length of an ayah in seconds, until it has been played. */
  estimate?: (id: number) => number;
  /** What the system's media controls show for an ayah. */
  describe?: (id: number) => { title: string; artist: string; album: string };
}): Recitation {
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const warmRef = useRef<HTMLAudioElement | null>(null);
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorRef = useRef<Cursor | null>(null);
  const live = useRef({
    range,
    options,
    needsBasmalah,
    verses,
    available,
    estimate,
    describe,
    reciter,
  });
  useLayoutEffect(() => {
    live.current = {
      range,
      options,
      needsBasmalah,
      verses,
      available,
      estimate,
      describe,
      reciter,
    };
  });

  // ── Clock: position inside the current ayah, outside React state ──
  const clockRef = useRef<ClockTime>({ id: null, t: 0, rev: 0 });
  const clockSubs = useRef(new Set<() => void>());
  const tick = useCallback((patch: Partial<ClockTime>) => {
    clockRef.current = { ...clockRef.current, ...patch };
    clockSubs.current.forEach((fn) => fn());
  }, []);
  const [clock] = useState<PlayClock>(() => ({
    subscribe: (fn) => {
      clockSubs.current.add(fn);
      return () => {
        clockSubs.current.delete(fn);
      };
    },
    get: () => clockRef.current,
  }));
  const lengthOf = useCallback((id: number) => {
    const { reciter: r, estimate: est } = live.current;
    return learned.get(`${r}/${id}`) ?? est?.(id) ?? 0;
  }, []);
  /** Seconds from the range's start to ayah `id`, and the range's length. */
  const rangeTimes = useCallback(
    (id: number) => {
      const { from, to } = live.current.range;
      let before = 0;
      let total = 0;
      for (let i = from; i <= to; i++) {
        const len = lengthOf(i);
        if (i < id) before += len;
        total += len;
      }
      return { before, total };
    },
    [lengthOf],
  );
  /** Tell the system's media controls what is loaded. */
  const announce = useCallback(
    (c: Cursor, isPlaying: boolean, t = 0) => {
      const d = live.current.describe?.(c.id);
      if (!d) return;
      const { before, total } = rangeTimes(c.id);
      showNowPlaying({
        ...d,
        playing: isPlaying,
        position: before + (c.basmalah ? 0 : t),
        duration: total,
        rate: live.current.options.rate,
      });
    },
    [rangeTimes],
  );

  const srcOf = useCallback(
    (c: Cursor): string | null => {
      if (base === null) return null;
      if (c.basmalah) return basmalahAudioUrl(reciter, base);
      const v = live.current.verses[c.id - 1];
      return v ? ayahAudioUrl(reciter, v.s, v.a, base) : null;
    },
    [reciter, base],
  );

  const clearGap = () => {
    if (gapTimer.current) clearTimeout(gapTimer.current);
    gapTimer.current = null;
  };

  const setAt = useCallback(
    (c: Cursor | null) => {
      cursorRef.current = c;
      setCursor(c);
      tick({ id: c ? c.id : null, t: 0 });
      if (!c) clearNowPlaying();
    },
    [tick],
  );
  // An offset to jump to once the file's metadata has loaded (seek).
  const pendingSeek = useRef(0);

  const start = useCallback(
    (c: Cursor, offset = 0) => {
      const audio = audioRef.current ?? (audioRef.current = new Audio());
      if (live.current.available && !live.current.available(c.id)) {
        clearGap();
        audio.pause();
        setPlaying(false);
        setAt(null);
        setMissing(c.id);
        return;
      }
      const src = srcOf(c);
      if (!src) return;
      clearGap();
      setError(null);
      setMissing(null);
      setAt(c);
      // Re-assigning the same src would not restart a repeat, so rewind instead.
      pendingSeek.current = 0;
      if (audio.src === new URL(src, location.href).href) audio.currentTime = offset;
      else {
        audio.src = src;
        pendingSeek.current = offset;
      }
      if (offset > 0) tick({ t: offset });
      announce(c, true, offset);
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
    [srcOf, setAt, tick, announce],
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
  }, [start, setAt]);

  // Attach listeners once the element exists; it is created on first play.
  useEffect(() => {
    if (!playing) return;
    const audio = audioRef.current;
    if (!audio) return;
    const onError = () => {
      setPlaying(false);
      setError(audio.src.split("/").pop() ?? audio.src);
    };
    const onTime = () => {
      const cur = cursorRef.current;
      if (cur && !cur.basmalah) tick({ t: audio.currentTime });
    };
    const onMeta = () => {
      const cur = cursorRef.current;
      if (pendingSeek.current > 0 && Number.isFinite(audio.duration)) {
        audio.currentTime = Math.min(pendingSeek.current, audio.duration - 0.25);
        pendingSeek.current = 0;
      }
      if (!cur || cur.basmalah || !Number.isFinite(audio.duration)) return;
      const key = `${live.current.reciter}/${cur.id}`;
      if (learned.get(key) === audio.duration) return;
      learned.set(key, audio.duration);
      tick({ rev: clockRef.current.rev + 1 });
      // The range's length is now a little more exact.
      announce(cur, !audio.paused, audio.currentTime);
    };
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
    };
  }, [playing, onEnded, tick, announce]);

  // Listening counts as reading time (lib/readingStore.ts).
  useEffect(() => {
    setListening(playing);
    return () => setListening(false);
  }, [playing]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = options.rate;
  }, [options.rate]);

  const stop = useCallback(() => {
    clearGap();
    audioRef.current?.pause();
    setPlaying(false);
    setAt(null);
  }, [setAt]);

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
      if (cur) announce(cur, false, audio?.currentTime ?? 0);
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
    announce(cur, true, audio.currentTime);
    audio.play()?.catch(() => setPlaying(false));
  }, [playing, play, onEnded, srcOf, start, announce]);

  const step = useCallback(
    (delta: 1 | -1) => {
      const cur = cursorRef.current;
      const base = cur ? cur.id : live.current.range.from - delta;
      const id = Math.min(live.current.verses.length, Math.max(1, base + delta));
      start(cursorAt(id, live.current.needsBasmalah, cur?.rangePass ?? 0));
    },
    [start],
  );

  const restart = useCallback(() => {
    const cur = cursorRef.current;
    const audio = audioRef.current;
    if (!cur || !audio) return;
    // Playing: start the ayah (not its basmalah) over. Paused: just rewind.
    if (playing) start({ ...cur, basmalah: false });
    else if (!cur.basmalah) {
      audio.currentTime = 0;
      tick({ t: 0 });
      announce(cur, false, 0);
    }
  }, [playing, start, tick, announce]);

  const seek = useCallback(
    (id: number, offset: number) => {
      const cur = cursorRef.current;
      start(
        {
          id,
          ayahPass: cur && cur.id === id ? cur.ayahPass : 0,
          rangePass: cur?.rangePass ?? 0,
          basmalah: false,
        },
        offset,
      );
    },
    [start],
  );

  // The system's media controls (notification, lock screen, headset buttons).
  const controls = useRef({ toggle, step, stop, playing });
  useLayoutEffect(() => {
    controls.current = { toggle, step, stop, playing };
  });
  useEffect(() => {
    if (!enabled) return;
    return bindMediaControls({
      play: () => !controls.current.playing && controls.current.toggle(),
      pause: () => controls.current.playing && controls.current.toggle(),
      next: () => controls.current.step(1),
      previous: () => controls.current.step(-1),
      stop: () => controls.current.stop(),
    });
  }, [enabled]);

  // Switching reciter mid-play restarts the current ayah in the new voice.
  const shownReciter = useRef(reciter);
  useEffect(() => {
    if (shownReciter.current === reciter) return;
    shownReciter.current = reciter;
    const cur = cursorRef.current;
    if (cur && playing) start(cur);
  }, [reciter, playing, start]);

  return {
    cursor,
    playing,
    error,
    missing,
    play,
    toggle,
    stop,
    step,
    restart,
    seek,
    clock,
    lengthOf,
  };
}
