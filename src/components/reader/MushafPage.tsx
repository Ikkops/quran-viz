import { Fragment, type KeyboardEvent } from "react";
import type { Surah, Verse } from "../../types/quran";
import { useI18n } from "../../i18n/I18nContext";
import { cx } from "../ui";
import { AyahText } from "./AyahText";
import { Basmala } from "./VerseRow";
import { SurahBanner } from "./SurahBanner";
import { rectAt, rectOf, type PickRect } from "./wordPick";

/** Split a page's verses where a new surah starts. */
function bySurah(verses: Verse[]): Verse[][] {
  const out: Verse[][] = [];
  for (const v of verses) {
    const last = out[out.length - 1];
    if (last && last[0].s === v.s) last.push(v);
    else out.push([v]);
  }
  return out;
}

/**
 * One page of the mushaf: the ayahs run on as continuous text, each closed by
 * its medallion, with the page's juz and hizb in the head margin and the page
 * number at the foot. Tapping an ayah opens its popup by the tapped spot.
 */
export function MushafPage({
  verses,
  surahMap,
  tajweed,
  selectedId,
  playingId,
  onAyah,
}: {
  verses: Verse[];
  surahMap: Map<number, Surah>;
  tajweed: (string | null)[] | null;
  selectedId: number | undefined;
  playingId: number | undefined;
  onAyah: (id: number, rect: PickRect) => void;
}) {
  const { t } = useI18n();
  const first = verses[0];
  const surahs = [...new Set(verses.map((v) => v.s))].map((s) => surahMap.get(s));
  const onKey = (id: number) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onAyah(id, rectOf(e.currentTarget));
    }
  };
  return (
    <figure
      aria-label={t.reader.page(first.page)}
      className="mx-auto my-4 max-w-[44rem] rounded-xl border border-line bg-surface px-5 pb-3 pt-2 shadow-soft sm:px-8"
    >
      <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-line/70 pb-1.5 text-xs text-ink-subtle">
        <span className="tabular-nums">
          {t.scope.juz} {first.juz} · {t.scope.hizb} {first.hizb}
        </span>
        <span className="truncate">{surahs.map((s) => s?.name).join(" · ")}</span>
      </div>
      {bySurah(verses).map((run) => {
        const s = surahMap.get(run[0].s);
        return (
          <Fragment key={run[0].id}>
            {run[0].a === 1 && s && (
              <SurahBanner s={s} className="my-3 h-[2em] text-2xl" />
            )}
            {run[0].a === 1 && s?.hasBismillah && <Basmala />}
            <p
              lang="ar"
              dir="rtl"
              className="quran-text text-justify text-ink [text-align-last:center]"
            >
              {run.map((v) => (
                <Fragment key={v.id}>
                  <span
                    role="button"
                    tabIndex={0}
                    data-ayah={v.id}
                    aria-label={t.reader.selectAyah(`${v.s}:${v.a}`)}
                    aria-pressed={selectedId === v.id}
                    onClick={(e) =>
                      onAyah(v.id, rectAt(e.currentTarget, e.clientX, e.clientY))
                    }
                    onKeyDown={onKey(v.id)}
                    className={cx(
                      "cursor-pointer rounded-sm transition-colors hover:bg-illumination/10",
                      selectedId === v.id && "bg-illumination/15",
                      playingId === v.id && "bg-rubric/15",
                    )}
                  >
                    <AyahText v={v} tajweed={tajweed?.[v.id]} />
                  </span>{" "}
                </Fragment>
              ))}
            </p>
          </Fragment>
        );
      })}
      <figcaption className="mt-2 text-center text-xs tabular-nums text-ink-subtle">
        {first.page}
      </figcaption>
    </figure>
  );
}
