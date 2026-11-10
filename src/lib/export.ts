/** Renders a DOM element to a PNG and triggers a download. */
export async function exportElementToPng(
  el: HTMLElement,
  filename: string,
  dark: boolean,
): Promise<void> {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(el, {
    backgroundColor: dark ? "#0f172a" : "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const link = document.createElement("a");
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/** RFC 4180 CSV: header from the first row's keys, fields quoted when needed. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => cell(r[k])).join(","))].join(
    "\r\n",
  );
}

/** Download rows as a UTF-8 CSV (with BOM, so Excel shows Arabic correctly). */
export function downloadCsv(rows: Record<string, unknown>[], filename: string): void {
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
