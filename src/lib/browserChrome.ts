const LANDING_CHROME_COLOR = '#2a2a2a';
const PARIUM_CHROME_COLOR = '#00193D';
const AUDIENCE_LANDING_CHROME_COLOR = '#001F3D';
// Auth-sidans gradient är ljusare än app-blå — samplat från sidans nederkant.
const AUTH_CHROME_COLOR = '#062B5E';
const THEME_COLOR_MEDIA = ['', '(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'];
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

const nudgeColor = (color: string) => {
  // Minimal färgskillnad som tvingar Safari att läsa om theme-color.
  const hex = color.replace('#', '');
  if (hex.length !== 6) return color;
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const nudgedBlue = (blue === 255 ? blue - 1 : blue + 1).toString(16).padStart(2, '0');
  return `#${hex.slice(0, 4)}${nudgedBlue}`;
};

let pendingThemeFrame: number | null = null;

const writeThemeColor = (color: string) => {
  // iOS Safari läser ofta inte om browser-chrome när bara `content` ändras på
  // samma meta-nod efter en SPA-navigering. Skapa därför om den omedia-taggen
  // och båda färgschema-taggarna, vilket är den tidigare beprövade lösningen.
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
  if (pendingThemeFrame !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(pendingThemeFrame);
    pendingThemeFrame = null;
  }

  writeThemeColor(nudgeColor(color));
  if (typeof requestAnimationFrame === 'function') {
    pendingThemeFrame = requestAnimationFrame(() => {
      pendingThemeFrame = null;
      writeThemeColor(color);
    });
    return;
  }

  writeThemeColor(color);
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
let pendingSyncTimers: number[] = [];

export const syncBrowserChrome = (pathname = window.location.pathname) => {
  const isLandingVideo = isLandingVideoPath(pathname);
  const isAudienceLanding = isAudienceLandingPath(pathname);
  const isAuth = isAuthPath(pathname);
  const color = isLandingVideo
    ? LANDING_CHROME_COLOR
    : isAudienceLanding
      ? AUDIENCE_LANDING_CHROME_COLOR
      : isAuth
        ? AUTH_CHROME_COLOR
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

  // Safari kan ignorera den första dynamiska uppdateringen. Den fungerande
  // lösningen återapplicerar färgen medan nästa sida målas. Gamla timers
  // avbryts och varje callback verifierar aktuell rutt, så en tidigare sida
  // kan aldrig skriva tillbaka sin färg efter snabb navigering.
  pendingSyncTimers.forEach((id) => window.clearTimeout(id));
  pendingSyncTimers = [];
  [80, 260, 640, 1200, 2000].forEach((delay) => {
    pendingSyncTimers.push(
      window.setTimeout(() => {
        if (window.location.pathname !== pathname) return;
        setChromeCssColor(color);
        setThemeColor(color);
        notifyChromeStrips(pathname, color);
      }, delay)
    );
  });

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
