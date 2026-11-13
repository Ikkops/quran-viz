import { describe, expect, it } from "vitest";
import {
  MARK_COLORS,
  addCollection,
  addPin,
  deleteMark,
  editMark,
  initialMarks,
  markedAyahs,
  marksByAyah,
  movePin,
  sanitizeMarks,
  setItemNote,
  toggleInCollection,
} from "./marks";

const names = { pin: "Tilawah", collection: "Favourites" };

describe("marks", () => {
  it("starts with one pin and one collection, keeping old bookmarks", () => {
    const m = initialMarks(names, [{ id: 255, note: "kursi", at: 5 }, { id: 99999 }]);
    expect(m.pins).toHaveLength(1);
    expect(m.pins[0].ayah).toBeNull();
    expect(m.collections[0].items).toEqual([{ id: 255, note: "kursi", at: 5 }]);
  });

  it("moves a pin: one place at a time, and off when set again", () => {
    let m = movePin(initialMarks(names), "p1", 10, 1);
    expect(m.pins[0].ayah).toBe(10);
    m = movePin(m, "p1", 20, 2);
    expect(m.pins[0]).toMatchObject({ ayah: 20, at: 2 });
    expect(movePin(m, "p1", 20, 3).pins[0].ayah).toBeNull();
  });

  it("adds, renames, recolours and deletes", () => {
    let m = addPin(initialMarks(names), "  Hafalan ", MARK_COLORS[0], 7, 1);
    expect(m.pins[1]).toMatchObject({ id: "p2", name: "Hafalan", ayah: 7 });
    expect(addPin(m, "   ", MARK_COLORS[0])).toBe(m);
    m = addCollection(m, "Doa", MARK_COLORS[2], 201, 1);
    expect(m.collections[1].items).toEqual([{ id: 201, note: "", at: 1 }]);
    m = editMark(m, "c2", { name: "Doa-doa", color: MARK_COLORS[3] });
    expect(m.collections[1]).toMatchObject({ name: "Doa-doa", color: MARK_COLORS[3] });
    expect(editMark(m, "c2", { name: "" }).collections[1].name).toBe("Doa-doa");
    m = deleteMark(m, "p2");
    expect(m.pins).toHaveLength(1);
  });

  it("toggles an ayah in a collection and keeps its note", () => {
    let m = toggleInCollection(initialMarks(names), "c1", 5, 1);
    m = setItemNote(m, "c1", 5, "note");
    expect(m.collections[0].items[0]).toEqual({ id: 5, note: "note", at: 1 });
    expect(toggleInCollection(m, "c1", 5).collections[0].items).toEqual([]);
  });

  it("indexes marks by ayah", () => {
    let m = movePin(initialMarks(names), "p1", 5);
    m = toggleInCollection(m, "c1", 5);
    m = toggleInCollection(m, "c1", 9);
    expect(markedAyahs(m).sort((a, b) => a - b)).toEqual([5, 9]);
    const by = marksByAyah(m);
    expect(by.get(5)?.pins).toHaveLength(1);
    expect(by.get(9)?.collections[0].id).toBe("c1");
  });

  it("sanitizes stored marks", () => {
    expect(sanitizeMarks(null)).toBeUndefined();
    expect(sanitizeMarks({ pins: [] })).toBeUndefined();
    const m = sanitizeMarks({
      pins: [
        { id: "p1", name: "A", color: "red", ayah: 99999, at: "x" },
        { id: "p1", name: "dup", color: MARK_COLORS[0], ayah: 1 },
        { id: "p3", name: "", ayah: 1 },
      ],
      collections: [
        { id: "c1", name: "C", color: MARK_COLORS[5], items: [{ id: 3 }, 4] },
      ],
    })!;
    expect(m.pins).toEqual([
      { id: "p1", name: "A", color: MARK_COLORS[4], ayah: null, at: 0 },
    ]);
    expect(m.collections[0].items).toEqual([{ id: 3, note: "", at: 0 }]);
  });
});
