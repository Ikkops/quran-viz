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
