import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../theme/ThemeContext";
import { SettingsView } from "../../views/SettingsView";
import { REMINDERS_KEY } from "../../lib/reminders";

const app = vi.hoisted(() => ({ native: false, grant: vi.fn(async () => true) }));
vi.mock("../../data/audioStore", async (orig) => ({
  ...(await orig<typeof import("../../data/audioStore")>()),
  isNativeApp: () => app.native,
}));
vi.mock("./AudioStorageSettings", () => ({ AudioStorageSettings: () => null }));
vi.mock("../../lib/remindersNative", async (orig) => ({
  ...(await orig<typeof import("../../lib/remindersNative")>()),
  requestReminderPermission: app.grant,
}));

const settings = () =>
  render(
    <ThemeProvider>
      <SettingsView
        surahs={[]}
        settings={{ bucketSize: 5, extremesCount: 5, uiScale: 1 }}
        onSettings={() => {}}
        lastReadCount={5}
        onLastReadCount={() => {}}
        onAbout={() => {}}
        onWelcome={() => {}}
      />
    </ThemeProvider>,
  );
const stored = () => JSON.parse(localStorage.getItem(REMINDERS_KEY) ?? "null");

beforeEach(() => {
  localStorage.clear();
  app.native = false;
  app.grant.mockReset();
});

it("is not shown in a browser", () => {
  settings();
  expect(screen.queryByRole("heading", { name: "Reminders" })).toBeNull();
});

it("asks for the permission when a reminder is turned on, then saves it", async () => {
  app.native = true;
  app.grant.mockResolvedValue(true);
  settings();
  expect(screen.getByRole("heading", { name: "Reminders" })).toBeInTheDocument();
  const reading = screen.getByRole("switch", { name: "Daily reading goal" });
  await userEvent.click(reading);
  expect(app.grant).toHaveBeenCalledOnce();
  await waitFor(() => expect(reading).toHaveAttribute("aria-checked", "true"));
  expect(stored().reading).toEqual({ on: true, time: "20:00" });
  expect(screen.getByLabelText("Memorisation review: Time")).toHaveValue("05:30");
});

it("stays off with a note when notifications are denied", async () => {
  app.native = true;
  app.grant.mockResolvedValue(false);
  settings();
  const hifdh = screen.getByRole("switch", { name: "Memorisation review" });
  await userEvent.click(hifdh);
  expect(await screen.findByRole("status")).toHaveTextContent(/blocked/);
  expect(hifdh).toHaveAttribute("aria-checked", "false");
  expect(stored().hifdh.on).toBe(false);
});
