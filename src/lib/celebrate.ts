import confetti from 'canvas-confetti';

// Identisk palett överallt (mobil + desktop): vitt + Pariums blå toner.
const BRAND_COLORS = ['#ffffff', '#67e8f9', '#38bdf8', '#0ea5e9'];


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
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round((window.visualViewport?.width ?? window.innerWidth) * dpr);
  const h = Math.round((window.visualViewport?.height ?? window.innerHeight) * dpr);
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
    // ensureCanvas() äger storleken. Bibliotekets resize läser annars
    // getBoundingClientRect() igen precis när iOS stänger dialogen och kan
    // skriva över canvasen med en tillfällig 0-höjd från visualViewport.
    cachedFire = confetti.create(canvas, { resize: false, useWorker: false });
  }
  return cachedFire;
}

/**
 * Premium konfetti — EXAKT identiskt på alla plattformar (iOS, Android,
 * Windows, macOS) och alla skärmstorlekar: två omgångar, varje omgång ett
 * skjut från vänster kant och ett från höger kant. Totalt 4 burstar.
 *
 * `intensity` accepteras för bakåtkompatibilitet men påverkar inget — vi vill
 * aldrig ha olika beteende mellan mobil och desktop.
 */
let lastCelebrateAt = 0;

export function celebrate(_options?: { intensity?: 'normal' | 'big' }) {
  if (typeof window === 'undefined') return;

  // Skydd mot dubbelanrop (t.ex. om två flöden triggar samma publicering) —
  // annars ser användaren 8 burstar istället för 4.
  const now = Date.now();
  if (now - lastCelebrateAt < 1200) return;
  lastCelebrateAt = now;

  const fire = getFire();
  if (!fire) return;

  // Exakt samma känsla på mobil som på desktop — endast partikelstorleken
  // kompenseras för att canvasen ritas i device-pixlar på retinaskärmar.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const base: confetti.Options = {
    colors: BRAND_COLORS,
    disableForReducedMotion: false,
    scalar: 0.9 * dpr,
    ticks: 220,
    gravity: 0.85,
    decay: 0.93,
  };

  const COUNT = 24;

  // Diskreta sidoburstar: en från vänster kant, en från höger kant.
  const sides = () => {
    fire({
      ...base,
      particleCount: COUNT,
      angle: 55,
      spread: 55,
      startVelocity: 42 * dpr,
      origin: { x: 0, y: 0.78 },
    });
    fire({
      ...base,
      particleCount: COUNT,
      angle: 125,
      spread: 55,
      startVelocity: 42 * dpr,
      origin: { x: 1, y: 0.78 },
    });
  };

  // Två omgångar — samma överallt.
  // Kör direkt (inte i rAF): på mobil kan rAF vara pausad precis efter att en
  // dialog stängts eller under smooth-scroll.
  sides();
  window.setTimeout(sides, 260);
}


export default celebrate;
