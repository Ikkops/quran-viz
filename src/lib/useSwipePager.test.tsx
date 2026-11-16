import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  inHorizontalScroller,
  pastThreshold,
  releaseCommits,
  swipeDir,
  swipeOffset,
  useSwipePager,
  type SwipeDir,
} from "./useSwipePager";

describe("pager maths", () => {
  it("goes next on a left swipe", () => {
    expect(swipeDir(-40)).toBe(1);
    expect(swipeDir(40)).toBe(-1);
  });
  it("follows 1:1, rubber-banded with nothing there", () => {
    expect(swipeOffset(-100, true)).toBe(-100);
    expect(swipeOffset(-100, false)).toBeCloseTo(-30);
  });
  it("crosses the threshold at 30% of the width", () => {
    expect(pastThreshold(-89, 300)).toBe(false);
    expect(pastThreshold(-91, 300)).toBe(true);
  });
  it("commits past 30% or on a flick in the drag's direction", () => {
    expect(releaseCommits(-100, 300, 0, true)).toBe(true);
    expect(releaseCommits(-40, 300, 0, true)).toBe(false);
    expect(releaseCommits(-40, 300, -1, true)).toBe(true);
    expect(releaseCommits(-100, 300, 1, true)).toBe(false);
    expect(releaseCommits(120, 300, 0, true)).toBe(true);
    expect(releaseCommits(-200, 300, -1, false)).toBe(false);
  });
  it("finds a sideways scroller below the container", () => {
    const root = document.createElement("div");
    const strip = document.createElement("div");
    const leaf = document.createElement("span");
    strip.style.overflowX = "auto";
    Object.defineProperty(strip, "scrollWidth", { value: 500 });
    Object.defineProperty(strip, "clientWidth", { value: 200 });
    strip.append(leaf);
    root.append(strip);
    expect(inHorizontalScroller(leaf, root)).toBe(true);
    expect(inHorizontalScroller(root, root)).toBe(false);
  });
});

let renders = 0;
function Pager({
  can,
  onCommit,
  ahead = false,
}: {
  can: boolean;
  onCommit: (d: SwipeDir) => void;
  ahead?: boolean;
}) {
  renders++;
  const [i, setI] = useState(0);
  const { handlers, sides, trackRef } = useSwipePager({
    current: i,
    canGo: () => can,
    onCommit: (d) => {
      onCommit(d);
      setI((n) => n + d);
    },
    ahead,
  });
  return (
    <div data-testid="pager" className="overflow-hidden touch-pan-y" {...handlers}>
      <div ref={trackRef} data-testid="track" className="relative">
        <p>pane {i}</p>
        {sides.map((d) => (
          <p key={d} aria-hidden>
            pane {i + d}
          </p>
        ))}
      </div>
    </div>
  );
}

describe("useSwipePager", () => {
  let now = 0;
  beforeEach(() => {
    // Moves 50 ms apart: slow enough that only distance decides.
    vi.spyOn(Event.prototype, "timeStamp", "get").mockImplementation(() => (now += 50));
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(300);
  });
  afterEach(() => vi.restoreAllMocks());

  const swipe = (to: number) => {
    const el = screen.getByTestId("pager");
    fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 100 }] });
    for (const x of [200 - to / 4, 200 - to / 2, 200 - to])
      fireEvent.touchMove(el, { touches: [{ clientX: x, clientY: 100 }] });
    fireEvent.touchEnd(el, { touches: [] });
  };

  it("commits a long left swipe and settles on the new pane", () => {
    const onCommit = vi.fn();
    render(<Pager can onCommit={onCommit} />);
    swipe(150);
    expect(onCommit).toHaveBeenCalledWith(1);
    expect(screen.getByText("pane 1")).toBeInTheDocument();
    expect(screen.queryByText("pane 2")).toBeNull();
  });
  it("springs back from a short swipe", () => {
    const onCommit = vi.fn();
    render(<Pager can onCommit={onCommit} />);
    swipe(40);
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText("pane 0")).toBeInTheDocument();
  });
  it("mounts both neighbours at the first drag, and drops them once it settles", () => {
    render(<Pager can onCommit={vi.fn()} />);
    expect(screen.queryByText("pane 1")).toBeNull();
    const el = screen.getByTestId("pager");
    fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(el, { touches: [{ clientX: 160, clientY: 100 }] });
    expect(screen.getByText("pane 1")).toBeInTheDocument();
    expect(screen.getByText("pane -1")).toBeInTheDocument();
    expect(screen.getByTestId("track").style.willChange).toBe("transform");
    fireEvent.touchEnd(el, { touches: [] });
    expect(screen.queryByText("pane 1")).toBeNull();
    expect(screen.getByTestId("track").style.willChange).toBe("");
  });
  it("with `ahead`, mounts the neighbours when idle and renders nothing during a drag", async () => {
    vi.useFakeTimers();
    try {
      render(<Pager can ahead onCommit={vi.fn()} />);
      expect(screen.queryByText("pane 1")).toBeNull();
      await act(() => vi.advanceTimersByTimeAsync(300));
      expect(screen.getByText("pane 1")).toBeInTheDocument();
      expect(screen.getByText("pane -1")).toBeInTheDocument();
      const before = renders;
      const el = screen.getByTestId("pager");
      fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 100 }] });
      for (const x of [190, 170, 150, 140])
        fireEvent.touchMove(el, { touches: [{ clientX: x, clientY: 100 }] });
      expect(renders).toBe(before);
      expect(screen.getByTestId("track").style.transform).toBe("translateX(-60px)");
      fireEvent.touchEnd(el, { touches: [] });
      // A short drag springs back: still no render, neighbours stay.
      expect(renders).toBe(before);
      expect(screen.getByText("pane 1")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
  it("never commits with nothing on that side", () => {
    const onCommit = vi.fn();
    render(<Pager can={false} onCommit={onCommit} />);
    swipe(250);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
