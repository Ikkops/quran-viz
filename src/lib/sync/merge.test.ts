import { describe, expect, it } from "vitest";
import { emptyHifdh, rateReview, removeStumble, addStumble, setStatus } from "../hifdh";
import {
  addPin,
  deleteMark,
  editMark,
  initialMarks,
  MARK_COLORS,
  toggleInCollection,
} from "../marks";
import {
  canonical,
  mergeDocs,
  mergeHifdh,
  mergeLastRead,
  mergeLog,
  mergeMarks,
  mergePrefs,
  mergeReading,
  sanitizeDoc,
  type SyncDoc,
} from "./merge";

const names = { pin: "Tilawah", collection: "Favourites" };
const base = initialMarks(names);
const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

describe("mergeMarks", () => {
  it("keeps what either device added", () => {
    const a = addPin(base, "Hafalan", MARK_COLORS[0], 7, 100);
    const b = toggleInCollection(base, "c1", 255, 200);
    const m = mergeMarks(a, b, NOW)!;
    expect(m.pins.map((p) => p.name)).toEqual(["Tilawah", "Hafalan"]);
    expect(m.collections[0].items.map((i) => i.id)).toEqual([255]);
  });

  it("takes the newer edit of the same pin", () => {
    const a = editMark(base, "p1", { name: "Morning" }, 100);
    const b = editMark(base, "p1", { name: "Evening" }, 200);
    expect(mergeMarks(a, b, NOW)!.pins[0].name).toBe("Evening");
    expect(mergeMarks(b, a, NOW)!.pins[0].name).toBe("Evening");
  });

  it("lets a deletion beat older changes and lose to newer ones", () => {
    const T = NOW - DAY;
    const withItem = toggleInCollection(base, "c1", 5, T + 100);
    const removed = toggleInCollection(withItem, "c1", 5, T + 200);
    // The other device still has the ayah from before: it stays removed.
    expect(mergeMarks(withItem, removed, NOW)!.collections[0].items).toEqual([]);
    // Added back later on the other device: it stays.
    const addedBack = toggleInCollection(base, "c1", 5, T + 300);
    expect(
      mergeMarks(removed, addedBack, NOW)!.collections[0].items.map((i) => i.id),
    ).toEqual([5]);
    const pinGone = deleteMark(base, "p1", T + 400);
    expect(mergeMarks(base, pinGone, NOW)!.pins).toEqual([]);
  });

  it("forgets deletion markers after half a year", () => {
    const gone = deleteMark(base, "p1", NOW - 200 * DAY);
    expect(mergeMarks(gone, gone, NOW)!.gone).toBeUndefined();
  });
});

describe("mergeHifdh", () => {
  it("keeps each ayah's newest status", () => {
    const a = setStatus(emptyHifdh(), 1, 10, 2, 100);
    const b = setStatus(setStatus(emptyHifdh(), 5, 6, 3, 200), 20, 20, 1, 50);
    const m = mergeHifdh(a, b)!;
    expect(m.status.slice(0, 10)).toBe("2222332222");
    expect(m.status[19]).toBe("1");
    expect(m.statusAt).toMatchObject({ 1: 100, 5: 200, 20: 50 });
  });

  it("without times, marking on one device is never undone by the other", () => {
    const a = { ...setStatus(emptyHifdh(), 1, 3, 2), statusAt: undefined };
    expect(mergeHifdh(emptyHifdh(), a)!.status.slice(0, 3)).toBe("222");
    expect(mergeHifdh(a, emptyHifdh())!.status.slice(0, 3)).toBe("222");
  });

  it("keeps the newest rating, stumble and recall target", () => {
    const page = [{ page: 1, from: 1, to: 7 }];
    const h = setStatus(emptyHifdh(), 1, 7, 2, 1);
    const a = rateReview(h, page, "smooth", "2026-11-20", 100);
    const b = rateReview(h, page, "forgot", "2026-11-21", 200);
    expect(mergeHifdh(a, b)!.reviews[1].at).toBe(200);
    expect(mergeHifdh(b, a)!.reviews[1].at).toBe(200);
    const stumbled = addStumble(h, 3, 0, 100);
    const cleared = removeStumble(stumbled, 3, 0, 200);
    expect(mergeHifdh(stumbled, cleared)!.stumbles["3:0"]).toEqual({ n: 0, at: 200 });
    const r = mergeHifdh(
      { ...h, retention: 0.95, retentionAt: 300 },
      { ...h, retention: 0.85, retentionAt: 100 },
    )!;
    expect(r.retention).toBe(0.95);
  });
});

describe("the rest", () => {
  it("adds reading time per device, never twice", () => {
    const a = { phone: { "2026-11-25": 300 } };
    const b = { phone: { "2026-11-25": 120 }, desktop: { "2026-11-25": 600 } };
    expect(mergeReading(a, b)).toEqual({
      phone: { "2026-11-25": 300 },
      desktop: { "2026-11-25": 600 },
    });
  });

  it("keeps every rating once, every surah's newest place, every setting's newest value", () => {
    expect(
      mergeLog(
        [
          [1, 3, 100],
          [2, 1, 300],
        ],
        [
          [1, 3, 100],
          [5, 2, 200],
        ],
      ),
    ).toEqual([
      [1, 3, 100],
      [5, 2, 200],
      [2, 1, 300],
    ]);
    expect(
      mergeLastRead(
        [{ id: 10, s: 2, at: 100 }],
        [
          { id: 30, s: 2, at: 200 },
          { id: 300, s: 3, at: 50 },
        ],
      ),
    ).toEqual([
      { id: 30, s: 2, at: 200 },
      { id: 300, s: 3, at: 50 },
    ]);
    expect(
      mergePrefs({ "qv.lang": { v: "id", t: 100 } }, { "qv.lang": { v: "en", t: 50 } }),
    ).toEqual({ "qv.lang": { v: "id", t: 100 } });
  });
});

describe("mergeDocs", () => {
  const doc = (over: Partial<SyncDoc>): SyncDoc => ({
    app: "quran-viz",
    v: 1,
    log: [],
    reading: {},
    lastRead: [],
    prefs: {},
    ...over,
  });
  const a = doc({
    marks: addPin(base, "Hafalan", MARK_COLORS[0], 7, 100),
    hifdh: setStatus(emptyHifdh(), 1, 5, 2, 100),
    reading: { phone: { "2026-11-25": 60 } },
    prefs: { "qv.reading.goal": { v: 10, t: 100 } },
  });
  const b = doc({
    marks: toggleInCollection(base, "c1", 9, 200),
    hifdh: setStatus(emptyHifdh(), 4, 8, 3, 200),
    reading: { desktop: { "2026-11-25": 90 } },
    prefs: { "qv.reading.goal": { v: 20, t: 200 } },
  });
  // Order within lists can differ by which copy came first; the content can't.
  const sorted = (d: SyncDoc) => ({
    ...d,
    marks: d.marks && {
      ...d.marks,
      pins: [...d.marks.pins].sort((x, y) => (x.id < y.id ? -1 : 1)),
    },
  });

  it("gives the same copy whichever device syncs first", () => {
    expect(canonical(sorted(mergeDocs(a, b, NOW)))).toBe(
      canonical(sorted(mergeDocs(b, a, NOW))),
    );
  });

  it("changes nothing when merged with itself", () => {
    const m = mergeDocs(a, b, NOW);
    expect(canonical(mergeDocs(m, m, NOW))).toBe(canonical(m));
  });

  it("survives a round trip through JSON", () => {
    const m = mergeDocs(a, b, NOW);
    expect(canonical(sanitizeDoc(JSON.parse(JSON.stringify(m))))).toBe(canonical(m));
    expect(sanitizeDoc({ app: "other" })).toBeNull();
  });
});
