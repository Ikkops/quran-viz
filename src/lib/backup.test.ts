import { beforeEach, describe, expect, it } from "vitest";
import { applyBackup, buildBackup, readBackup } from "./backup";

beforeEach(() => localStorage.clear());

describe("backup", () => {
  it("saves the app's keys and nothing else", () => {
    localStorage.setItem("qv.marks", JSON.stringify({ pins: [] }));
    localStorage.setItem("quranviz.theme", JSON.stringify({ theme: "sepia" }));
    localStorage.setItem("qv.audio.location", JSON.stringify("/sdcard/audio"));
    localStorage.setItem("other", JSON.stringify(1));
    localStorage.setItem("qv.broken", "{");
    const b = buildBackup(localStorage, "2026-11-15");
    expect(b.data).toEqual({
      "qv.marks": { pins: [] },
      "quranviz.theme": { theme: "sepia" },
    });
    expect(b.saved).toBe("2026-11-15");
  });

  it("rejects files that are not a backup", () => {
    expect(readBackup(null)).toBeNull();
    expect(readBackup({ pins: [], collections: [] })).toBeNull();
    expect(readBackup({ app: "quran-viz", data: { other: 1 } })).toBeNull();
  });

  it("replaces the stored state and leaves foreign keys alone", () => {
    localStorage.setItem("qv.hifdh", JSON.stringify({ status: "2" }));
    const file = JSON.parse(JSON.stringify(buildBackup(localStorage, "2026-11-15")));
    localStorage.clear();
    localStorage.setItem("qv.lang", JSON.stringify("en"));
    localStorage.setItem("qv.audio.location", JSON.stringify("/here"));
    localStorage.setItem("other", "kept");
    applyBackup(readBackup(file)!, localStorage);
    expect(localStorage.getItem("qv.hifdh")).toBe(JSON.stringify({ status: "2" }));
    expect(localStorage.getItem("qv.lang")).toBeNull();
    expect(localStorage.getItem("qv.audio.location")).toBe(JSON.stringify("/here"));
    expect(localStorage.getItem("other")).toBe("kept");
  });
});
