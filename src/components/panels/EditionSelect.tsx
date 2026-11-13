import type { EditionsIndex } from "../../types/quran";
import { groupTranslations } from "../../data/editions";
import { Select } from "../ui";
import { useI18n } from "../../i18n/I18nContext";

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
  const { t, lang } = useI18n();
  const groups = groupTranslations(index, t.locale, lang);
  return (
    <Select
      label={label}
      ariaLabel={label ? undefined : t.reader.translation}
      value={value}
      onChange={onChange}
      searchable
      options={groups.flatMap((g) =>
        g.editions.map((e) => ({
          value: e.identifier,
          label: e.englishName,
          group: g.label,
        })),
      )}
    />
  );
}
