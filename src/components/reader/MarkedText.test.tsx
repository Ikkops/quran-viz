import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TranslationText } from "./MarkedText";

describe("TranslationText", () => {
  it("numbers the footnotes and shows a note when its marker is pressed", async () => {
    render(
      <p>
        <TranslationText
          text="who establish prayer, and spend"
          notes={[
            [21, "The five daily prayers."],
            [31, "In charity."],
          ]}
          hits={{ ranges: [[14, 20]], current: 0 }}
        />
      </p>,
    );
    expect(screen.queryByText("The five daily prayers.")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Footnote 1" }));
    expect(screen.getByText("The five daily prayers.")).toBeInTheDocument();
    // The search hit is still marked, as the current one.
    const mark = document.querySelector("mark");
    expect(mark).toHaveTextContent("prayer");
    expect(mark).toHaveAttribute("data-match-current", "true");
  });
});
