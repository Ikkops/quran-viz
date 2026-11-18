import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { versesFromColumns, type VerseColumns } from "./useQuranData";

const read = (f: string) =>
  JSON.parse(readFileSync(resolve(__dirname, "../../public/data", f), "utf8"));

it("verses-cols.json decodes to exactly verses.json", () => {
  const cols = read("verses-cols.json") as VerseColumns;
  expect(versesFromColumns(cols)).toEqual(read("verses.json"));
});
