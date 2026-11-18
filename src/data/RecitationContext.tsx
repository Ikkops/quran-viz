import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Surah, Verse } from "../types/quran";
import { downloadSurahs, isNativeApp, useAudioDownloads } from "./audioStore";
import {
  DEFAULT_RECITATION,
  LOCAL_RECITERS,
  RECITERS,
  estimateAyahSeconds,
  outsideRange,
  sanitizeRecitationOptions,
  type LoopRange,
  type RecitationOptions,
  type ReciterId,
} from "./recitation";
import {
  useRecitation,
  useReciters,
  type Recitation,
  type ReciterIndex,
} from "./useRecitation";
import { persisted, usePersistentState } from "../lib/usePersistentState";
import { useReadingTimer } from "../lib/readingStore";
import { useI18n } from "../i18n/I18nContext";

export interface RecitationContextValue {
  rec: Recitation;
  /** Reciters with audio here (null while checking), the one in use, its id. */
  reciters: ReciterIndex[] | null;
  reciter: ReciterIndex | null;
  reciterId: ReciterId;
  /** The reciter's display name ("" while none). */
  reciterName: string;
  /** App: show the download offer (size, Download button) instead of
   *  downloading by itself when Play needs audio not on the device
   *  (`qv.audio.confirmDownload`). */
  confirmDownload: boolean;
  setConfirmDownload: (on: boolean) => void;
  /** The reader's player shown (`qv.reader.audio`); hiding it stops playback. */
  showAudio: boolean;
  setShowAudio: (on: boolean) => void;
  audioOpts: RecitationOptions;
  setAudioOpts: (o: RecitationOptions) => void;
  reciterPref: string;
  setReciter: (id: string) => void;
  /** An edited loop range; null follows the scope the reader last showed. */
  loopRange: LoopRange | null;
  setLoopRange: (r: LoopRange | null) => void;
  /** The range the reader's view gives the player (its scope, or the mushaf
   *  page in view); the reader reports it while open. */
  viewRange: LoopRange;
  setScopeRange: (r: LoopRange) => void;
  readerOpen: boolean;
}

const Ctx = createContext<RecitationContextValue | null>(null);

export function useRecitationContext(): RecitationContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRecitationContext needs a RecitationProvider");
  return v;
}

/** Owns the recitation above the reader, so it keeps playing (and keeps its
 *  range, options and sleep timer) while the reader is closed. The reader
 *  pushes its scope's range; the last one pushed stays in use after it closes. */
export function RecitationProvider({
  surahs,
  verses,
  readerOpen,
  onRead,
  children,
}: {
  surahs: Surah[];
  verses: Verse[];
  readerOpen: boolean;
  /** The ayah being recited while the reader is closed (last read). */
  onRead?: (id: number) => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [showAudio, setShowAudio] = usePersistentState(
    "qv.reader.audio",
    true,
    persisted.bool,
  );
  const [audioOpts, setAudioOpts] = usePersistentState(
    "qv.audio.options",
    DEFAULT_RECITATION,
    sanitizeRecitationOptions,
  );
  const [reciterPref, setReciter] = usePersistentState<string>(
    "qv.audio.reciter",
    RECITERS[0],
    persisted.oneOf(RECITERS),
  );
  const [confirmDownload, setConfirmDownload] = usePersistentState(
    "qv.audio.confirmDownload",
    false,
    persisted.bool,
  );
  const [loopRange, setLoopRange] = useState<LoopRange | null>(null);
  const [scopeRange, setScope] = useState<LoopRange>({ from: 1, to: 1 });
  const setScopeRange = useCallback(
    (r: LoopRange) =>
      setScope((cur) => (cur.from === r.from && cur.to === r.to ? cur : r)),
    [],
  );

  const native = isNativeApp();
  // The app offers the whole catalogue; the desktop, the folders under audio/.
  const reciters = useReciters(native ? RECITERS : LOCAL_RECITERS);
  // The stored choice, or the first reciter present locally.
  const reciter = reciters?.find((r) => r.id === reciterPref) ?? reciters?.[0] ?? null;
  const reciterId = (reciter?.id ?? reciterPref) as ReciterId;
  const downloads = useAudioDownloads([reciterId]);
  const onDevice = downloads.downloaded[reciterId];
  const range = loopRange ?? scopeRange;
  // The surahs the range plays: Play waits until all of them are on the
  // device, so it never stops halfway through for a download.
  const rangeSurahs = useMemo(() => {
    const out: number[] = [];
    const last = verses[range.to - 1]?.s ?? 0;
    for (let n = verses[range.from - 1]?.s ?? 1; n <= last; n++) out.push(n);
    return out;
  }, [verses, range.from, range.to]);
  const rangeReady = rangeSurahs.every((n) => !!onDevice?.[n]);
  const available = useCallback(
    (id: number) =>
      !native ||
      (!!onDevice?.[verses[id - 1]?.s ?? 0] && (rangeReady || outsideRange(id, range))),
    [native, onDevice, verses, rangeReady, range],
  );
  const surahMap = useMemo(() => new Map(surahs.map((s) => [s.id, s])), [surahs]);
  const needsBasmalah = useCallback(
    (id: number) => {
      const v = verses[id - 1];
      return !!v && v.a === 1 && !!surahMap.get(v.s)?.hasBismillah;
    },
    [verses, surahMap],
  );
  const totalLetters = useMemo(
    () => surahs.reduce((n, x) => n + x.letterCount, 0),
    [surahs],
  );
  // Ayah lengths for the seek bar, until the real ones are known.
  const estimate = useCallback(
    (id: number) => estimateAyahSeconds(reciterId, verses[id - 1]?.l ?? 0, totalLetters),
    [reciterId, verses, totalLetters],
  );
  const reciterName = reciter?.name ?? "";
  // What the system's media controls show: "Qaf 50:16" by the reciter.
  const describe = useCallback(
    (id: number) => {
      const v = verses[id - 1];
      const name = v ? (surahMap.get(v.s)?.name ?? "") : "";
      return {
        title: v ? `${name} ${v.s}:${v.a}` : "",
        artist: reciterName,
        album: t.app.titleShort,
      };
    },
    [verses, surahMap, reciterName, t],
  );

  // Play needed an ayah that isn't on the device: download its surah first,
  // then the other surahs of the range playing.
  const onMissing = useCallback(
    (id: number) => {
      const first = verses[id - 1]?.s;
      if (!first) return;
      const ns = [first, ...rangeSurahs.filter((n) => n !== first)];
      downloadSurahs(
        reciterId,
        ns.flatMap((n) => {
          const x = surahMap.get(n);
          return x
            ? [{ surah: n, ayahCount: x.ayahCount, hasBismillah: !!x.hasBismillah }]
            : [];
        }),
      );
    },
    [verses, rangeSurahs, reciterId, surahMap],
  );

  const rec = useRecitation({
    reciter: reciterId,
    enabled: showAudio,
    verses,
    range,
    options: audioOpts,
    needsBasmalah,
    base: native ? downloads.base : undefined,
    available: native ? available : undefined,
    onMissing: native && !confirmDownload ? onMissing : undefined,
    estimate,
    describe,
  });

  // With the reader closed, listening still counts as reading time and the
  // recited ayah is the last read (the reader does both while open).
  useReadingTimer(!readerOpen && rec.playing);
  const onReadRef = useRef(onRead);
  useLayoutEffect(() => {
    onReadRef.current = onRead;
  });
  const playingId = rec.cursor?.id;
  useEffect(() => {
    if (!readerOpen && playingId) onReadRef.current?.(playingId);
  }, [readerOpen, playingId]);

  const value: RecitationContextValue = {
    rec,
    reciters,
    reciter,
    reciterId,
    reciterName,
    confirmDownload,
    setConfirmDownload,
    showAudio,
    setShowAudio,
    audioOpts,
    setAudioOpts,
    reciterPref,
    setReciter,
    loopRange,
    setLoopRange,
    viewRange: scopeRange,
    setScopeRange,
    readerOpen,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
