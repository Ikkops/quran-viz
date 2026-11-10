import { describe, expect, it } from "vitest";
import { asbabCountBySurah, ceRange, groupByTimeline } from "./chronology";
import type { AsbabData, ChronologyData, Surah, Verse } from "../types/quran";

// Raw text via Vite (no Node types in this project).
const files = import.meta.glob<string>("../../public/data/{surahs,chronology}.json", {
  query: "?raw",
  import: "default",
  eager: true,
});
const load = <T>(f: string): T => JSON.parse(files[`../../public/data/${f}`]) as T;

const surahs = load<Surah[]>("surahs.json");
const chrono = load<ChronologyData>("chronology.json");

describe("groupByTimeline", () => {
  const phases = groupByTimeline(surahs, chrono, true);

  it("places all 114 surahs once, Makkah before Madinah", () => {
    expect(phases.map((p) => p.phase)).toEqual(["Meccan", "Medinan"]);
    const ids = phases.flatMap((p) =>
      p.periods.flatMap((x) => x.groups.flatMap((g) => g.surahs)),
    );
    expect(ids).toHaveLength(114);
    expect(new Set(ids.map((s) => s.id)).size).toBe(114);
  });

  it("puts Al-Anfal under Badr and keeps marker events before unmarked surahs", () => {
    const y2 = phases[1].periods.find((p) => p.period.id === "y2")!;
    const badr = y2.groups.find((g) => g.event === 1)!;
    expect(y2.period.events[1].label.en).toMatch(/Badr/);
    expect(badr.surahs.map((s) => s.id)).toEqual([8]);
    const m1 = phases[0].periods[0];
    expect(m1.groups.map((g) => g.event)).toEqual([0, 1, null]);
    expect(m1.groups[2].surahs.map((s) => s.revelationOrder)).toEqual(
      [...m1.groups[2].surahs.map((s) => s.revelationOrder)].sort((a, b) => a - b),
    );
  });

  it("keeps empty years as event-only rows only when asked", () => {
    const y7 = phases[1].periods.find((p) => p.period.id === "y7")!;
    expect(y7.groups).toEqual([]);
    const meccanOnly = groupByTimeline(
      surahs.filter((s) => s.type === "Meccan"),
      chrono,
      false,
    );
    expect(meccanOnly.map((p) => p.phase)).toEqual(["Meccan"]);
  });
});

describe("asbabCountBySurah / ceRange", () => {
  it("counts distinct ayahs with asbab per surah", () => {
    const verses = [1, 2, 3, 4].map((id) => ({ id, s: id < 4 ? 1 : 2 }) as Verse);
    const asbab: AsbabData = {
      source: "",
      items: [
        [1, 2, ["x"]],
        [2, 3, ["y"]],
        [4, 4, ["z"]],
      ],
    };
    expect([...asbabCountBySurah(asbab, verses)]).toEqual([
      [1, 3],
      [2, 1],
    ]);
  });

  it("spans the first and last period years", () => {
    const meccan = chrono.periods.filter((p) => p.phase === "Meccan");
    expect(ceRange(meccan)).toBe("610–622");
  });
});
