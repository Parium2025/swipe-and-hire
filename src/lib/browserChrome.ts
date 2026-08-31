const LANDING_CHROME_COLOR = '#2a2a2a';
const PARIUM_CHROME_COLOR = '#001935';
const AUDIENCE_LANDING_CHROME_COLOR = '#001F3D';
const THEME_COLOR_MEDIA = ['', '(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'];
export const BROWSER_CHROME_COLOR_EVENT = 'parium:browser-chrome-color';

const isLandingVideoPath = (pathname: string) => pathname === '/' || pathname === '';
const isAudienceLandingPath = (pathname: string) =>
  pathname === '/arbetsgivare' || pathname === '/jobbsokare';

const removeLegacySentinels = () => {
  ['parium-browser-chrome-top', 'parium-browser-chrome-bottom', 'parium-bottom-chrome'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
};

const nudgeColor = (color: string) => {
  // Minimal färgskillnad (osynlig för ögat) som tvingar Safari att se
  // theme-color som "ändrad" och därmed re-sampla URL-/verktygsbaren.
  const hex = color.replace('#', '');
  if (hex.length !== 6) return color;
  const b = parseInt(hex.slice(4, 6), 16);
  const nb = (b === 255 ? b - 1 : b + 1).toString(16).padStart(2, '0');
  return `#${hex.slice(0, 4)}${nb}`;
};

const writeThemeColor = (color: string) => {
  // Ta bort ALLA befintliga theme-color-meta-tags. Safari cache:ar värdet
  // aggressivt och uppdaterar inte URL-baren när man bara ändrar `content`
  // (särskilt vid back-navigation via bfcache). Att fysiskt remova + återskapa
  // noden tvingar Safari att re-sampla färgen.
  Array.from(document.querySelectorAll('meta[name="theme-color"]')).forEach((el) => el.remove());

  THEME_COLOR_MEDIA.forEach((media) => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    if (media) meta.setAttribute('media', media);
    meta.setAttribute('content', color);
    document.head.insertBefore(meta, document.head.firstChild);
  });
};

const setThemeColor = (color: string) => {
  // Skriv först en nästan identisk färg, sedan målfärgen på nästa frame.
  // iOS Safari ignorerar annars ibland en uppdatering vid back-navigation
  // eftersom värdet uppfattas som oförändrat sedan förra samplingen.
  writeThemeColor(nudgeColor(color));
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => writeThemeColor(color));
  } else {
    writeThemeColor(color);
  }
};


const notifyChromeStrips = (pathname: string, color: string) => {
  window.dispatchEvent(
    new CustomEvent(BROWSER_CHROME_COLOR_EVENT, {
      detail: { pathname, color },
    })
  );
};

const setChromeCssColor = (color: string) => {
  document.documentElement.style.setProperty('--active-browser-chrome-color', color);
  document.documentElement.style.setProperty('--browser-chrome-color', color);
};

/**
 * Synkar browser-chrome (URL-bar topp + body-bakgrund).
 *
 * iOS Safaris bottenverktygsfält samplar body's bakgrundsfärg vid first paint
 * och uppdaterar inte vid SPA-nav. Vi accepterar den begränsningen — topp-baren
 * och body-färgen byts dock korrekt. Hard reloads tas bort eftersom de orsakade
 * vit/trasig sida i kombination med cache-killswitchen i index.html.
 */
export const syncBrowserChrome = (pathname = window.location.pathname) => {
  const isLandingVideo = isLandingVideoPath(pathname);
  const isAudienceLanding = isAudienceLandingPath(pathname);
  const color = isLandingVideo
    ? LANDING_CHROME_COLOR
    : isAudienceLanding
      ? AUDIENCE_LANDING_CHROME_COLOR
      : PARIUM_CHROME_COLOR;

  removeLegacySentinels();

  document.documentElement.classList.toggle('landing-video-chrome', isLandingVideo);
  document.body.classList.toggle('landing-video-chrome', isLandingVideo);
  document.documentElement.classList.toggle('parium-app-chrome', !isLandingVideo);
  document.body.classList.toggle('parium-app-chrome', !isLandingVideo);

  document.documentElement.style.setProperty('background-color', color, 'important');
  document.body.style.setProperty('background-color', color, 'important');
  setChromeCssColor(color);

  // Top-/bottomremsorna läser CSS-variabeln direkt. Det gör att toppremsan
  // byter färg samtidigt som route-syncen, utan att vara beroende av att
  // Safari uppdaterar sin native theme-color direkt.

  setThemeColor(color);
  notifyChromeStrips(pathname, color);

  // iOS Safari kan ignorera första dynamiska theme-color-uppdateringen under
  // SPA-nav. Re-applicera efter att målsidan har landat visuellt.
  // Gamla timers avbryts först — annars kan en tidigare rutts färg skrivas
  // tillbaka efter en snabb back-navigation (blå färg kvar på landningssidan).
  pendingSyncTimers.forEach((id) => window.clearTimeout(id));
  pendingSyncTimers = [];
  [80, 260, 640, 1200].forEach((delay) => {
    pendingSyncTimers.push(
      window.setTimeout(() => {
        setChromeCssColor(color);
        setThemeColor(color);
        notifyChromeStrips(pathname, color);
      }, delay)
    );
  });

};

// Mountar en pageshow/popstate-listener som re-syncar chrome när Safari
// restorar sidan från bfcache (back/forward). Annars sitter den gamla
// theme-color-färgen kvar i URL-baren även efter SPA-back.
let pageshowMounted = false;
export const mountChromePopstateGuard = () => {
  if (pageshowMounted || typeof window === 'undefined') return;
  pageshowMounted = true;
  const resync = () => syncBrowserChrome(window.location.pathname);
  window.addEventListener('pageshow', resync);
  window.addEventListener('popstate', resync);
  // Tillbaka från en extern sida/app-växling: Safari kan ha kvar den gamla
  // sampladefärgen. Re-synka så snart sidan blir synlig igen.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resync();
  });
  window.addEventListener('focus', resync);
};


export const noteChromePath = (_pathname: string) => {
  /* noop */
};
