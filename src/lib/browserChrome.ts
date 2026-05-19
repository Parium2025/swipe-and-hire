const LANDING_CHROME_COLOR = '#2a2a2a';
const PARIUM_CHROME_COLOR = '#001935';
const AUDIENCE_LANDING_CHROME_COLOR = '#001F3D';
const THEME_COLOR_MEDIA = ['', '(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'];
let themeColorVersion = 0;

const isLandingVideoPath = (pathname: string) => pathname === '/' || pathname === '';
const isAudienceLandingPath = (pathname: string) =>
  pathname === '/arbetsgivare' || pathname === '/jobbsokare';

const removeLegacySentinels = () => {
  ['parium-browser-chrome-top', 'parium-browser-chrome-bottom', 'parium-bottom-chrome'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
};

export const getBrowserChromeColor = (pathname = window.location.pathname) => {
  const isLandingVideo = isLandingVideoPath(pathname);
  const isAudienceLanding = isAudienceLandingPath(pathname);
  return isLandingVideo
    ? LANDING_CHROME_COLOR
    : isAudienceLanding
      ? AUDIENCE_LANDING_CHROME_COLOR
      : PARIUM_CHROME_COLOR;
};

const applyThemeColor = (color: string) => {
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
  themeColorVersion += 1;
  const version = themeColorVersion;
  applyThemeColor(color);

  // iOS Safari kan ignorera första dynamiska meta-bytet vid SPA-navigation från
  // videolandningen. Re-appliera samma färg kort efter paint, men avbryt om en
  // ny route redan hunnit sätta en annan färg.
  requestAnimationFrame(() => {
    if (version === themeColorVersion) applyThemeColor(color);
  });
  window.setTimeout(() => {
    if (version === themeColorVersion) applyThemeColor(color);
  }, 140);
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
  const color = getBrowserChromeColor(pathname);

  removeLegacySentinels();

  document.documentElement.classList.toggle('landing-video-chrome', isLandingVideo);
  document.body.classList.toggle('landing-video-chrome', isLandingVideo);
  document.documentElement.classList.toggle('parium-app-chrome', !isLandingVideo);
  document.body.classList.toggle('parium-app-chrome', !isLandingVideo);

  document.documentElement.style.setProperty('background-color', color, 'important');
  document.body.style.setProperty('background-color', color, 'important');
  document.documentElement.style.setProperty('--browser-chrome-color', color);
  document.body.style.setProperty('--browser-chrome-color', color);

  setThemeColor(color);
};

// Mountar en pageshow/popstate-listener som re-syncar chrome när Safari
// restorar sidan från bfcache (back/forward). Annars sitter den gamla
// theme-color-färgen kvar i URL-baren även efter SPA-back.
let pageshowMounted = false;
export const mountChromePopstateGuard = () => {
  if (pageshowMounted || typeof window === 'undefined') return;
  pageshowMounted = true;
  const resync = () => syncBrowserChrome(window.location.pathname);
  const resyncVisible = () => {
    if (document.visibilityState === 'visible') resync();
  };
  window.addEventListener('pageshow', resync);
  window.addEventListener('popstate', resync);
  window.addEventListener('focus', resync);
  document.addEventListener('visibilitychange', resyncVisible);
};

export const noteChromePath = (_pathname: string) => {
  /* noop */
};
