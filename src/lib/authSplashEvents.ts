/**
 * Event-baserat system för att visa auth-splash vid navigering till /auth.
 * 
 * Skalet visas i minst 4 sekunder för att ge tid för loggan att laddas
 * och avkodas helt innan den tonas ut.
 */

type SplashListener = (visible: boolean) => void;

const listeners = new Set<SplashListener>();
let currentlyVisible = false;

export const authSplashEvents = {
  /**
   * Prenumerera på splash-synlighet
   */
  subscribe(listener: SplashListener): () => void {
    listeners.add(listener);
    // Ge direkt aktuell status
    listener(currentlyVisible);
    return () => listeners.delete(listener);
  },

  /**
   * Visa splash-skalet (anropas innan navigering till /auth)
   */
  show() {
    if (currentlyVisible) return;
    currentlyVisible = true;
    
    // Instantly show the static HTML splash (no React render needed)
    const splash = document.getElementById('auth-splash');
    if (splash) {
      splash.classList.remove('fade-out');
      splash.classList.add('fade-in');
    }
    
    listeners.forEach(l => l(true));
  },

  /**
   * Göm splash-skalet
   */
  hide() {
    if (!currentlyVisible) return;
    currentlyVisible = false;
    listeners.forEach(l => l(false));
  },

  /**
   * Kolla om splash visas just nu
   */
  isVisible(): boolean {
    return currentlyVisible;
  }
};

// Exponera globalt för enkel debugging
if (typeof window !== 'undefined') {
  (window as any).__authSplash = authSplashEvents;
}
