import type { ReactNode } from "react";
import {
  Bookmark as BookmarkIcon,
  Pin as PinIcon,
  ClipboardCopy,
  ExternalLink,
  Link2,
  MoreHorizontal,
  PanelRight,
  Play,
} from "lucide-react";
import type { Surah, Verse, WordByWordData } from "../../types/quran";
import type { Collection, Pin } from "../../lib/marks";
import type { TafsirGroup, AsbabEntry } from "../../data/sections";
import { alignTajweedToWords, type TajweedSegment } from "../../data/tajweed";
import { useI18n } from "../../i18n/I18nContext";
import { cx, QuietIconButton } from "../ui";
import { AyahEnd, AyahText, TajweedSegs } from "./AyahText";
import { BASMALA, boundaryLabels, type ReaderMode } from "./readerShared";

/** A translation column (one edition) as the row needs it. */
export interface RowTranslation {
  id: string;
  name: string;
  lang: string;
  rtl: boolean;
  data: (string | null)[] | null;
  loading: boolean;
}

/** Everything a verse row reads, built once per render by ReaderView. */
export interface RowContext {
  mode: ReaderMode;
  surahMap: Map<number, Surah>;
  verses: Verse[];
  /** Section headings: surah header when the scope spans surahs. */
  multiSurah: boolean;
  showTranslit: boolean;
  showWords: boolean;
  showTajweed: boolean;
  translationScale: number;
  /** Primary translation (ayah mode) or the compared editions (compare mode). */
  translations: RowTranslation[];
  translit: (string | null)[] | null;
  tajweed: (string | null)[] | null;
  wordByWord: WordByWordData | null;
  alignCache: Map<string, TajweedSegment[][] | null>;
  glossLang: string;
  /** Inline tafsir under each ayah (or passage), when on. */
  inlineTafsir: null | {
    kind: "ayah" | "grouped";
    lang: string;
    source: string;
    loading: boolean;
    ayah: (string | null)[] | null;
    groupAt: (id: number, prevId: number | null) => TafsirGroup | null;
  };
  /** Inline asbab, when on: entries keyed by their first ayah. */
  inlineAsbab: null | {
    byFirst: Map<number, AsbabEntry[]>;
    source: string;
    open: Set<number>;
    toggle: (id: number) => void;
  };
  themeAt: (id: number, prevId: number | null) => string | null;
  verseColor: (v: Verse) => string;
  audioOn: boolean;
  playingId: number | undefined;
  inEditedRange: (id: number) => boolean;
  playFrom: (id: number) => void;
  /** Pins on an ayah and collections holding it. */
  marksAt: Map<number, { pins: Pin[]; collections: Collection[] }>;
  /** Open the sheet that pins this ayah or files it in collections. */
  openMark: (id: number, kind: "pin" | "collection") => void;
  copied: { id: number; ok: boolean; what: "text" | "link" } | null;
  copyText: (v: Verse) => void;
  copyLink: (v: Verse) => void;
  selectedId: number | undefined;
  openContext: (id: number) => void;
  menuFor: number | null;
  setMenuFor: (id: number | null) => void;
}

/** A surah's title line inside a multi-surah scope (and in mushaf pages). */
export function SurahHeading({ s }: { s: Surah | undefined }) {
  if (!s) return null;
  return (
    <div className="mb-1 mt-4 flex items-baseline gap-2 border-b border-line pb-1.5">
      <span className="text-base font-semibold text-ink">
        {s.number}. {s.nameEn}
      </span>
      <span lang="ar" dir="rtl" className="font-arabic text-lg text-ink-muted">
        {s.nameAr}
      </span>
    </div>
  );
}

export function Basmala() {
  return (
    <p lang="ar" dir="rtl" className="quran-text mb-1 text-center text-ink">
      {BASMALA}
    </p>
  );
}

function WordByWord({ v, ctx }: { v: Verse; ctx: RowContext }) {
  const ws = ctx.wordByWord?.[v.id];
  const marked = ctx.showTajweed ? ctx.tajweed?.[v.id] : null;
  if (!ws)
    return (
      <p lang="ar" dir="rtl" className="quran-text text-ink">
        <AyahText v={v} tajweed={marked} />
      </p>
    );
  // Tajweed colours cut to match the word-by-word items. If the texts can't
  // be aligned the items are shown uncoloured — never the whole ayah twice.
  let aligned: TajweedSegment[][] | null = null;
  if (marked) {
    const key = `${ctx.glossLang}:${v.id}`;
    if (!ctx.alignCache.has(key))
      ctx.alignCache.set(
        key,
        alignTajweedToWords(
          marked,
          ws.map(([ar]) => ar),
        ),
      );
    aligned = ctx.alignCache.get(key) ?? null;
  }
  return (
    <div lang="ar" dir="rtl" className="flex flex-wrap items-start gap-x-5 gap-y-2">
      {ws.map(([ar, gloss], i) => (
        <span key={i} className="flex flex-col items-center">
          <span className="quran-text leading-tight text-ink">
            {aligned ? <TajweedSegs segs={aligned[i]} /> : ar}
          </span>
          <span
            lang={ctx.glossLang}
            dir="ltr"
            className="mt-0.5 max-w-[9rem] text-center text-xs leading-tight text-ink-subtle"
          >
            {gloss}
          </span>
        </span>
      ))}
      <span className="quran-text leading-tight">
        <AyahEnd n={v.a} />
      </span>
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  href,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const cls =
    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-surface-sunken";
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls} onClick={onClick}>
      <span className="text-ink-subtle">{icon}</span>
      {children}
    </a>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      <span className="text-ink-subtle">{icon}</span>
      {children}
    </button>
  );
}

/** One ayah in the ayah-by-ayah and compare layouts. */
export function VerseRow({
  v,
  prev,
  ctx,
}: {
  v: Verse;
  prev: Verse | null;
  ctx: RowContext;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const s = ctx.surahMap.get(v.s);
  const ref = `${v.s}:${v.a}`;
  const labels = boundaryLabels(prev, v, t.scope);
  const theme = ctx.themeAt(v.id, prev?.id ?? null);
  const marks = ctx.marksAt.get(v.id);
  const pin = marks?.pins[0];
  const held = marks?.collections ?? [];
  const notes = held.flatMap((c) => {
    const note = c.items.find((i) => i.id === v.id)?.note;
    return note ? [{ key: c.id, name: c.name, note }] : [];
  });
  const playing = ctx.audioOn && ctx.playingId === v.id;
  const selected = ctx.selectedId === v.id;
  const menuOpen = ctx.menuFor === v.id;
  const marked = ctx.showTajweed ? ctx.tajweed?.[v.id] : null;
  const asbab = ctx.inlineAsbab?.byFirst.get(v.id);
  const close = () => ctx.setMenuFor(null);
  const exception = v.p
    ? t.reader.exceptionTitle(
        v.p === "Hijra" ? t.reader.exHijra : t.reader.exAyah(i18n.place(v.p)),
        i18n.place(s?.type ?? ""),
      )
    : undefined;
  const trSize = { fontSize: `calc(1.0625rem * ${ctx.translationScale})` };

  return (
    <>
      {ctx.multiSurah && (!prev || prev.s !== v.s) && <SurahHeading s={s} />}
      {labels.length > 0 && (
        <div className="my-3 flex items-center gap-3 text-xs font-medium text-ink-subtle">
          <span className="h-px flex-1 bg-line" />
          {labels.join(" · ")}
          <span className="h-px flex-1 bg-line" />
        </div>
      )}
      {v.a === 1 && s?.hasBismillah && <Basmala />}
      {theme && <p className="mb-1 mt-3 text-sm font-semibold text-ink-muted">{theme}</p>}
      <article
        aria-label={ref}
        className={cx(
          "relative border-b border-line/70 py-3 pl-3 pr-1 transition-colors",
          selected && "bg-surface-sunken/70 dark:bg-surface/60",
        )}
        style={
          playing
            ? { boxShadow: "inset 3px 0 0 rgb(var(--rubric))" }
            : ctx.audioOn && ctx.inEditedRange(v.id)
              ? { boxShadow: "inset 2px 0 0 rgb(var(--illumination) / 0.6)" }
              : undefined
        }
      >
        <div className="mb-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => ctx.openContext(v.id)}
            aria-label={t.reader.openContext(ref)}
            title={exception ?? t.reader.openContext(ref)}
            className="inline-flex min-w-8 items-center justify-center rounded-full border border-line px-2 py-0.5 text-sm tabular-nums text-ink-muted hover:border-ink-subtle hover:text-ink touch:min-h-11 touch:min-w-11 touch:border-0"
          >
            {v.a}
            {v.p && <span aria-hidden>{v.p === "Hijra" ? " ⇢" : " •"}</span>}
          </button>
          {v.sajda === 1 && (
            <span className="text-xs font-semibold text-rubric">{t.reader.sajda}</span>
          )}
          {asbab && ctx.inlineAsbab && (
            <button
              type="button"
              onClick={() => ctx.inlineAsbab!.toggle(v.id)}
              aria-expanded={ctx.inlineAsbab.open.has(v.id)}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-illumination hover:bg-surface-sunken touch:min-h-11"
            >
              {t.reader.asbab} ({asbab.reduce((n, e) => n + e.texts.length, 0)})
            </button>
          )}
          <span className="ml-auto flex items-center">
            {ctx.copied?.id === v.id && (
              <span
                className={cx(
                  "mr-1 text-xs",
                  ctx.copied.ok ? "text-madani" : "text-rubric",
                )}
                role="status"
              >
                {ctx.copied.ok ? t.reader.copied(ctx.copied.what) : t.reader.copyFailed}
              </span>
            )}
            {ctx.audioOn && (
              <QuietIconButton
                label={`${t.reader.audio.playFrom} ${ref}`}
                onClick={() => ctx.playFrom(v.id)}
                className={playing ? "text-illumination" : undefined}
              >
                <Play size={16} />
              </QuietIconButton>
            )}
            <QuietIconButton
              label={pin ? t.marks.pinnedAs(pin.name) : t.marks.pinAyah}
              onClick={() => ctx.openMark(v.id, "pin")}
            >
              <PinIcon
                size={16}
                style={pin ? { color: pin.color } : undefined}
                fill={pin ? pin.color : "none"}
              />
            </QuietIconButton>
            <QuietIconButton
              label={
                held.length
                  ? t.marks.savedIn(held.map((c) => c.name).join(", "))
                  : t.marks.saveAyah
              }
              onClick={() => ctx.openMark(v.id, "collection")}
            >
              <BookmarkIcon
                size={16}
                style={held[0] ? { color: held[0].color } : undefined}
                fill={held[0] ? held[0].color : "none"}
              />
            </QuietIconButton>
            <QuietIconButton
              label={t.reader.openContext(ref)}
              onClick={() => ctx.openContext(v.id)}
            >
              <PanelRight size={16} />
            </QuietIconButton>
            <span className="relative">
              <QuietIconButton
                label={t.reader.moreActions}
                aria-expanded={menuOpen}
                aria-haspopup="true"
                onClick={() => ctx.setMenuFor(menuOpen ? null : v.id)}
              >
                <MoreHorizontal size={16} />
              </QuietIconButton>
              {menuOpen && (
                <div
                  data-row-menu
                  className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-line bg-surface p-1 shadow-float"
                >
                  <MenuItem
                    icon={<ClipboardCopy size={15} />}
                    onClick={() => {
                      ctx.copyText(v);
                      close();
                    }}
                  >
                    {t.reader.copyText}
                  </MenuItem>
                  <MenuItem
                    icon={<Link2 size={15} />}
                    onClick={() => {
                      ctx.copyLink(v);
                      close();
                    }}
                  >
                    {t.reader.copyLink}
                  </MenuItem>
                  <MenuItem
                    icon={<ExternalLink size={15} />}
                    href={`https://quran.com/${v.s}/${v.a}`}
                    onClick={close}
                  >
                    {t.reader.openQc}
                  </MenuItem>
                </div>
              )}
            </span>
          </span>
        </div>

        {notes.map((x) => (
          <p key={x.key} className="mb-2 text-sm italic text-ink-muted">
            {t.reader.notePrefix(x.note)}
          </p>
        ))}

        {ctx.showWords ? (
          <WordByWord v={v} ctx={ctx} />
        ) : (
          <p lang="ar" dir="rtl" className="quran-text text-ink">
            <AyahText v={v} tajweed={marked} />
          </p>
        )}

        {ctx.showTranslit && ctx.translit?.[v.id] && (
          <p className="mt-1 max-w-[68ch] font-reading text-base italic text-ink-muted">
            {ctx.translit[v.id]}
          </p>
        )}

        {ctx.translations[0] && (
          <p
            lang={ctx.translations[0].lang}
            dir={ctx.translations[0].rtl ? "rtl" : "ltr"}
            className="mt-2 max-w-[68ch] font-reading leading-relaxed text-ink"
            style={trSize}
          >
            {ctx.translations[0].loading ? "…" : (ctx.translations[0].data?.[v.id] ?? "")}
          </p>
        )}

        {ctx.inlineTafsir && <InlineTafsir v={v} prev={prev} ctx={ctx} />}

        {asbab && ctx.inlineAsbab?.open.has(v.id) && (
          <div className="mt-2 rounded-lg bg-surface-sunken p-3 dark:bg-surface">
            {asbab.map((e) => {
              const last = ctx.verses[e.last - 1];
              return (
                <div key={e.last}>
                  {e.last !== e.first && last && (
                    <p className="mb-1 text-xs text-ink-subtle">
                      {t.reader.versesRange(`${v.s}:${v.a}–${last.a}`)}
                    </p>
                  )}
                  {e.texts.map((txt, i) => (
                    <p
                      key={i}
                      lang="ar"
                      dir="rtl"
                      className="mb-2 whitespace-pre-line font-arabic text-base leading-loose text-ink"
                    >
                      {txt}
                    </p>
                  ))}
                </div>
              );
            })}
            <p className="text-xs text-ink-subtle">
              {t.reader.arabicOnly} {ctx.inlineAsbab.source}.
            </p>
          </div>
        )}
      </article>
    </>
  );
}

function InlineTafsir({
  v,
  prev,
  ctx,
}: {
  v: Verse;
  prev: Verse | null;
  ctx: RowContext;
}) {
  const { t } = useI18n();
  const tf = ctx.inlineTafsir!;
  if (tf.loading) return <p className="mt-2 text-sm text-ink-subtle">…</p>;
  if (tf.kind === "ayah") {
    const text = tf.ayah?.[v.id];
    if (!text) return null;
    return (
      <p
        lang={tf.lang}
        dir={tf.lang === "ar" ? "rtl" : "ltr"}
        className="mt-2 rounded-lg bg-surface-sunken p-3 font-arabic text-base leading-loose text-ink-muted dark:bg-surface"
      >
        {text}
      </p>
    );
  }
  const g = tf.groupAt(v.id, prev?.id ?? null);
  if (!g) return null;
  return (
    <div lang={tf.lang} className="mt-2 rounded-lg bg-surface-sunken p-3 dark:bg-surface">
      {g.to !== g.from && (
        <p className="mb-1 text-xs font-medium text-ink-subtle">
          {t.reader.versesRange(`${g.s}:${g.from}–${g.to}`)}
        </p>
      )}
      <p
        className="max-w-[68ch] whitespace-pre-line font-reading text-ink-muted"
        style={{ fontSize: `calc(0.9375rem * ${ctx.translationScale})` }}
      >
        {g.text}
      </p>
      <p className="mt-1 text-xs text-ink-subtle">{tf.source}.</p>
    </div>
  );
}
