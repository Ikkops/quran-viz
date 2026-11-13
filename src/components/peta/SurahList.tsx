import { useRef, type ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import type { Surah } from "../../types/quran";
import type { Palette } from "../../theme/palettes";
import type { PlaceException } from "../../data/selectors";
import type { DivisionCard } from "../../data/sections";
import { placeColor } from "../charts/common";
import { useI18n } from "../../i18n/I18nContext";
import { useElementWidth } from "../../lib/useElementWidth";
import { cx } from "../ui";
import { PlaceStrip } from "../cards/SurahCard";

export type SurahSort = "mushaf" | "revelation" | "timeline" | "ayahs" | "words";

/** Below this list width (CSS px) the list keeps number, name and ayahs only. */
const COMPACT_PX = 640;

function SortHeader({
  label,
  sort,
  current,
  onSort,
  align = "left",
}: {
  label: string;
  sort: SurahSort;
  current: SurahSort;
  onSort: (s: SurahSort) => void;
  align?: "left" | "right";
}) {
  const { t } = useI18n();
  const on = current === sort;
  return (
    <th
      scope="col"
      aria-sort={
        on
          ? sort === "mushaf" || sort === "revelation"
            ? "ascending"
            : "descending"
          : "none"
      }
      className={cx("px-2 py-2 font-medium", align === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={() => onSort(sort)}
        title={t.browse.sortedBy(label)}
        className={cx(
          "inline-flex items-center gap-1 rounded hover:text-ink touch:min-h-11",
          on ? "text-ink" : "text-ink-subtle",
        )}
      >
        {label}
        {on && <ArrowDown size={13} aria-hidden />}
      </button>
    </th>
  );
}

function Th({ children, right }: { children?: ReactNode; right?: boolean }) {
  return (
    <th
      scope="col"
      className={cx("px-2 py-2 font-medium text-ink-subtle", right && "text-right")}
    >
      {children}
    </th>
  );
}

/**
 * Surahs as one dense, sortable list: number, names and meaning, place,
 * revelation order, ayahs, words, and a length bar (words, against the
 * longest) that marks exception ayahs in their own place colour.
 */
export function SurahList({
  surahs,
  exceptions,
  palette,
  sort,
  onSort,
  onOpen,
}: {
  surahs: Surah[];
  exceptions: Map<number, PlaceException[]>;
  palette: Palette;
  sort: SurahSort;
  onSort: (s: SurahSort) => void;
  onOpen: (id: number) => void;
}) {
  const i = useI18n();
  const { t, n } = i;
  const wrap = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrap);
  const compact = width > 0 && width < COMPACT_PX;
  const maxWords = Math.max(1, ...surahs.map((s) => s.wordCount));
  const c = t.browse.cols;

  return (
    <div ref={wrap} className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-line text-left">
          <tr>
            <SortHeader label={c.no} sort="mushaf" current={sort} onSort={onSort} />
            <Th>{c.surah}</Th>
            {!compact && <Th>{c.place}</Th>}
            {!compact && (
              <SortHeader
                label={c.revealed}
                sort="revelation"
                current={sort}
                onSort={onSort}
                align="right"
              />
            )}
            <SortHeader
              label={c.ayahs}
              sort="ayahs"
              current={sort}
              onSort={onSort}
              align="right"
            />
            {!compact && (
              <SortHeader
                label={c.words}
                sort="words"
                current={sort}
                onSort={onSort}
                align="right"
              />
            )}
            {!compact && <Th>{c.length}</Th>}
          </tr>
        </thead>
        <tbody>
          {surahs.map((s) => {
            const colour = placeColor(s.type, palette);
            const bar = (
              <div style={{ width: `${Math.max(2, (s.wordCount / maxWords) * 100)}%` }}>
                <PlaceStrip
                  surah={s}
                  exceptions={exceptions.get(s.id) ?? []}
                  palette={palette}
                />
              </div>
            );
            return (
              <tr
                key={s.id}
                onClick={() => onOpen(s.id)}
                className="cursor-pointer border-b border-line/70 hover:bg-surface-sunken dark:hover:bg-surface"
              >
                <td className="w-12 px-2 py-2 tabular-nums text-ink-muted">{s.number}</td>
                <td className="px-2 py-2">
                  <div className="flex items-baseline gap-2">
                    <button
                      type="button"
                      className="min-w-0 truncate text-left font-semibold text-ink"
                    >
                      {s.nameEn}
                    </button>
                    <span
                      lang="ar"
                      dir="rtl"
                      className="ml-auto shrink-0 font-arabic text-lg leading-none text-ink"
                    >
                      {s.nameAr.replace(/^سورة\s+/, "")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-ink-subtle">
                    {compact && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: colour }}
                        aria-label={i.place(s.type)}
                      />
                    )}
                    <span className="truncate">{i.meaning(s)}</span>
                  </div>
                  {compact && <div className="mt-1.5">{bar}</div>}
                </td>
                {!compact && (
                  <td className="whitespace-nowrap px-2 py-2">
                    <span className="inline-flex items-center gap-1.5 text-ink-muted">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: colour }}
                        aria-hidden
                      />
                      {i.place(s.type)}
                    </span>
                  </td>
                )}
                {!compact && (
                  <td className="px-2 py-2 text-right tabular-nums text-ink-muted">
                    {s.revelationOrder}
                  </td>
                )}
                <td className="px-2 py-2 text-right tabular-nums text-ink">
                  {s.ayahCount}
                </td>
                {!compact && (
                  <td className="px-2 py-2 text-right tabular-nums text-ink-muted">
                    {n(s.wordCount)}
                  </td>
                )}
                {!compact && <td className="w-[22%] min-w-[8rem] px-2 py-2">{bar}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Juz or manzils as a dense list: range, the surahs it spans (a bar of their
 *  shares, coloured by place), ayahs, words and pages. */
export function DivisionList({
  cards,
  kind,
  juzNames,
  surahName,
  surahColor,
  onOpen,
}: {
  cards: DivisionCard[];
  kind: "juz" | "manzil";
  juzNames?: (n: number) => string | undefined;
  surahName: (s: number) => string;
  surahColor: (s: number) => string;
  onOpen: (n: number) => void;
}) {
  const { t, n } = useI18n();
  const wrap = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrap);
  const compact = width > 0 && width < COMPACT_PX;
  const c = t.browse.cols;
  const span = (a: number, b: number) => (a === b ? String(a) : `${a}–${b}`);
  return (
    <div ref={wrap} className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-line text-left">
          <tr>
            <Th>{t.scope[kind]}</Th>
            <Th>{c.surahs}</Th>
            <Th right>{c.ayahs}</Th>
            {!compact && <Th right>{c.words}</Th>}
            {!compact && <Th right>{c.pages}</Th>}
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => {
            const ar = juzNames?.(card.n)?.replace(/^الجزء\s+/, "");
            return (
              <tr
                key={card.n}
                onClick={() => onOpen(card.n)}
                className="cursor-pointer border-b border-line/70 align-top hover:bg-surface-sunken dark:hover:bg-surface"
              >
                <td className="w-32 px-2 py-2">
                  <button type="button" className="text-left font-semibold text-ink">
                    {t.scope[kind]} {card.n}
                  </button>
                  <div className="text-xs tabular-nums text-ink-subtle">
                    {card.first.s}:{card.first.a} → {card.last.s}:{card.last.a}
                  </div>
                  {ar && (
                    <div
                      lang="ar"
                      dir="rtl"
                      className="text-right font-arabic text-base text-ink-muted"
                    >
                      {ar}
                    </div>
                  )}
                </td>
                <td className="px-2 py-2">
                  <div className="flex h-2 w-full overflow-hidden rounded-sm" aria-hidden>
                    {card.surahs.map((x) => (
                      <span
                        key={x.s}
                        title={`${x.s}. ${surahName(x.s)}`}
                        style={{
                          width: `${(x.ayahs / card.ayahs) * 100}%`,
                          backgroundColor: surahColor(x.s),
                        }}
                        className="border-r border-surface last:border-r-0"
                      />
                    ))}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-muted">
                    {card.surahs.map((x) => `${x.s}. ${surahName(x.s)}`).join(" · ")}
                  </p>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-ink">
                  {card.ayahs}
                </td>
                {!compact && (
                  <td className="px-2 py-2 text-right tabular-nums text-ink-muted">
                    {n(card.words)}
                  </td>
                )}
                {!compact && (
                  <td className="px-2 py-2 text-right tabular-nums text-ink-muted">
                    {span(...card.pages)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
