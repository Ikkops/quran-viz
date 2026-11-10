import { describe, expect, it, beforeEach } from "vitest";
import { DEFAULT_FILTER } from "../data/selectors";
import {
  dashboardToParams,
  migrateStoredViz,
  migrateViz,
  paramsToDashboard,
  seedDashboardFromHash,
} from "./vizDefs";

beforeEach(() => localStorage.clear());

describe("migrateViz", () => {
  it("maps legacy per-metric and per-language views", () => {
    expect(migrateViz("letters")).toEqual({ viz: "length", metric: "letterCount" });
    expect(migrateViz("avg")).toEqual({ viz: "length", metric: "avgWords" });
    expect(migrateViz("cloud-en")).toEqual({ viz: "cloud", cloudLang: "en" });
  });
  it("keeps current ids and defaults anything else", () => {
    expect(migrateViz("topic-explorer")).toEqual({ viz: "topic-explorer" });
    expect(migrateViz("gone")).toEqual({ viz: "length" });
    expect(migrateViz(42)).toEqual({ viz: "length" });
  });
  it("rewrites localStorage once", () => {
    localStorage.setItem("qv.viz", JSON.stringify("verses"));
    migrateStoredViz();
    expect(JSON.parse(localStorage.getItem("qv.viz")!)).toBe("length");
    expect(JSON.parse(localStorage.getItem("qv.metric")!)).toBe("ayahCount");
  });
});

describe("dashboard link params", () => {
  const state = {
    viz: "length" as const,
    metric: "letterCount" as const,
    cloudLang: "ar" as const,
    filter: {
      ...DEFAULT_FILTER,
      mode: "juz" as const,
      juzRange: [28, 30] as [number, number],
      sort: "revelation" as const,
      place: "Medinan" as const,
    },
  };

  it("round-trips through compact params", () => {
    const p = dashboardToParams(state);
    expect(p).toEqual({
      v: "length",
      m: "letterCount",
      s: "revelation",
      r: "juz:28-30",
      p: "Medinan",
    });
    const back = paramsToDashboard(p, DEFAULT_FILTER);
    expect(back.viz).toBe("length");
    expect(back.metric).toBe("letterCount");
    expect(back.filter).toMatchObject({
      mode: "juz",
      juzRange: [28, 30],
      sort: "revelation",
      place: "Medinan",
    });
  });

  it("ignores junk and clamps ranges", () => {
    const back = paramsToDashboard(
      { v: "nope", m: "x", r: "surah:0-999" },
      DEFAULT_FILTER,
    );
    expect(back.viz).toBeUndefined();
    expect(back.metric).toBeUndefined();
    expect(back.filter?.surahRange).toEqual([1, 114]);
  });

  it("seeds storage from a shared link", () => {
    localStorage.setItem("qv.viz", JSON.stringify("cloud"));
    seedDashboardFromHash("#dashboard?v=roots&r=surah:2-3");
    expect(JSON.parse(localStorage.getItem("qv.viz")!)).toBe("roots");
    expect(JSON.parse(localStorage.getItem("qv.filter")!)).toMatchObject({
      mode: "surah",
      surahRange: [2, 3],
    });
  });
});
