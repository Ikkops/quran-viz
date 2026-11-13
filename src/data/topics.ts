import { normalizeArabic } from "./arabic";
import type { TopicNode, Verse } from "../types/quran";

/** topics.json, indexed for browsing. Node 0..n-1 keep their file order
 *  (parents before children, siblings in curated order). */
export interface TopicTree {
  nodes: TopicNode[];
  /** Child indices per node; `roots` holds the top categories. */
  children: number[][];
  roots: number[];
  byKey: Map<string, number>;
  /** Ayah ids a node covers: its own plus every descendant's, ascending. */
  all: number[][];
}

export function buildTopicTree(nodes: TopicNode[]): TopicTree {
  const children: number[][] = nodes.map(() => []);
  const roots: number[] = [];
  nodes.forEach((n, i) => (n.p < 0 ? roots : children[n.p]).push(i));
  const all: number[][] = nodes.map(() => []);
  // Parents precede children, so a reverse sweep sees every child first.
  const sets: Set<number>[] = nodes.map((n) => new Set(n.v ?? []));
  for (let i = nodes.length - 1; i >= 0; i--) {
    const p = nodes[i].p;
    if (p >= 0) for (const id of sets[i]) sets[p].add(id);
    all[i] = [...sets[i]].sort((a, b) => a - b);
  }
  return {
    nodes,
    children,
    roots,
    byKey: new Map(nodes.map((n, i) => [n.k, i])),
    all,
  };
}

/** Indices from the top category down to `i` (inclusive). */
export function topicPath(tree: TopicTree, i: number): number[] {
  const out: number[] = [];
  for (let at = i; at >= 0; at = tree.nodes[at].p) out.unshift(at);
  return out;
}

/** A node's name in the UI language. */
export function topicName(node: TopicNode, lang: "en" | "id"): string {
  return lang === "id" ? node.id : node.en;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[''`ʿʾ]/g, "");

/**
 * Topics whose Indonesian, English or Arabic name contains `query`
 * (case-, accent- and apostrophe-insensitive; Arabic diacritic-insensitive).
 * Names that start with the query rank first, then bigger topics.
 */
export function searchTopicTree(tree: TopicTree, query: string, limit: number): number[] {
  const q = fold(query.trim());
  if (!q) return [];
  const ar = normalizeArabic(query.trim());
  const hits: { i: number; rank: number }[] = [];
  tree.nodes.forEach((n, i) => {
    const names = [fold(n.id), fold(n.en)];
    let rank = -1;
    if (names.some((s) => s.startsWith(q))) rank = 0;
    else if (names.some((s) => s.split(/[\s(/-]+/).some((w) => w.startsWith(q))))
      rank = 1;
    else if (names.some((s) => s.includes(q))) rank = 2;
    else if (ar && n.ar && normalizeArabic(n.ar).includes(ar)) rank = 1;
    if (rank >= 0) hits.push({ i, rank });
  });
  hits.sort(
    (a, b) => a.rank - b.rank || tree.all[b.i].length - tree.all[a.i].length || a.i - b.i,
  );
  return hits.slice(0, limit).map((h) => h.i);
}

export interface SurahGroup {
  s: number;
  /** Consecutive ayah runs: [first ayah no., last ayah no., first ayah id]. */
  runs: [number, number, number][];
  count: number;
}

/** Group ayah ids (ascending) by surah and fold consecutive ayahs into runs. */
export function groupBySurah(ids: number[], byId: Map<number, Verse>): SurahGroup[] {
  const out: SurahGroup[] = [];
  for (const id of ids) {
    const v = byId.get(id);
    if (!v) continue;
    let g = out[out.length - 1];
    if (!g || g.s !== v.s) {
      g = { s: v.s, runs: [], count: 0 };
      out.push(g);
    }
    const last = g.runs[g.runs.length - 1];
    if (last && last[1] === v.a - 1) last[1] = v.a;
    else g.runs.push([v.a, v.a, id]);
    g.count += 1;
  }
  return out;
}

/** "5" or "5–7". */
export function formatRun([a, b]: [number, number, number]): string {
  return a === b ? String(a) : `${a}–${b}`;
}
