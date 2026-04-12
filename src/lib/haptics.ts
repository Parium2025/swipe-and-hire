import { Capacitor } from '@capacitor/core';

let HapticsPlugin: any = null;

// Lazy-load the Haptics plugin only on native
async function getHaptics() {
  if (HapticsPlugin) return HapticsPlugin;
  if (Capacitor.isNativePlatform()) {
    try {
      const mod = await import('@capacitor/haptics');
      HapticsPlugin = mod.Haptics;
      return HapticsPlugin;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Light haptic tap — used for swipe threshold crossing, button presses
 */
export async function hapticLight() {
  const haptics = await getHaptics();
  if (haptics) {
    try {
      await haptics.impact({ style: 'light' });
      return;
    } catch {}
  }
  // Web fallback
  if (navigator.vibrate) {
    navigator.vibrate(8);
  }
}

/**
 * Medium haptic — used for successful swipe completion
 */
export async function hapticMedium() {
  const haptics = await getHaptics();
  if (haptics) {
    try {
      await haptics.impact({ style: 'medium' });
      return;
    } catch {}
  }
  if (navigator.vibrate) {
    navigator.vibrate(15);
  }
}

/**
 * Success haptic — used for undo, apply
 */
export async function hapticSuccess() {
  const haptics = await getHaptics();
  if (haptics) {
    try {
      await haptics.notification({ type: 'success' });
      return;
    } catch {}
  }
  if (navigator.vibrate) {
    navigator.vibrate([10, 30, 10]);
  }
}
