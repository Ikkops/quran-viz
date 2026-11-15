import { beforeEach, expect, it, vi } from "vitest";

// The plugin behind the wrapper: records calls; `fail` makes the next call throw.
const dev = vi.hoisted(() => ({
  native: true,
  display: "granted",
  calls: [] as [string, unknown][],
  fail: "",
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => dev.native },
}));
vi.mock("@capacitor/app", () => ({ App: { addListener: vi.fn() } }));
vi.mock("@capacitor/local-notifications", () => {
  const call = (name: string, result?: unknown) => async (arg?: unknown) => {
    dev.calls.push([name, arg]);
    if (dev.fail === name) throw new Error(name);
    return result;
  };
  return {
    LocalNotifications: {
      cancel: call("cancel"),
      schedule: call("schedule", { notifications: [] }),
      checkPermissions: async () => ({ display: dev.display }),
      requestPermissions: async () => {
        dev.calls.push(["request", undefined]);
        return { display: dev.display };
      },
    },
  };
});

import { REMINDER_IDS } from "./reminders";
import { requestReminderPermission, syncReminders } from "./remindersNative";

const note = (id: number) => ({
  id,
  at: new Date(2026, 4, 4, 20),
  title: "t",
  body: "b",
});

beforeEach(() => {
  dev.native = true;
  dev.display = "granted";
  dev.calls = [];
  dev.fail = "";
});

it("cancels every reserved id, then schedules the notes as inexact alarms", async () => {
  await syncReminders([note(7100), note(7101)]);
  expect(dev.calls.map(([n]) => n)).toEqual(["cancel", "schedule"]);
  expect(dev.calls[0][1]).toEqual({ notifications: REMINDER_IDS.map((id) => ({ id })) });
  const { notifications } = dev.calls[1][1] as {
    notifications: Record<string, unknown>[];
  };
  expect(notifications).toHaveLength(2);
  expect(notifications[0]).toMatchObject({
    id: 7100,
    title: "t",
    body: "b",
    isExactNotification: false,
    schedule: { at: note(7100).at, allowWhileIdle: true },
  });
});

it("only cancels when there is nothing to schedule or no permission", async () => {
  await syncReminders([]);
  dev.display = "denied";
  await syncReminders([note(7100)]);
  expect(dev.calls.map(([n]) => n)).toEqual(["cancel", "cancel"]);
});

it("swallows plugin errors", async () => {
  dev.fail = "schedule";
  await expect(syncReminders([note(7100)])).resolves.toBeUndefined();
  dev.fail = "cancel";
  await expect(syncReminders([note(7100)])).resolves.toBeUndefined();
});

it("does nothing off-native", async () => {
  dev.native = false;
  await syncReminders([note(7100)]);
  expect(await requestReminderPermission()).toBe(false);
  expect(dev.calls).toEqual([]);
});

it("asks for the permission only when not yet granted", async () => {
  expect(await requestReminderPermission()).toBe(true);
  dev.display = "denied";
  expect(await requestReminderPermission()).toBe(false);
  expect(dev.calls).toEqual([["request", undefined]]);
});
