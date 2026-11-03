import { useMemo, useState } from "react";
import type { QuranData } from "../types/quran";
import { surahMapOf } from "../data/selectors";
import { useTheme } from "../theme/ThemeContext";
import { Card, SectionTitle, SegmentedControl } from "../components/ui";
import type { ChartContext, ReaderTarget } from "../components/charts/common";
import { StructureOverview } from "../components/charts/StructureOverview";
import { MushafPageMap } from "../components/charts/MushafPageMap";
import { JuzBreakdown } from "../components/charts/JuzBreakdown";
import { HizbBreakdown } from "../components/charts/HizbBreakdown";
import { SajdaMarkers } from "../components/charts/SajdaMarkers";
import { DivisionBreakdown } from "../components/charts/DivisionBreakdown";
import { SimilarArcs } from "../components/charts/SimilarArcs";
import { useSimilar } from "../data/useSimilar";

type Tab =
  | "overview"
  | "pages"
  | "manzil"
  | "juz"
  | "hizb"
  | "ruku"
  | "sajda"
  | "similar";

const SUBTITLES: Record<Tab, string> = {
  overview: "Totals and Meccan / Medinan split",
  pages:
    "Each cell is one of the 604 Mushaf pages; intensity = words. Click to read the page",
  manzil:
    "Words per manzil, the seven divisions for reciting the Qur'an over a week. Click to read the manzil",
  juz: "Words per juz (1–30). Click a bar to read from the start of that juz",
  hizb: "Words per hizb (1–60), coloured by parent juz. Click to read the hizb",
  ruku: "Words per ruku' (1–558), alternating colour by surah. Click to read the ruku'. Source: QUL",
  sajda: "The 15 prostration verses. Click to jump to the verse",
  similar:
    "Arcs join verses with overlapping wording, across the whole mushaf. Click an arc to read it",
};

const TITLES: Record<Tab, string> = {
  overview: "Structure overview",
  pages: "Mushaf page map",
  manzil: "Manzil breakdown",
  juz: "Juz breakdown",
  hizb: "Hizb breakdown",
  ruku: "Ruku' breakdown",
  sajda: "Sajda markers",
  similar: "Similar verses",
};

export function StructureView({
  data,
  onOpen,
}: {
  data: QuranData;
  onOpen: (t: ReaderTarget) => void;
}) {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>("overview");
  const surahMap = useMemo(() => surahMapOf(data.surahs), [data.surahs]);
  const similar = useSimilar(tab === "similar");

  const ctx: ChartContext = useMemo(
    () => ({
      palette: theme.palette,
      primary: theme.primary,
      colorMode: "type",
      dark: theme.dark,
      onOpen,
      onSelectSurah: (id) => onOpen({ scope: "surah", value: id }),
    }),
    [theme.palette, theme.primary, theme.dark, onOpen],
  );

  return (
    <Card className="p-4">
      <SectionTitle
        title={TITLES[tab]}
        subtitle={SUBTITLES[tab]}
        right={
          <SegmentedControl<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "overview", label: "Overview" },
              { value: "pages", label: "Pages" },
              { value: "manzil", label: "Manzil" },
              { value: "juz", label: "Juz" },
              { value: "hizb", label: "Hizb" },
              { value: "ruku", label: "Ruku'" },
              { value: "sajda", label: "Sajda" },
              { value: "similar", label: "Similar" },
            ]}
          />
        }
      />
      <div className="h-[calc(64*var(--zvh))] min-h-[440px] w-full">
        {tab === "overview" && (
          <StructureOverview surahs={data.surahs} meta={data.meta} />
        )}
        {tab === "pages" && (
          <MushafPageMap verses={data.verses} surahMap={surahMap} ctx={ctx} />
        )}
        {tab === "juz" && <JuzBreakdown verses={data.verses} ctx={ctx} />}
        {tab === "hizb" && <HizbBreakdown verses={data.verses} ctx={ctx} />}
        {(tab === "manzil" || tab === "ruku") && (
          <DivisionBreakdown
            verses={data.verses}
            surahMap={surahMap}
            division={tab}
            ctx={ctx}
          />
        )}
        {tab === "similar" &&
          (similar.data ? (
            <SimilarArcs
              data={similar.data}
              verses={data.verses}
              surahMap={surahMap}
              ctx={ctx}
            />
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-slate-400">
              {similar.error ? `Failed to load: ${similar.error}` : "Loading…"}
            </p>
          ))}
        {tab === "sajda" && (
          <SajdaMarkers verses={data.verses} surahMap={surahMap} ctx={ctx} />
        )}
      </div>
    </Card>
  );
}
