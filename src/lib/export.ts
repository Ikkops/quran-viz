import { Capacitor } from "@capacitor/core";
import { tokens } from "../theme/tokens";

/** Renders a DOM element to a PNG and triggers a download (share sheet in the app). */
export async function exportElementToPng(
  el: HTMLElement,
  filename: string,
  dark: boolean,
): Promise<void> {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(el, {
    backgroundColor: tokens(dark).surface,
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const name = filename.endsWith(".png") ? filename : `${filename}.png`;
  const dataUrl = canvas.toDataURL("image/png");
  if (Capacitor.isNativePlatform()) {
    await shareNative(name, dataUrl.slice(dataUrl.indexOf(",") + 1));
    return;
  }
  const link = document.createElement("a");
  link.download = name;
  link.href = dataUrl;
  link.click();
}

/** In the Android app an <a download> click does nothing, so the file is
 *  written to the app cache and handed to the system share sheet, where it
 *  can be saved to Files, Drive, etc. `base64` is the file's bytes. */
async function shareNative(name: string, base64: string): Promise<void> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const { uri } = await Filesystem.writeFile({
    path: name,
    data: base64,
    directory: Directory.Cache,
  });
  try {
    await Share.share({ title: name, files: [uri] });
  } catch (e) {
    // Closing the share sheet without picking a target rejects; that's not an error.
    if (!/cancel/i.test(String(e))) throw e;
  }
}

/** UTF-8 → base64 without the deprecated unescape() trick. */
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
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
export async function downloadCsv(
  rows: Record<string, unknown>[],
  filename: string,
): Promise<void> {
  const name = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  const text = "﻿" + toCsv(rows);
  if (Capacitor.isNativePlatform()) {
    await shareNative(name, utf8ToBase64(text));
    return;
  }
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = name;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
