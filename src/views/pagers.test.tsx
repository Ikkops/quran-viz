import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuranData, Surah, Verse } from "../types/quran";
import { emptyHifdh } from "../lib/hifdh";
import { ThemeProvider } from "../theme/ThemeContext";
import { DashboardView } from "./DashboardView";
import { StructureView } from "./StructureView";
import { ActivityView } from "./ActivityView";

// recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// The charts and panels themselves are tested elsewhere: stubs keep these
// tests on the pager wiring.
const { stub } = vi.hoisted(() => ({
  stub: (name: string) => () => <p>{name} body</p>,
}));
vi.mock("../components/charts/SurahBarChart", () => ({ SurahBarChart: stub("length") }));
vi.mock("../components/charts/CorrelationScatter", () => ({
  CorrelationScatter: stub("correlation"),
}));
vi.mock("../components/peta/PetaMushaf", () => ({ PetaMushaf: stub("map") }));
vi.mock("../components/charts/StructureOverview", () => ({
  StructureOverview: stub("overview"),
}));
vi.mock("../components/charts/DivisionBreakdown", () => ({
  DivisionBreakdown: stub("division"),
}));
vi.mock("../components/home/ActivityPanel", () => ({ ActivityPanel: stub("stats") }));
vi.mock("../components/marks/MarksPanel", () => ({ MarksPanel: stub("marks") }));
vi.mock("../components/hifdh/HifdhPanel", () => ({ HifdhPanel: stub("hifdh") }));

const surah = (id: number, ayahCount: number) =>
  ({
    id,
    number: id,
    nameEn: `S${id}`,
    nameId: `S${id}`,
    name: `S${id}`,
    nameAr: "",
    meaning: "",
    type: "Meccan",
    ayahCount,
    wordCount: ayahCount * 3,
    letterCount: ayahCount * 12,
    revelationOrder: id,
    hasBismillah: true,
  }) as unknown as Surah;
const verse = (id: number, s: number): Verse => ({
  id,
  s,
  a: id,
  juz: 1,
  hizb: 1,
  rub: 1,
  ruku: 1,
  manzil: 1,
  page: 1,
  sajda: 0,
  w: 3,
  l: 12,
  ar: "",
});
const data = {
  surahs: [surah(1, 2), surah(2, 1)],
  verses: [verse(1, 1), verse(2, 1), verse(3, 2)],
  meta: {},
  editions: { default: "en.sahih" },
} as unknown as QuranData;

let now = 0;
beforeEach(() => {
  localStorage.clear();
  // Moves 50 ms apart: slow enough that only distance decides.
  vi.spyOn(Event.prototype, "timeStamp", "get").mockImplementation(() => (now += 50));
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(300);
});
afterEach(() => vi.restoreAllMocks());

/** A sideways drag of `dx` px (negative = left = next) on the test id or element. */
const swipe = (target: string | HTMLElement, dx: number) => {
  const el = typeof target === "string" ? screen.getByTestId(target) : target;
  fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 100 }] });
  for (const f of [0.25, 0.5, 1])
    fireEvent.touchMove(el, { touches: [{ clientX: 200 + dx * f, clientY: 100 }] });
  fireEvent.touchEnd(el, { touches: [] });
};
const stored = (key: string) => JSON.parse(localStorage.getItem(key) ?? "null");

describe("Structure swipe", () => {
  const structure = () =>
    render(
      <ThemeProvider>
        <StructureView data={data} onOpen={() => {}} />
      </ThemeProvider>,
    );
  it("moves overview → manzil on a long left swipe", () => {
    structure();
    swipe("structure-pager", -150);
    expect(stored("qv.structure.tab")).toBe("manzil");
    expect(screen.getByText("division body")).toBeInTheDocument();
    expect(screen.queryByText("overview body")).toBeNull();
  });
  it("does nothing on a right swipe from the first tab", () => {
    structure();
    swipe("structure-pager", 250);
    expect(stored("qv.structure.tab")).toBe("overview");
    expect(screen.getByText("overview body")).toBeInTheDocument();
  });
});

describe("Activity swipe", () => {
  it("moves stats → marks", () => {
    render(
      <ActivityView
        data={data}
        marks={{ pins: [], collections: [] }}
        onMarks={() => {}}
        hifdh={emptyHifdh()}
        onHifdh={() => {}}
        onOpen={() => {}}
      />,
    );
    swipe("activity-pager", -150);
    expect(stored("qv.activity.tab")).toBe("marks");
    expect(screen.getByText("marks body")).toBeInTheDocument();
    expect(screen.queryByText("stats body")).toBeNull();
  });
});

describe("Dashboard swipe", () => {
  it("steps to the next view, wrapping from the map to the first", async () => {
    localStorage.setItem("qv.viz", JSON.stringify("map"));
    render(
      <ThemeProvider>
        <DashboardView
          data={data}
          settings={{ bucketSize: 1, extremesCount: 5 } as never}
          colorMode="type"
          onColorMode={() => {}}
          onOpen={() => {}}
          marked={[2]}
          hifdh={emptyHifdh()}
          onExplore={() => {}}
        />
      </ThemeProvider>,
    );
    expect(await screen.findByText("map body")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mushaf map" })).toBeInTheDocument();
    expect(screen.getByText(/2 surahs, 3 ayahs; 1 with your pins/)).toBeInTheDocument();
    // The map has no rows to show or export.
    expect(screen.queryByRole("button", { name: /CSV/ })).toBeNull();

    swipe("dashboard-pager", -150);
    expect(stored("qv.viz")).toBe("length");
    expect(screen.getByRole("heading", { name: "Surah length" })).toBeInTheDocument();

    swipe("dashboard-pager", -150);
    expect(stored("qv.viz")).toBe("correlation");
    expect(screen.getByText("correlation body")).toBeInTheDocument();
  });

  const dashboard = async (viz: string) => {
    localStorage.setItem("qv.viz", JSON.stringify(viz));
    render(
      <ThemeProvider>
        <DashboardView
          data={data}
          settings={{ bucketSize: 1, extremesCount: 5 } as never}
          colorMode="type"
          onColorMode={() => {}}
          onOpen={() => {}}
          marked={[]}
          hifdh={emptyHifdh()}
          onExplore={() => {}}
        />
      </ThemeProvider>,
    );
    return screen.findByText(`${viz} body`);
  };

  it("does not change view on a drag that starts inside the chart", async () => {
    const body = await dashboard("length");
    const box = body.closest("[data-no-swipe]") as HTMLElement;
    expect(box).not.toBeNull();
    // A fixed-height chart also keeps the page from panning under the finger.
    expect(box).toHaveAttribute("data-touch-lock");
    swipe(body, -150);
    expect(stored("qv.viz")).toBe("length");
    expect(screen.getByRole("heading", { name: "Surah length" })).toBeInTheDocument();
  });

  it("still changes view on a drag that starts on the heading", async () => {
    await dashboard("length");
    swipe(screen.getByRole("heading", { name: "Surah length" }), -150);
    expect(stored("qv.viz")).toBe("correlation");
  });

  it("keeps a tall view pannable: no touch lock on the map", async () => {
    const body = await dashboard("map");
    const box = body.closest("[data-no-swipe]") as HTMLElement;
    expect(box).not.toHaveAttribute("data-touch-lock");
  });
});
