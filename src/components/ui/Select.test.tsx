import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Select, Sheet } from ".";

const OPTIONS = [
  { value: "a", label: "Al-Fatihah", group: "Indonesia" },
  { value: "b", label: "Al-Baqarah", group: "Indonesia" },
  { value: "c", label: "Ali 'Imran", group: "English" },
];

describe("Select", () => {
  it("opens a styled listbox and picks an option", async () => {
    const onChange = vi.fn();
    render(<Select label="Surah" value="a" options={OPTIONS} onChange={onChange} />);
    const trigger = screen.getByRole("combobox", { name: /Surah/ });
    expect(trigger).toHaveTextContent("Al-Fatihah");
    expect(screen.queryByRole("listbox")).toBeNull();
    await userEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("Indonesia")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Al-Fatihah" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.click(screen.getByRole("option", { name: "Al-Baqarah" }));
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("moves with the arrow keys and picks with Enter", async () => {
    const onChange = vi.fn();
    render(<Select ariaLabel="Surah" value="a" options={OPTIONS} onChange={onChange} />);
    screen.getByRole("combobox").focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("filters a searchable list, ignoring apostrophes", async () => {
    const onChange = vi.fn();
    render(
      <Select
        ariaLabel="Surah"
        value="a"
        options={OPTIONS}
        onChange={onChange}
        searchable
      />,
    );
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(screen.getByRole("searchbox"), "ali im");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("closes on Escape without closing the sheet around it", async () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Options" closeLabel="Close">
        <Select ariaLabel="Surah" value="a" options={OPTIONS} onChange={() => {}} />
      </Sheet>,
    );
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Sheet", () => {
  it("keeps focus in a field when its parent re-renders", async () => {
    vi.useFakeTimers();
    let bump = () => {};
    function Parent() {
      const [n, setN] = useState(0);
      bump = () => setN((x) => x + 1);
      return (
        <>
          <button type="button">opener {n}</button>
          {/* An inline onClose: a new function on every render. */}
          <Sheet open onClose={() => {}} title="Name" closeLabel="Close">
            <input aria-label="Name" autoFocus />
          </Sheet>
        </>
      );
    }
    render(<Parent />);
    act(() => vi.runAllTimers());
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveFocus();
    act(() => bump());
    act(() => vi.runAllTimers());
    act(() => bump());
    act(() => vi.runAllTimers());
    expect(input).toHaveFocus();
    vi.useRealTimers();
  });
});
