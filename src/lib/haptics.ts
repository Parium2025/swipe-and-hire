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
