import { TRADITIONAL_COUNT } from "../../data/traditionalCounts";
import type { Meta, Surah } from "../../types/quran";
import { Card } from "../ui";
import { PLACE_CAVEAT } from "./common";

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
        <Stat label="Surahs" value={surahCount} />
        <Stat label="Verses" value={t.ayahs.toLocaleString()} />
        <Stat
          label="Words"
          value={t.words.toLocaleString()}
          sub={`~${TRADITIONAL_COUNT.words.toLocaleString()} traditional`}
        />
        <Stat
          label="Letters"
          value={t.letters.toLocaleString()}
          sub={`~${TRADITIONAL_COUNT.letters.toLocaleString()} traditional`}
        />
        <Stat label="Mushaf pages" value={t.pages} />
        <Stat label="Juz" value={t.juzs} />
        <Stat label="Hizb" value={t.hizbs} />
        <Stat label="Sajda verses" value={t.sajdas} />
        <Stat
          label="Meccan ayahs"
          value={meccan.toLocaleString()}
          sub={`${meccanSurahs} surahs · ${(meta.classification["Meccan"] ?? 0).toLocaleString()} ayahs by surah`}
        />
        <Stat
          label="Medinan ayahs"
          value={medinan.toLocaleString()}
          sub={`${medinanSurahs} surahs · ${(meta.classification["Medinan"] ?? 0).toLocaleString()} ayahs by surah`}
        />
        {hijra > 0 && (
          <Stat
            label="Revealed during the Hijra"
            value={hijra}
            sub="22:52–55, 28:85, 47:13"
          />
        )}
      </div>
      <p className="text-[11px] text-slate-400">
        Ayah counts use each ayah&apos;s own place where it differs from its surah (e.g.
        7:163–170 are Medinan inside a Meccan surah). {PLACE_CAVEAT}
      </p>
    </div>
  );
}
