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
  ariaLabel,
  exclude,
  className,
}: {
  index: EditionsIndex;
  value: string;
  onChange: (id: string) => void;
  label?: string;
  ariaLabel?: string;
  /** Editions already shown elsewhere, left out of the list. */
  exclude?: string[];
  className?: string;
}) {
  const { t, lang } = useI18n();
  const groups = groupTranslations(index, t.locale, lang);
  return (
    <Select
      label={label}
      ariaLabel={label ? undefined : (ariaLabel ?? t.reader.translation)}
      className={className}
      value={value}
      onChange={onChange}
      searchable
      options={groups.flatMap((g) =>
        g.editions
          .filter((e) => e.identifier === value || !exclude?.includes(e.identifier))
          .map((e) => ({
            value: e.identifier,
            label: e.englishName,
            group: g.label,
          })),
      )}
    />
  );
}
