import type { EditionsIndex } from "../../types/quran";
import { groupTranslations } from "../../data/editions";
import { Select } from "../ui";

/** Single-edition select, grouped by language. */
export function EditionSelect({
  index,
  value,
  onChange,
  label,
}: {
  index: EditionsIndex;
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const groups = groupTranslations(index);
  return (
    <Select label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {groups.map((g) => (
        <optgroup key={g.language} label={g.label}>
          {g.editions.map((e) => (
            <option key={e.identifier} value={e.identifier}>
              {e.englishName}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
