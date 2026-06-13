/**
 * Tiny module-level event bus för Premium-relaterade gränsdialoger.
 * Hooks/funktioner emittar event; en global lyssnare (PremiumLimitListener)
 * renderar rätt dialog. Undviker att varje call-site behöver lägga till dialog-JSX.
 */

type SavedJobsLimitPayload = { limit: number };

type Listener = (payload: SavedJobsLimitPayload) => void;

const savedJobsListeners = new Set<Listener>();

export function emitSavedJobsLimit(payload: SavedJobsLimitPayload) {
  savedJobsListeners.forEach((l) => {
    try { l(payload); } catch { /* ignore */ }
  });
}

export function onSavedJobsLimit(listener: Listener): () => void {
  savedJobsListeners.add(listener);
  return () => { savedJobsListeners.delete(listener); };
}
