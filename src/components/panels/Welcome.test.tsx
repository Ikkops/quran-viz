import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../theme/ThemeContext";
import type { Edition } from "../../types/quran";
import { Modal, ModalHeader, Toggle } from "../ui";
import { Welcome } from "./Welcome";

const ed = (identifier: string, language: string): Edition => ({
  identifier,
  language,
  name: identifier,
  englishName: identifier,
  type: "translation",
  count: 6236,
});

describe("Welcome", () => {
  it("offers the reader's translations and both destinations", async () => {
    const onDone = vi.fn();
    const onEdition = vi.fn();
    render(
      <ThemeProvider>
        <Welcome
          open
          onDone={onDone}
          editions={[ed("en.sahih", "en"), ed("id.kemenag-qul", "id"), ed("fr.x", "fr")]}
          edition="en.sahih"
          onEdition={onEdition}
          onAbout={() => {}}
        />
      </ThemeProvider>,
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleName(/Read the Qur'an/);
    // English UI: English editions only (no French).
    expect(screen.getByRole("option", { name: "en.sahih" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "fr.x" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Explore the map/ }));
    expect(onDone).toHaveBeenCalledWith("map");
    await userEvent.click(screen.getByRole("button", { name: /Amiri$/ }));
    expect(screen.getByRole("button", { name: /Amiri$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("Modal stack", () => {
  it("names a dialog by its header and lets Escape close only the top one", async () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    render(
      <>
        <Modal open onClose={closeA}>
          <ModalHeader title="First" onClose={closeA} />
        </Modal>
        <Modal open onClose={closeB}>
          <ModalHeader title="Second" onClose={closeB} />
        </Modal>
      </>,
    );
    expect(screen.getByRole("dialog", { name: "Second" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(2);
    await userEvent.keyboard("{Escape}");
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
  });

  it("renders Toggle as a switch", async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Tajweed" />);
    const sw = screen.getByRole("switch", { name: "Tajweed" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
