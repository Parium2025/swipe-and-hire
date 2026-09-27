/**
 * Haptisk feedback är avaktiverad i hela appen.
 * Funktionerna finns kvar som no-ops för att inte bryta importer,
 * men de utlöser inga vibrationer varken på webb eller native.
 */
export async function hapticLight() {
  // Ingen haptik
}

export async function hapticMedium() {
  // Ingen haptik
}

export async function hapticSuccess() {
  // Ingen haptik
}

/**
 * Enda aktiva haptiken i appen: ett lätt "tick" (10 ms) när ett
 * horisontellt svep byter kort/flik/steg. Apple-känsla utan att
 * återaktivera haptik generellt. No-op där vibration inte stöds
 * (iOS Safari, desktop) — navigator.vibrate ignoreras då tyst.
 */
export function hapticSwipeTick() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
    }
  } catch {
    // Ignorera — haptik får aldrig störa navigeringen
  }
}
