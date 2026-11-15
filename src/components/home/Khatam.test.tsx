import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { addDays, dayKey } from "../../data/readingLog";
import { KHATAM_KEY } from "../../lib/khatam";
import { KhatamCard } from "./Khatam";

beforeEach(() => localStorage.clear());

describe("KhatamCard", () => {
  it("sets a target, shows the plan, and removes it", async () => {
    render(<KhatamCard currentPage={4} />);
    const set = screen.getByRole("button", { name: "Set target" });
    expect(set).toBeDisabled();
    // 20 days from today, today included: 600 pages → 30 a day.
    fireEvent.change(screen.getByLabelText("Finish by"), {
      target: { value: addDays(dayKey(new Date()), 19) },
    });
    await userEvent.click(set);
    expect(screen.getByText("600 pages left · 30 pages a day")).toBeInTheDocument();
    expect(screen.getByText("On schedule")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Progress to khatam" }),
    ).toHaveAttribute("aria-valuenow", "0");
    expect(JSON.parse(localStorage.getItem(KHATAM_KEY)!)).toMatchObject({ from: 4 });

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("button", { name: "Set target" })).toBeInTheDocument();
    expect(localStorage.getItem(KHATAM_KEY)).toBe("null");
  });
});
