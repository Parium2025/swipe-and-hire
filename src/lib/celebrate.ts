import confetti from 'canvas-confetti';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const BRAND_COLORS = ['#ffffff', '#7cc4ff', '#2f7fd4', '#bfe3ff', '#0f4c81'];

type ConfettiFn = ReturnType<typeof confetti.create>;

let cachedFire: ConfettiFn | null = null;

/**
 * Egen fullskärms-canvas som ligger överst i DOM:en (documentElement) med
 * maximal z-index. Detta gör konfettin synlig oavsett skärmstorlek, modaler,
 * portaler eller scroll-lås — tidigare kunde den hamna bakom overlays på mobil.
 */
function getFire(): ConfettiFn | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  if (cachedFire) return cachedFire;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('data-parium-confetti', '');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '2147483647',
  } as CSSStyleDeclaration);
  (document.body || document.documentElement).appendChild(canvas);

  cachedFire = confetti.create(canvas, { resize: true, useWorker: false });
  return cachedFire;
}

/**
 * Premium konfetti-burst — används när något verkligen firas (t.ex. publicerad annons).
 * Respekterar reducerad rörelse.
 */
export function celebrate(options?: { intensity?: 'normal' | 'big' }) {
  if (typeof window === 'undefined' || prefersReducedMotion()) return;

  const fire = getFire();
  if (!fire) return;

  const big = options?.intensity === 'big';
  const narrow = window.innerWidth < 768;

  const base: confetti.Options = {
    colors: BRAND_COLORS,
    disableForReducedMotion: true,
    scalar: narrow ? 0.9 : 0.8,
    ticks: 220,
    gravity: 0.85,
    decay: 0.93,
  };

  const count = (big ? 30 : 18) + (narrow ? 10 : 0);

  // Diskreta sidoburstar: en från vänster kant, en från höger kant.
  const sides = () => {
    fire({
      ...base,
      particleCount: count,
      angle: 55,
      spread: narrow ? 70 : 55,
      startVelocity: narrow ? 48 : 42,
      origin: { x: 0, y: 0.78 },
    });
    fire({
      ...base,
      particleCount: count,
      angle: 125,
      spread: narrow ? 70 : 55,
      startVelocity: narrow ? 48 : 42,
      origin: { x: 1, y: 0.78 },
    });
  };

  // Vänta ett frame så att canvasen hunnit få rätt storlek innan första burst.
  window.requestAnimationFrame(() => {
    sides();
    window.setTimeout(sides, 200);
    if (big) {
      window.setTimeout(sides, 430);
      window.setTimeout(sides, 700);
    }
  });
}

export default celebrate;
