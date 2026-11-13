import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export type BackAction = "close-dialog" | "history-back" | "exit";

/**
 * What Android's back gesture does: close the open window first (reader,
 * search, settings…), then step back through the hash history, then leave.
 */
export function backAction(dialogOpen: boolean, canGoBack: boolean): BackAction {
  if (dialogOpen) return "close-dialog";
  return canGoBack ? "history-back" : "exit";
}

/**
 * Wire the hardware/gesture back button in the Capacitor app (no-op on the web).
 * A dialog is closed with a synthetic Escape, so each window keeps its own close
 * logic (the reader closes an open popover before itself).
 */
export function installBackButton(): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  const listener = CapacitorApp.addListener("backButton", ({ canGoBack }) => {
    const dialogOpen = !!document.querySelector('[role="dialog"]');
    switch (backAction(dialogOpen, canGoBack)) {
      case "close-dialog":
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        break;
      case "history-back":
        window.history.back();
        break;
      case "exit":
        void CapacitorApp.exitApp();
    }
  });
  return () => {
    void listener.then((l) => l.remove());
  };
}
