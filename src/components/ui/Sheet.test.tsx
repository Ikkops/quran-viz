import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sheet } from ".";

/** One touch event on `el` at height `y`, stamped `t` ms. */
function touch(
  type: "touchStart" | "touchMove" | "touchEnd",
  el: Element,
  y: number,
  t: number,
) {
  const point = [{ clientX: 100, clientY: y }];
  const ev = createEvent[type](el, {
    touches: type === "touchEnd" ? [] : point,
    changedTouches: point,
  });
  Object.defineProperty(ev, "timeStamp", { value: t });
  fireEvent(el, ev);
}

function open(onClose: () => void) {
  render(
    <Sheet open onClose={onClose} title="Tajweed rules" closeLabel="Close">
      <p>Body</p>
    </Sheet>,
  );
  return screen.getByRole("dialog", { name: "Tajweed rules" });
}

describe("Sheet", () => {
  // jsdom lays nothing out: give the panel a height to measure a drag against.
  let height: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
  });
  afterEach(() => height.mockRestore());

  it("closes when dragged down far enough", () => {
    const onClose = vi.fn();
    const title = open(onClose).querySelector("h2")!;
    touch("touchStart", title, 100, 0);
    touch("touchMove", title, 250, 400);
    touch("touchMove", title, 320, 800);
    touch("touchEnd", title, 320, 1200);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open after a short, slow drag", () => {
    const onClose = vi.fn();
    const title = open(onClose).querySelector("h2")!;
    touch("touchStart", title, 100, 0);
    touch("touchMove", title, 130, 400);
    touch("touchMove", title, 150, 800);
    touch("touchEnd", title, 150, 1200);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on a quick flick down", () => {
    const onClose = vi.fn();
    const title = open(onClose).querySelector("h2")!;
    touch("touchStart", title, 100, 0);
    touch("touchMove", title, 120, 20);
    touch("touchMove", title, 160, 50);
    touch("touchEnd", title, 160, 60);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves scrolled content to scroll", () => {
    const onClose = vi.fn();
    const dialog = open(onClose);
    const body = screen.getByText("Body");
    body.parentElement!.scrollTop = 40;
    touch("touchStart", body, 100, 0);
    touch("touchMove", body, 320, 400);
    touch("touchEnd", body, 320, 800);
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
  });

  it("closes a top sheet dragged up, not down", () => {
    const onClose = vi.fn();
    render(
      <Sheet open side="top" onClose={onClose} title="Go to" closeLabel="Close">
        <p>Body</p>
      </Sheet>,
    );
    const title = screen.getByRole("dialog").querySelector("h2")!;
    touch("touchStart", title, 400, 0);
    touch("touchMove", title, 600, 400);
    touch("touchEnd", title, 600, 800);
    expect(onClose).not.toHaveBeenCalled();
    touch("touchStart", title, 400, 1000);
    touch("touchMove", title, 250, 1400);
    touch("touchMove", title, 180, 1800);
    touch("touchEnd", title, 180, 2200);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("still closes with Escape, the close button and the backdrop", () => {
    const onClose = vi.fn();
    const dialog = open(onClose);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(dialog.previousElementSibling!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
