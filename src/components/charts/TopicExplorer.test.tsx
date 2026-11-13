import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TopicExplorer } from "./TopicExplorer";
import { buildTopicTree } from "../../data/topics";
import { PALETTES } from "../../theme/palettes";
import type { Surah, TopicNode, Verse } from "../../types/quran";
import type { ChartContext } from "./common";

// recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const NODES: TopicNode[] = [
  { k: "sejarah", en: "Stories & History", id: "Kisah & Sejarah", p: -1 },
  { k: "sejarah.nabi", en: "Stories of the Prophets", id: "Kisah Para Nabi", p: 0 },
  { k: "t20", en: "Moses", id: "Musa", p: 1, ar: "موسى", v: [1, 2, 3, 5] },
  { k: "t2334", en: "childhood", id: "Masa kecil", p: 2, v: [3] },
  { k: "ibadah", en: "Worship", id: "Ibadah", p: -1, v: [4] },
];

const VERSES = [
  { id: 1, s: 2, a: 49 },
  { id: 2, s: 2, a: 50 },
  { id: 3, s: 2, a: 51 },
  { id: 4, s: 2, a: 60 },
  { id: 5, s: 20, a: 9 },
] as Verse[];

const SURAHS = new Map<number, Surah>([
  [2, { id: 2, nameEn: "Al-Baqarah", type: "Medinan" } as Surah],
  [20, { id: 20, nameEn: "Taha", type: "Meccan" } as Surah],
]);

function Harness({ onOpen }: { onOpen: ChartContext["onOpen"] }) {
  const [key, setKey] = useState<string | null>(null);
  const ctx: ChartContext = {
    palette: Object.values(PALETTES)[0],
    primary: "#4d7c0f",
    colorMode: "type",
    dark: false,
    onOpen,
  };
  return (
    <TopicExplorer
      tree={buildTopicTree(NODES)}
      verses={VERSES}
      surahMap={SURAHS}
      ctx={ctx}
      selectedKey={key}
      onSelectKey={setKey}
    />
  );
}

describe("TopicExplorer", () => {
  it("drills from a category down to a topic and groups its verses by surah", () => {
    const onOpen = vi.fn();
    render(<Harness onOpen={onOpen} />);

    // Top level: categories with their verse counts.
    fireEvent.click(screen.getByRole("button", { name: /Stories & History/ }));
    fireEvent.click(screen.getByRole("button", { name: /Stories of the Prophets/ }));
    fireEvent.click(screen.getByRole("button", { name: /Moses/ }));

    // Breadcrumb shows the path; the subtopic is listed.
    const crumbs = screen.getByRole("navigation");
    expect(crumbs.textContent).toContain("Stories of the Prophets");
    expect(screen.getByRole("button", { name: /childhood/ })).toBeTruthy();

    // 2:49–51 fold into one run; Taha 9 stands alone.
    const run = screen.getByRole("button", { name: "49–51" });
    expect(screen.getByRole("button", { name: "9" })).toBeTruthy();
    fireEvent.click(run);
    expect(onOpen).toHaveBeenCalledWith({ scope: "surah", value: 2, anchor: 1 });
  });

  it("searches across languages and jumps to the hit", () => {
    render(<Harness onOpen={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "musa" } });
    fireEvent.click(screen.getByRole("button", { name: /Moses/ }));
    expect(screen.getByRole("navigation").textContent).toContain("Moses");
  });
});
