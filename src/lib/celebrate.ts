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
    scalar: 0.95,
    ticks: 180,
    zIndex: 100000,
  };

  // Huvudburst från mitten, något ovanför center
  confetti({
    ...base,
    particleCount: big ? 90 : 60,
    spread: 70,
    startVelocity: 42,
    origin: { x: 0.5, y: 0.42 },
  });

  // Två sidoburstar för djup
  window.setTimeout(() => {
    confetti({
      ...base,
      particleCount: big ? 45 : 30,
      angle: 60,
      spread: 60,
      startVelocity: 38,
      origin: { x: 0.08, y: 0.7 },
    });
    confetti({
      ...base,
      particleCount: big ? 45 : 30,
      angle: 120,
      spread: 60,
      startVelocity: 38,
      origin: { x: 0.92, y: 0.7 },
    });
  }, 140);
}

export default celebrate;
