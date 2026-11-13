import type { ReaderTarget } from "../charts/common";
import { useI18n } from "../../i18n/I18nContext";

/** Rows shown before the table asks for the CSV instead (DOM size). */
const MAX_ROWS = 500;

const numeric = (v: unknown) =>
  typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v));
const hasArabic = (v: unknown) => typeof v === "string" && /[؀-ۿ]/.test(v);

/**
 * The rows behind a chart (the same rows as its CSV) as a table: the text
 * alternative to the chart, and a keyboard path into the reader. A row that
 * names a surah or an ayah opens it from its first cell.
 */
export function DataTable({
  rows,
  targetOf,
  onOpen,
}: {
  rows: Record<string, unknown>[];
  targetOf: (row: Record<string, unknown>) => ReaderTarget | null;
  onOpen: (t: ReaderTarget) => void;
}) {
  const { t, n } = useI18n();
  if (!rows.length)
    return <p className="py-8 text-sm text-ink-subtle">{t.answers.none}</p>;
  const keys = Object.keys(rows[0]);
  const shown = rows.slice(0, MAX_ROWS);
  const cell = (v: unknown) =>
    typeof v === "number" ? n(v) : v === null || v === undefined ? "" : String(v);
  return (
    <div className="h-full w-full overflow-auto rounded-lg border border-line">
      <table
        className="w-full border-collapse text-sm"
        aria-label={t.dashboard.tableAria}
      >
        <thead className="sticky top-0 bg-surface text-left shadow-[0_1px_0_rgb(var(--line))]">
          <tr>
            {keys.map((k) => (
              <th
                key={k}
                scope="col"
                className={`whitespace-nowrap px-3 py-2 font-medium text-ink-subtle ${numeric(rows[0][k]) ? "text-right" : ""}`}
              >
                {t.table.cols[k] ?? k.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => {
            const target = targetOf(row);
            return (
              <tr key={i} className="border-t border-line/70 hover:bg-surface-sunken/60">
                {keys.map((k, j) => {
                  const v = row[k];
                  const text = cell(v);
                  const ar = hasArabic(v);
                  return (
                    <td
                      key={k}
                      lang={ar ? "ar" : undefined}
                      dir={ar ? "rtl" : undefined}
                      className={`px-3 py-1.5 ${numeric(v) ? "text-right tabular-nums" : ""} ${ar ? "whitespace-nowrap font-arabic text-base" : ""} ${j === 0 ? "text-ink" : "text-ink-muted"}`}
                    >
                      {j === 0 && target ? (
                        <button
                          type="button"
                          onClick={() => onOpen(target)}
                          className="font-medium text-illumination hover:underline"
                        >
                          {text}
                        </button>
                      ) : (
                        text
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > MAX_ROWS && (
        <p className="border-t border-line px-3 py-2 text-sm text-ink-subtle">
          {t.dashboard.tableNote(n(MAX_ROWS), n(rows.length))}
        </p>
      )}
    </div>
  );
}
