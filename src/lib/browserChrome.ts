const LANDING_CHROME_COLOR = '#2a2a2a';
const PARIUM_CHROME_COLOR = '#00193D';
const AUDIENCE_LANDING_CHROME_COLOR = '#001F3D';
// Auth-sidans gradient är ljusare än app-blå — samplat från sidans nederkant.
const AUTH_CHROME_COLOR = '#062B5E';
const THEME_COLOR_ID = 'parium-theme-color';
export const BROWSER_CHROME_COLOR_EVENT = 'parium:browser-chrome-color';

const isLandingVideoPath = (pathname: string) => pathname === '/' || pathname === '';
const isAudienceLandingPath = (pathname: string) =>
  pathname === '/arbetsgivare' || pathname === '/jobbsokare';
const isAuthPath = (pathname: string) => pathname === '/auth';

const removeLegacySentinels = () => {
  ['parium-browser-chrome-top', 'parium-browser-chrome-bottom', 'parium-bottom-chrome'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
};

const writeThemeColor = (color: string) => {
  // En enda stabil nod är viktig i Safari. Flera light/dark-varianter och
  // borttagning/återskapande gjorde att WebKit ibland fortsatte använda den
  // första (grå) noden efter SPA-navigation.
  const tags = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  let meta = document.getElementById(THEME_COLOR_ID) as HTMLMetaElement | null;
  if (!meta) {
    meta = tags[0] ?? document.createElement('meta');
    meta.id = THEME_COLOR_ID;
    meta.name = 'theme-color';
    meta.removeAttribute('media');
    if (!meta.isConnected) document.head.appendChild(meta);
  }
  tags.forEach((tag) => {
    if (tag !== meta) tag.remove();
  });
  meta.content = color;
};

const getChromeColor = (pathname: string) => {
  if (isLandingVideoPath(pathname)) return LANDING_CHROME_COLOR;
  if (isAudienceLandingPath(pathname)) return AUDIENCE_LANDING_CHROME_COLOR;
  if (isAuthPath(pathname)) return AUTH_CHROME_COLOR;
  return PARIUM_CHROME_COLOR;
};

/**
 * Förbered Safaris systemfält medan navigationen fortfarande sker i samma
 * användargest. iOS kan ignorera en theme-color som skrivs först efter att
 * React Router redan har bytt vy.
 */
export const primeBrowserChrome = (pathname: string) => {
  const color = getChromeColor(pathname);
  writeThemeColor(color);
  setChromeCssColor(color);
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
  const color = getChromeColor(pathname);

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

  writeThemeColor(color);
  notifyChromeStrips(pathname, color);
};

// Mountar lyssnare som re-syncar chrome när Safari restorar sidan från
// bfcache (back/forward), när fliken blir synlig igen, eller vid rotation
// (Safari kan sampla om chrome-färgen vid layoutändringar). Resyncen
// koalesceras via rAF så att en burst av events bara triggar en synk.
let pageshowMounted = false;
let resyncScheduled = false;
export const mountChromePopstateGuard = () => {
  if (pageshowMounted || typeof window === 'undefined') return;
  pageshowMounted = true;
  const resync = () => {
    if (resyncScheduled) return;
    resyncScheduled = true;
    requestAnimationFrame(() => {
      resyncScheduled = false;
      syncBrowserChrome(window.location.pathname);
    });
  };
  // Endast bfcache-restore — första laddningen hanteras redan av App.tsx.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) resync();
  });
  window.addEventListener('popstate', resync);
  // Tillbaka från en extern sida/app-växling: Safari kan ha kvar den gamla
  // sampladefärgen. Re-synka så snart sidan blir synlig igen.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resync();
  });
  window.addEventListener('focus', resync);
  // Rotation/layoutändring: iOS Safari kan re-sampla verktygsbarens färg
  // när viewporten byter proportioner.
  window.addEventListener('orientationchange', resync);
};
