import { useMemo } from "react";
import type { ReaderTarget } from "../charts/common";
import type { Surah, Verse } from "../../types/quran";
import { dayKey } from "../../data/readingLog";
import {
  DEFAULT_QUOTA,
  QUOTA_CHOICES,
  todaysPlan,
  type Hifdh,
  type HifdhPage,
  type HifdhPlan,
} from "../../lib/hifdh";
import { usePersistentState } from "../../lib/usePersistentState";

const QUOTA_KEY = "qv.hifdh.quota";
const quotaOk = (raw: unknown) =>
  (QUOTA_CHOICES as readonly unknown[]).includes(raw) ? (raw as number) : undefined;

/** How many older pages a day offers (persisted), and today's plan with it. */
export function useHifdhPlan(hifdh: Hifdh, verses: Verse[]) {
  const [quota, setQuota] = usePersistentState<number>(QUOTA_KEY, DEFAULT_QUOTA, quotaOk);
  const today = dayKey(new Date());
  const plan = useMemo<HifdhPlan>(
    () => todaysPlan(hifdh, verses, today, quota),
    [hifdh, verses, today, quota],
  );
  return { plan, quota, setQuota };
}

/** "Al-Mulk 1–12", or both surah names when the page crosses into the next. */
export function pageSpan(p: HifdhPage, verses: Verse[], surahs: Surah[]): string {
  const a = verses[p.from - 1];
  const b = verses[p.to - 1];
  if (!a || !b) return "";
  const name = (v: Verse) => surahs[v.s - 1]?.name ?? "";
  return a.s === b.s
    ? `${name(a)} ${a.a}–${b.a}`
    : `${name(a)} ${a.a} – ${name(b)} ${b.a}`;
}

/** Open a page to recite it from memory: the reader comes up in Hafalan mode. */
export function openForReview(page: number, onOpen: (t: ReaderTarget) => void): void {
  try {
    window.localStorage.setItem("qv.reader.hifdh", "true");
  } catch {
    /* ignore */
  }
  onOpen({ scope: "page", value: page });
}
