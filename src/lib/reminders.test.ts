// A zone with a DST change (EU: clocks go forward on 2026-03-29), set before
// any Date is made so local-time maths is checked across it.
process.env.TZ = "Europe/Berlin";

import { describe, expect, it } from "vitest";
import { dayKey } from "../data/readingLog";
import { emptyHifdh, setStatus, type Hifdh } from "./hifdh";
import {
  DEFAULT_REMINDERS,
  REMINDER_IDS,
  nextReminders,
  sanitizeReminders,
  type ReminderSettings,
} from "./reminders";

// Two mushaf pages: ayahs 1–7 on page 1, 8–12 on page 2.
const verses = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, page: i < 7 ? 1 : 2 }));
const on = (reading: boolean, hifdh: boolean): ReminderSettings => ({
  reading: { on: reading, time: "20:00" },
  hifdh: { on: hifdh, time: "05:30" },
});
const state = (over: { log?: Record<string, number>; hifdh?: Hifdh } = {}) => ({
  goalMinutes: 10,
  log: {},
  hifdh: emptyHifdh(),
  verses,
  ...over,
});
const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min);
const days = (list: { at: Date }[]) => list.map((r) => dayKey(r.at));

describe("nextReminders", () => {
  it("is empty with both reminders off", () => {
    expect(nextReminders(at(2026, 5, 4, 9), on(false, false), state())).toEqual([]);
  });

  it("schedules the reading reminder for 7 days at its time", () => {
    const list = nextReminders(at(2026, 5, 4, 9), on(true, false), state());
    expect(days(list)).toEqual([
      "2026-05-04",
      "2026-05-05",
      "2026-05-06",
      "2026-05-07",
      "2026-05-08",
      "2026-05-09",
      "2026-05-10",
    ]);
    expect(list.every((r) => r.at.getHours() === 20 && r.at.getMinutes() === 0)).toBe(
      true,
    );
    expect(list.every((r) => r.kind === "reading" && REMINDER_IDS.includes(r.id))).toBe(
      true,
    );
    expect(new Set(list.map((r) => r.id)).size).toBe(7);
  });

  it("skips today once its time has passed", () => {
    const list = nextReminders(at(2026, 5, 4, 20, 0), on(true, false), state());
    expect(days(list)[0]).toBe("2026-05-05");
    expect(list).toHaveLength(6);
  });

  it("skips today when the goal is met, but not later days", () => {
    const met = state({ log: { "2026-05-04": 600 } });
    expect(days(nextReminders(at(2026, 5, 4, 9), on(true, false), met))[0]).toBe(
      "2026-05-05",
    );
    const short = state({ log: { "2026-05-04": 599 } });
    expect(days(nextReminders(at(2026, 5, 4, 9), on(true, false), short))[0]).toBe(
      "2026-05-04",
    );
  });

  it("keeps the local time across a DST change", () => {
    const list = nextReminders(at(2026, 3, 27, 9), on(true, false), state());
    expect(days(list)).toEqual([
      "2026-03-27",
      "2026-03-28",
      "2026-03-29",
      "2026-03-30",
      "2026-03-31",
      "2026-04-01",
      "2026-04-02",
    ]);
    expect(list.map((r) => r.at.getHours())).toEqual(Array(7).fill(20));
    // The zone really changed offset in between.
    expect(list[0].at.getTimezoneOffset()).not.toBe(list[6].at.getTimezoneOffset());
  });

  it("reminds of hifdh review only on days with pages due, with the count", () => {
    // Page 1 due on the 6th, page 2 on the 8th; both memorised.
    const h: Hifdh = {
      ...setStatus(emptyHifdh(), 1, 12, 2),
      reviews: { 1: { due: "2026-05-06", step: 1 }, 2: { due: "2026-05-08", step: 4 } },
    };
    const list = nextReminders(at(2026, 5, 4, 4), on(false, true), state({ hifdh: h }));
    expect(list.map((r) => [dayKey(r.at), r.count])).toEqual([
      ["2026-05-06", 1],
      ["2026-05-07", 1],
      ["2026-05-08", 2],
      ["2026-05-09", 2],
      ["2026-05-10", 2],
    ]);
    expect(list.every((r) => r.at.getHours() === 5 && r.at.getMinutes() === 30)).toBe(
      true,
    );
  });

  it("has no hifdh reminder when nothing is memorised", () => {
    expect(nextReminders(at(2026, 5, 4, 4), on(false, true), state())).toEqual([]);
  });

  it("gives each kind its own ids", () => {
    const h = setStatus(emptyHifdh(), 1, 7, 2); // never reviewed: due every day
    const list = nextReminders(at(2026, 5, 4, 4), on(true, true), state({ hifdh: h }));
    expect(list).toHaveLength(14);
    expect(new Set(list.map((r) => r.id)).size).toBe(14);
  });
});

describe("sanitizeReminders", () => {
  it("repairs each part on its own", () => {
    expect(sanitizeReminders(null)).toBeUndefined();
    expect(
      sanitizeReminders({ reading: { on: true, time: "25:00" }, hifdh: "x" }),
    ).toEqual({
      reading: { on: true, time: "20:00" },
      hifdh: DEFAULT_REMINDERS.hifdh,
    });
    expect(sanitizeReminders(on(true, true))).toEqual(on(true, true));
  });
});
