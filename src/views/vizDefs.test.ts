import { describe, expect, it, beforeEach } from "vitest";
import { DEFAULT_FILTER } from "../data/selectors";
import {
  dashboardToParams,
  migrateStoredViz,
  migrateViz,
  paramsToDashboard,
  seedDashboardFromHash,
  VIZ_BY_ID,
  VIZ_DEFS,
} from "./vizDefs";

describe("VIZ_DEFS", () => {
  it("lists 12 views, the mushaf map last", () => {
    expect(VIZ_DEFS).toHaveLength(12);
    expect(VIZ_DEFS[VIZ_DEFS.length - 1]).toMatchObject({
      value: "map",
      group: "Map",
      uses: {},
    });
    expect(VIZ_BY_ID.map.autoHeight).toBe(true);
  });
});

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
  it("turns the old Map tab into the map view, once", () => {
    localStorage.setItem("qv.viz", JSON.stringify("roots"));
    localStorage.setItem("qv.dashboard.tab", JSON.stringify("map"));
    migrateStoredViz();
    expect(JSON.parse(localStorage.getItem("qv.viz")!)).toBe("map");
    expect(localStorage.getItem("qv.dashboard.tab")).toBeNull();
    localStorage.setItem("qv.viz", JSON.stringify("roots"));
    migrateStoredViz();
    expect(JSON.parse(localStorage.getItem("qv.viz")!)).toBe("roots");
  });
  it("leaves the view alone for the old Charts tab", () => {
    localStorage.setItem("qv.viz", JSON.stringify("cloud"));
    localStorage.setItem("qv.dashboard.tab", JSON.stringify("charts"));
    migrateStoredViz();
    expect(JSON.parse(localStorage.getItem("qv.viz")!)).toBe("cloud");
    expect(localStorage.getItem("qv.dashboard.tab")).toBeNull();
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

  it("opens the map for an old #browse / tab=map link", () => {
    localStorage.setItem("qv.viz", JSON.stringify("cloud"));
    seedDashboardFromHash("#browse");
    expect(JSON.parse(localStorage.getItem("qv.viz")!)).toBe("map");
    expect(paramsToDashboard({ tab: "map", v: "pos" }, DEFAULT_FILTER).viz).toBe("pos");
    expect(dashboardToParams({ ...state, viz: "map" })).toEqual({
      v: "map",
      s: "revelation",
      r: "juz:28-30",
      p: "Medinan",
    });
  });

  it("carries the explorer's root or topic, and seeds it", () => {
    const p = dashboardToParams({ ...state, viz: "root-explorer", root: "ktb" });
    expect(p.root).toBe("ktb");
    expect(dashboardToParams({ ...state, root: "ktb" }).root).toBeUndefined();
    expect(paramsToDashboard({ topic: "aqidah.allah" }, DEFAULT_FILTER).topic).toBe(
      "aqidah.allah",
    );
    expect(paramsToDashboard({ root: "a/b c" }, DEFAULT_FILTER).root).toBeUndefined();
    seedDashboardFromHash("#dashboard?v=root-explorer&root=rHm");
    expect(JSON.parse(localStorage.getItem("qv.root")!)).toBe("rHm");
  });
});
