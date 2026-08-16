import confetti from 'canvas-confetti';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const BRAND_COLORS = ['#ffffff', '#7cc4ff', '#2f7fd4', '#bfe3ff', '#0f4c81'];

/**
 * Premium konfetti-burst — används när något verkligen firas (t.ex. publicerad annons).
 * Respekterar reducerad rörelse och rensar upp sig själv.
 */
export function celebrate(options?: { intensity?: 'normal' | 'big' }) {
  if (typeof window === 'undefined' || prefersReducedMotion()) return;

  const big = options?.intensity === 'big';
  const base: confetti.Options = {
    colors: BRAND_COLORS,
    disableForReducedMotion: true,
    scalar: 0.8,
    ticks: 140,
    gravity: 0.9,
    decay: 0.92,
    zIndex: 100000,
  };

  const count = big ? 26 : 16;

  // Diskreta sidoburstar: en från vänster kant, en från höger kant.
  const sides = () => {
    confetti({
      ...base,
      particleCount: count,
      angle: 55,
      spread: 55,
      startVelocity: 42,
      origin: { x: 0, y: 0.72 },
    });
    confetti({
      ...base,
      particleCount: count,
      angle: 125,
      spread: 55,
      startVelocity: 42,
      origin: { x: 1, y: 0.72 },
    });
  };

  sides();
  window.setTimeout(sides, 180);
}

export default celebrate;
