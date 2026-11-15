import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

/** A light tap when a drag crosses the point where letting go commits it.
 *  Android app only; follows the system's touch-feedback setting. */
export function tick(): void {
  if (!Capacitor.isNativePlatform()) return;
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
}
