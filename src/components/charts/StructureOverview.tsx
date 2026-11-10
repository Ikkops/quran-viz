import { TRADITIONAL_COUNT } from "../../data/traditionalCounts";
import type { Meta, Surah } from "../../types/quran";
import { Card } from "../ui";
import { useI18n } from "../../i18n/I18nContext";

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="p-3">
      <div className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
        {value}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      {sub && (
        <div className="mt-0.5 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
          {sub}
        </div>
      )}
    </Card>
  );
}

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

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={tr.common.surah} value={surahCount} />
        <Stat label={tr.common.verses} value={n(t.ayahs)} />
        <Stat
          label={tr.common.words}
          value={n(t.words)}
          sub={tr.structure.traditional(n(TRADITIONAL_COUNT.words))}
        />
        <Stat
          label={tr.common.letters}
          value={n(t.letters)}
          sub={tr.structure.traditional(n(TRADITIONAL_COUNT.letters))}
        />
        <Stat label={tr.structure.mushafPages} value={t.pages} />
        <Stat label={tr.scope.juz} value={t.juzs} />
        <Stat label={tr.scope.hizb} value={t.hizbs} />
        <Stat label={tr.structure.sajdaVerses} value={t.sajdas} />
        <Stat
          label={tr.structure.meccanAyahs}
          value={n(meccan)}
          sub={tr.structure.bySurah(meccanSurahs, n(meta.classification["Meccan"] ?? 0))}
        />
        <Stat
          label={tr.structure.medinanAyahs}
          value={n(medinan)}
          sub={tr.structure.bySurah(
            medinanSurahs,
            n(meta.classification["Medinan"] ?? 0),
          )}
        />
        {hijra > 0 && (
          <Stat label={tr.structure.hijra} value={hijra} sub="22:52–55, 28:85, 47:13" />
        )}
      </div>
      <p className="text-[11px] text-slate-400">
        {tr.structure.overviewNote} {tr.placeCaveat}
      </p>
    </div>
  );
}
