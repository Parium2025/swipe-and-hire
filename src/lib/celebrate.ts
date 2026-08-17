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

  return canvasEl;
}

function getFire(): ConfettiFn | null {
  const canvas = ensureCanvas();
  if (!canvas) return null;
  if (!cachedFire) {
    // Rendera utanför huvudtråden där webbläsaren stödjer OffscreenCanvas.
    // Det gör att dashboardens omrendering och dialogstängning aldrig kan få
    // desktop-konfettin att hacka. Biblioteket faller automatiskt tillbaka på
    // vanlig canvas på äldre iOS-versioner.
    cachedFire = confetti.create(canvas, { resize: true, useWorker: true });
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

  const base: confetti.Options = {
    colors: BRAND_COLORS,
    disableForReducedMotion: false,
    scalar: 1,
    ticks: 190,
    gravity: 0.9,
    decay: 0.94,
  };

  const COUNT = 22;

  // Diskreta sidoburstar: en från vänster kant, en från höger kant.
  const sides = () => {
    fire({
      ...base,
      particleCount: COUNT,
      angle: 55,
      spread: 55,
      startVelocity: 46,
      origin: { x: 0, y: 0.78 },
    });
    fire({
      ...base,
      particleCount: COUNT,
      angle: 125,
      spread: 55,
      startVelocity: 46,
      origin: { x: 1, y: 0.78 },
    });
  };

  // Två tydligt separerade omgångar. Eftersom renderingen sker i en worker
  // behöver vi inte längre fördröja första skottet med dubbla animation frames
  // (det var den märkbara pausen på desktop). 520 ms gör andra omgången
  // visuellt distinkt i stället för att smälta ihop med den första.
  sides();
  window.setTimeout(sides, 520);
}

/**
 * Förvärm canvas + confetti-instans innan firandet. Anropas när ett
 * publiceringsflöde startar så att första skottet inte betalar init-kostnaden
 * (canvas-insättning + kontextallokering) mitt i dialogstängningen.
 */
export function prewarmCelebration() {
  if (typeof window === 'undefined') return;
  getFire();
}

if (typeof window !== 'undefined') {
  const warm = () => { try { getFire(); } catch { /* noop */ } };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (ric) ric(warm);
  else setTimeout(warm, 1200);
}





export default celebrate;
