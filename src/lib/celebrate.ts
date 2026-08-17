import confetti from 'canvas-confetti';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Hög kontrast mot appens mörkblå ytor. Den tidigare blå paletten syntes som
// några diskreta bakgrundsprickar på mobil trots att konfettin faktiskt kördes.
const BRAND_COLORS = ['#ffffff', '#67e8f9', '#34d399', '#fbbf24', '#f472b6'];

const STATIC_CONFETTI_POSITIONS = [
  [4, 17, -18], [11, 31, 12], [19, 12, 35], [27, 25, -9], [36, 15, 22],
  [46, 29, -28], [55, 11, 14], [64, 24, 31], [73, 14, -15], [82, 29, 18],
  [91, 16, -32], [97, 35, 9], [7, 49, 24], [17, 61, -14], [29, 45, 32],
  [41, 58, -25], [59, 46, 16], [71, 62, -11], [84, 48, 28], [94, 59, -20],
] as const;

type ConfettiFn = ReturnType<typeof confetti.create>;

let canvasEl: HTMLCanvasElement | null = null;
let cachedFire: ConfettiFn | null = null;

/**
 * Tillgänglig fallback när operativsystemet begär reducerad rörelse.
 * Ingen fallande animation används, men firandet blir fortfarande tydligt.
 */
function showStaticConfetti() {
  if (typeof document === 'undefined') return;

  document.querySelector('[data-parium-static-confetti]')?.remove();
  const layer = document.createElement('div');
  layer.setAttribute('data-parium-static-confetti', '');
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '2147483647',
  } as CSSStyleDeclaration);

  STATIC_CONFETTI_POSITIONS.forEach(([x, y, rotation], index) => {
    const piece = document.createElement('i');
    Object.assign(piece.style, {
      position: 'absolute',
      left: `${x}%`,
      top: `${y}%`,
      width: index % 3 === 0 ? '12px' : '8px',
      height: index % 3 === 0 ? '6px' : '11px',
      borderRadius: index % 4 === 0 ? '999px' : '2px',
      backgroundColor: BRAND_COLORS[index % BRAND_COLORS.length],
      transform: `rotate(${rotation}deg)`,
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.2)',
    } as CSSStyleDeclaration);
    layer.appendChild(piece);
  });

  (document.body || document.documentElement).appendChild(layer);
  window.setTimeout(() => layer.remove(), 1800);
}

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
      display: 'block',
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
    showStaticConfetti();
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
    // Retina-mobiler behöver något större bitar för att animationen ska läsas
    // som konfetti och inte som svaga, enstaka pixlar. Antalet är oförändrat.
    scalar: narrow ? 1.18 : 0.9,
    ticks: 220,
    gravity: narrow ? 0.78 : 0.85,
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
