import confetti from 'canvas-confetti';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const BRAND_COLORS = ['#ffffff', '#7cc4ff', '#2f7fd4', '#bfe3ff', '#0f4c81'];

type ConfettiFn = ReturnType<typeof confetti.create>;

let canvasEl: HTMLCanvasElement | null = null;
let cachedFire: ConfettiFn | null = null;

/**
 * Egen fullskärms-canvas som ligger överst i DOM:en med maximal z-index.
 *
 * Viktigt för mobil (iOS Safari):
 *  - canvasen måste ligga direkt under <body> och ALLTID vara kvar i DOM:en
 *    (SPA-navigering/portaler kunde tidigare koppla bort den),
 *  - storleken sätts explicit i device-pixlar varje gång vi firar, eftersom
 *    iOS ändrar viewporten när adressfältet fälls in/ut. Utan detta kunde
 *    canvasen ha 0 px höjd och konfettin ritades utanför skärmen.
 */
function ensureCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;

  if (!canvasEl) {
    canvasEl = document.createElement('canvas');
    canvasEl.setAttribute('data-parium-confetti', '');
    Object.assign(canvasEl.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100dvh',
      pointerEvents: 'none',
      zIndex: '2147483647',
    } as CSSStyleDeclaration);
    cachedFire = null;
  }

  if (!canvasEl.isConnected) {
    (document.body || document.documentElement).appendChild(canvasEl);
    cachedFire = null;
  }

  // Sätt pixelstorlek explicit (canvas-confettis egen resize hinner inte alltid
  // före första bursten på mobil).
  const w = Math.round(window.visualViewport?.width ?? window.innerWidth);
  const h = Math.round(window.visualViewport?.height ?? window.innerHeight);
  if (w > 0 && h > 0 && (canvasEl.width !== w || canvasEl.height !== h)) {
    canvasEl.width = w;
    canvasEl.height = h;
  }

  return canvasEl;
}

function getFire(): ConfettiFn | null {
  const canvas = ensureCanvas();
  if (!canvas) return null;
  if (!cachedFire) {
    cachedFire = confetti.create(canvas, { resize: true, useWorker: false });
  }
  return cachedFire;
}

/**
 * Premium konfetti-burst — används när något verkligen firas (t.ex. publicerad annons).
 * Respekterar reducerad rörelse.
 */
export function celebrate(options?: { intensity?: 'normal' | 'big' }) {
  if (typeof window === 'undefined') return;
  if (prefersReducedMotion()) {
    // Hjälper felsökning: på iOS slår "Reducera rörelse" av all konfetti.
    console.info('[celebrate] hoppar över konfetti: prefers-reduced-motion är på');
    return;
  }

  const fire = getFire();
  if (!fire) return;

  const big = options?.intensity === 'big';
  const narrow = window.innerWidth < 768;

  const base: confetti.Options = {
    colors: BRAND_COLORS,
    // Vi har redan gjort kontrollen ovan; låt inte biblioteket tysta bursten
    // en gång till (dubbelkontroll gav inkonsekvent beteende på mobil).
    disableForReducedMotion: false,
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

  // Kör första bursten direkt (inte i rAF) — på mobil kan rAF vara pausad
  // precis efter att en dialog stängts eller under smooth-scroll, vilket
  // gjorde att konfettin aldrig startade.
  sides();
  window.setTimeout(sides, 200);
  if (big) {
    window.setTimeout(sides, 430);
    window.setTimeout(sides, 700);
  }
}

export default celebrate;
