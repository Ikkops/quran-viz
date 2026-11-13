import {
  BarChart3,
  BookA,
  BoxSelect,
  ScatterChart,
  Cloud,
  Flag,
  Hash,
  Network,
  Ruler,
  Shapes,
  Tags,
  type LucideIcon,
} from "lucide-react";
import type { Metric } from "../components/charts/SurahBarChart";
import {
  DEFAULT_FILTER,
  type FilterState,
  type PlaceFilter,
  type SortKey,
} from "../data/selectors";
import { parseHash } from "../lib/hash";

export type VizId =
  | "length"
  | "correlation"
  | "opening"
  | "histogram"
  | "boxplots"
  | "extremes"
  | "cloud"
  | "roots"
  | "root-explorer"
  | "pos"
  | "topic-explorer";

/** Which dashboard controls a view responds to; the rest are hidden. */
export interface VizUses {
  range?: boolean;
  sort?: boolean;
  color?: boolean;
  layout?: boolean;
}

export interface VizDef {
  value: VizId;
  label: string;
  group: "Surahs" | "Verses" | "Vocabulary" | "Topics";
  icon: LucideIcon;
  uses: VizUses;
  /** The view lays itself out (controls, chart, lists) and grows with its
   *  content instead of filling the fixed-height chart box. */
  autoHeight?: boolean;
}

export const VIZ_DEFS: VizDef[] = [
  {
    value: "length",
    label: "Surah length",
    group: "Surahs",
    icon: BarChart3,
    uses: { range: true, sort: true, color: true, layout: true },
  },
  {
    value: "correlation",
    label: "Words vs verses",
    group: "Surahs",
    icon: ScatterChart,
    uses: { range: true, color: true },
  },
  {
    value: "opening",
    label: "Opening categories",
    group: "Surahs",
    icon: Flag,
    uses: { range: true, sort: true },
    autoHeight: true,
  },
  {
    value: "histogram",
    label: "Length distribution",
    group: "Verses",
    icon: Ruler,
    uses: { range: true },
  },
  {
    value: "boxplots",
    label: "Length box plots",
    group: "Verses",
    icon: BoxSelect,
    uses: { range: true, sort: true },
  },
  {
    value: "extremes",
    label: "Longest & shortest",
    group: "Verses",
    icon: Hash,
    uses: { range: true },
  },
  {
    value: "cloud",
    label: "Word cloud",
    group: "Vocabulary",
    icon: Cloud,
    uses: { range: true },
  },
  {
    value: "roots",
    label: "Most frequent roots",
    group: "Vocabulary",
    icon: BookA,
    uses: { range: true },
    autoHeight: true,
  },
  {
    value: "root-explorer",
    label: "Root explorer",
    group: "Vocabulary",
    icon: Network,
    uses: { range: true },
    autoHeight: true,
  },
  {
    value: "pos",
    label: "Part of speech",
    group: "Vocabulary",
    icon: Shapes,
    uses: {},
  },
  {
    value: "topic-explorer",
    label: "Topic explorer",
    group: "Topics",
    icon: Tags,
    uses: { range: true },
    autoHeight: true,
  },
];

export const VIZ_BY_ID = Object.fromEntries(VIZ_DEFS.map((d) => [d.value, d])) as Record<
  VizId,
  VizDef
>;

export const METRICS: { value: Metric; label: string }[] = [
  { value: "wordCount", label: "Words" },
  { value: "letterCount", label: "Letters" },
  { value: "ayahCount", label: "Verses" },
  { value: "avgWords", label: "Avg / verse" },
];

export type CloudLang = "ar" | "en";

/** Older builds stored one viz per metric / cloud language. Map a stored
 *  `qv.viz` value to the current id plus the setting it implied. */
export function migrateViz(raw: unknown): {
  viz: VizId;
  metric?: Metric;
  cloudLang?: CloudLang;
} {
  const legacyMetric: Record<string, Metric> = {
    words: "wordCount",
    letters: "letterCount",
    verses: "ayahCount",
    avg: "avgWords",
  };
  if (typeof raw === "string") {
    if (raw in legacyMetric) return { viz: "length", metric: legacyMetric[raw] };
    if (raw === "cloud-ar") return { viz: "cloud", cloudLang: "ar" };
    if (raw === "cloud-en") return { viz: "cloud", cloudLang: "en" };
    if (raw in VIZ_BY_ID) return { viz: raw as VizId };
  }
  return { viz: "length" };
}

/** One-time rewrite of legacy keys in localStorage, before the dashboard
 *  reads them. Safe to call on every mount. */
export function migrateStoredViz(): void {
  try {
    const stored = window.localStorage.getItem("qv.viz");
    if (stored === null) return;
    const m = migrateViz(JSON.parse(stored));
    window.localStorage.setItem("qv.viz", JSON.stringify(m.viz));
    if (m.metric) window.localStorage.setItem("qv.metric", JSON.stringify(m.metric));
    if (m.cloudLang)
      window.localStorage.setItem("qv.cloudLang", JSON.stringify(m.cloudLang));
  } catch {
    /* storage unavailable: defaults apply */
  }
}

/** The dashboard state that a shared link carries. */
export interface DashboardLinkState {
  viz: VizId;
  metric: Metric;
  cloudLang: CloudLang;
  filter: FilterState;
  /** Root (Buckwalter) shown by the root explorer. */
  root?: string;
  /** Topic key shown by the topic explorer. */
  topic?: string;
}

/** A root's Buckwalter form or a topic key: short, no separators. */
const LINK_KEY = /^[\w$*<>&'|{}~`^.-]{1,64}$/;

const SORTS: SortKey[] = ["quran", "revelation", "verses", "words", "letters"];
const PLACES: PlaceFilter[] = ["all", "Meccan", "Medinan"];

/** Compact link params: only what differs from the defaults. */
export function dashboardToParams(st: DashboardLinkState): Record<string, string> {
  const out: Record<string, string> = { v: st.viz };
  if (st.viz === "length") out.m = st.metric;
  if (st.viz === "cloud") out.c = st.cloudLang;
  if (st.viz === "root-explorer" && st.root) out.root = st.root;
  if (st.viz === "topic-explorer" && st.topic) out.topic = st.topic;
  const f = st.filter;
  if (f.sort !== "quran") out.s = f.sort;
  if (f.mode === "surah") out.r = `surah:${f.surahRange[0]}-${f.surahRange[1]}`;
  if (f.mode === "juz") out.r = `juz:${f.juzRange[0]}-${f.juzRange[1]}`;
  if (f.place && f.place !== "all") out.p = f.place;
  return out;
}

/** Parse link params back; invalid or missing values are left out. */
export function paramsToDashboard(
  p: Record<string, string>,
  base: FilterState,
): Partial<DashboardLinkState> {
  const out: Partial<DashboardLinkState> = {};
  if (p.v && p.v in VIZ_BY_ID) out.viz = p.v as VizId;
  if (p.m && METRICS.some((m) => m.value === p.m)) out.metric = p.m as Metric;
  if (p.c === "ar" || p.c === "en") out.cloudLang = p.c;
  if (p.root && LINK_KEY.test(p.root)) out.root = p.root;
  if (p.topic && LINK_KEY.test(p.topic)) out.topic = p.topic;
  const filter: FilterState = { ...DEFAULT_FILTER, ...base };
  let touched = false;
  if (p.s && (SORTS as string[]).includes(p.s)) {
    filter.sort = p.s as SortKey;
    touched = true;
  }
  const r = /^(surah|juz):(\d+)-(\d+)$/.exec(p.r ?? "");
  if (r) {
    const max = r[1] === "surah" ? 114 : 30;
    const lo = Math.min(max, Math.max(1, Number(r[2])));
    const hi = Math.min(max, Math.max(lo, Number(r[3])));
    filter.mode = r[1] as "surah" | "juz";
    if (r[1] === "surah") filter.surahRange = [lo, hi];
    else filter.juzRange = [lo, hi];
    touched = true;
  }
  if (p.p && (PLACES as string[]).includes(p.p)) {
    filter.place = p.p as PlaceFilter;
    touched = true;
  }
  if (touched || p.v) {
    // A link describes the whole view: unspecified filter fields reset.
    if (!r) filter.mode = "all";
    if (!p.s) filter.sort = "quran";
    if (!p.p) filter.place = "all";
    out.filter = filter;
  }
  return out;
}

/** Before the dashboard's persisted state initialises: copy any link params
 *  into storage so the link wins over the remembered view. */
export function seedDashboardFromHash(hash: string): void {
  try {
    const params = parseHash(hash).params;
    if (!Object.keys(params).length) return;
    const stored = window.localStorage.getItem("qv.filter");
    const base = stored ? (JSON.parse(stored) as FilterState) : DEFAULT_FILTER;
    const st = paramsToDashboard(params, base);
    const set = (k: string, v: unknown) =>
      window.localStorage.setItem(k, JSON.stringify(v));
    if (st.viz) set("qv.viz", st.viz);
    if (st.metric) set("qv.metric", st.metric);
    if (st.cloudLang) set("qv.cloudLang", st.cloudLang);
    if (st.filter) set("qv.filter", st.filter);
    if (st.root) set("qv.root", st.root);
    if (st.topic) set("qv.topicKey", st.topic);
  } catch {
    /* storage unavailable: the link is ignored */
  }
}
