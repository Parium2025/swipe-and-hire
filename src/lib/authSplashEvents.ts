/**
 * Event-based auth splash controller for instant branded loading on /auth.
 * 
 * The splash is shown via static HTML (index.html) for hard reloads,
 * and controlled via this event bus for in-app navigation.
 * 
 * Minimum display time: 4 seconds (ensures logo is fully decoded/painted)
 */

type SplashEventType = 'show' | 'hide' | 'ready';
type SplashListener = (event: SplashEventType) => void;

const listeners = new Set<SplashListener>();
let splashShownAt: number | null = null;
const MIN_DISPLAY_MS = 4000;

export const authSplashEvents = {
  subscribe(listener: SplashListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  emit(event: SplashEventType): void {
    if (event === 'show') {
      splashShownAt = Date.now();
    }
    listeners.forEach((fn) => fn(event));
  },

  /**
   * Shows the splash element in the DOM (for in-app navigation to /auth)
   */
  show(): void {
    const el = document.getElementById('auth-splash');
    if (el) {
      el.style.display = 'flex';
      el.style.opacity = '1';
      el.setAttribute('aria-hidden', 'false');
    }
    this.emit('show');
  },

  /**
   * Hides the splash with a fade-out, respecting minimum display time.
   * Returns a promise that resolves when the splash is fully hidden.
   */
  async hide(): Promise<void> {
    const el = document.getElementById('auth-splash');
    if (!el) return;

    // Enforce minimum display time for logo decode + paint
    if (splashShownAt) {
      const elapsed = Date.now() - splashShownAt;
      if (elapsed < MIN_DISPLAY_MS) {
        await new Promise((r) => setTimeout(r, MIN_DISPLAY_MS - elapsed));
      }
    }

    // Fade out
    el.style.transition = 'opacity 0.4s ease-out';
    el.style.opacity = '0';
    
    await new Promise((r) => setTimeout(r, 400));
    
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
    splashShownAt = null;
    
    this.emit('hide');
  },

  /**
   * Signals that the auth page is ready (logo decoded, content painted).
   * This triggers the hide sequence.
   */
  ready(): void {
    this.emit('ready');
    this.hide();
  },

  /**
   * Check if splash is currently visible
   */
  isVisible(): boolean {
    const el = document.getElementById('auth-splash');
    return el ? el.style.display !== 'none' : false;
  },
};

export default authSplashEvents;
