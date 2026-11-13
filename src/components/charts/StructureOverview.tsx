import type { ReactNode } from "react";
import { TRADITIONAL_COUNT } from "../../data/traditionalCounts";
import type { Meta, Surah } from "../../types/quran";
import { useI18n } from "../../i18n/I18nContext";

/** One count: the figure, what it counts, and an optional note. */
function Figure({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="flex flex-col-reverse justify-end">
      <dt className="text-sm text-ink-muted">
        {label}
        {sub && <span className="block text-xs tabular-nums text-ink-subtle">{sub}</span>}
      </dt>
      <dd className="text-2xl font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

/** A ruled group of counts under its own heading. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-3">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

const FIGURES = "grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-6 gap-y-4";

export function StructureOverview({ surahs, meta }: { surahs: Surah[]; meta: Meta }) {
  const { t: tr, n } = useI18n();
  const t = meta.totals;
  const byAyah = meta.classificationByAyah ?? meta.classification;
  const meccan = byAyah["Meccan"] ?? 0;
  const medinan = byAyah["Medinan"] ?? 0;
  const hijra = byAyah["Hijra"] ?? 0;
  // `surahs` may be filtered upstream; fall back to the meta total when not.
  const surahCount = surahs.length || t.surahs;
  const meccanSurahs = surahs.filter((s) => s.type === "Meccan").length;
  const medinanSurahs = surahs.filter((s) => s.type === "Medinan").length;

  const placed = meccan + medinan + hijra || 1;
  const share = (count: number) => {
    const pct = Math.round((count / placed) * 100);
    return pct < 1 ? "<1%" : `${pct}%`;
  };
  // In the order of revelation: Makkah, the journey, Madinah.
  const places = [
    {
      key: "makki",
      bar: "bg-makki",
      label: tr.structure.meccanAyahs,
      count: meccan,
      sub: tr.structure.bySurah(meccanSurahs, n(meta.classification["Meccan"] ?? 0)),
    },
    {
      key: "hijra",
      bar: "bg-hijra",
      label: tr.structure.hijra,
      count: hijra,
      sub: "22:52–55, 28:85, 47:13",
    },
    {
      key: "madani",
      bar: "bg-madani",
      label: tr.structure.medinanAyahs,
      count: medinan,
      sub: tr.structure.bySurah(medinanSurahs, n(meta.classification["Medinan"] ?? 0)),
    },
  ].filter((p) => p.count > 0);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto">
      <Group title={tr.structure.groupText}>
        <dl className={FIGURES}>
          <Figure label={tr.common.surah} value={surahCount} />
          <Figure label={tr.common.verses} value={n(t.ayahs)} />
          <Figure
            label={tr.common.words}
            value={n(t.words)}
            sub={tr.structure.traditional(n(TRADITIONAL_COUNT.words))}
          />
          <Figure
            label={tr.common.letters}
            value={n(t.letters)}
            sub={tr.structure.traditional(n(TRADITIONAL_COUNT.letters))}
          />
        </dl>
      </Group>

      <Group title={tr.structure.groupDivisions}>
        <dl className={FIGURES}>
          <Figure label={tr.structure.mushafPages} value={t.pages} />
          <Figure label={tr.scope.juz} value={t.juzs} />
          <Figure label={tr.scope.hizb} value={t.hizbs} />
          <Figure label={tr.structure.sajdaVerses} value={t.sajdas} />
        </dl>
      </Group>

      <Group title={tr.structure.groupPlace}>
        <div
          role="img"
          aria-label={places
            .map((p) => `${p.label}: ${n(p.count)} (${share(p.count)})`)
            .join(", ")}
          className="mb-4 flex h-3 gap-px overflow-hidden rounded-sm"
        >
          {places.map((p) => (
            <div
              key={p.key}
              className={`${p.bar} min-w-[3px]`}
              style={{ flexGrow: p.count, flexBasis: 0 }}
            />
          ))}
        </div>
        <dl className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-x-6 gap-y-4">
          {places.map((p) => (
            <div key={p.key} className="flex flex-col-reverse justify-end">
              <dt className="flex items-start gap-2 text-sm text-ink-muted">
                <span
                  aria-hidden
                  className={`${p.bar} mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm`}
                />
                <span>
                  {p.label}
                  <span className="block text-xs tabular-nums text-ink-subtle">
                    {p.sub}
                  </span>
                </span>
              </dt>
              <dd className="text-2xl font-semibold tabular-nums text-ink">
                {n(p.count)}{" "}
                <span className="text-sm font-normal text-ink-muted">
                  {share(p.count)}
                </span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 max-w-[70ch] text-xs text-ink-subtle">
          {tr.structure.overviewNote} {tr.placeCaveat}
        </p>
      </Group>
    </div>
  );
}
