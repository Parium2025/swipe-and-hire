const LANDING_CHROME_COLOR = '#626262';
const PARIUM_CHROME_COLOR = '#001935';
const AUDIENCE_LANDING_CHROME_COLOR = '#001F3D';
const THEME_COLOR_MEDIA = ['', '(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'];

const isLandingVideoPath = (pathname: string) => pathname === '/' || pathname === '';
const isAudienceLandingPath = (pathname: string) =>
  pathname === '/arbetsgivare' || pathname === '/jobbsokare';

const removeLegacySentinels = () => {
  ['parium-browser-chrome-top', 'parium-browser-chrome-bottom', 'parium-bottom-chrome'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
};

const setThemeColor = (color: string) => {
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

  setThemeColor(color);

  // iOS Safari cache:ar theme-color hårt vid SPA-nav — topp-baren samplas en
  // gång och uppdateras inte även om meta-taggen byts. Trick: sätt en
  // omärkbart annan färg en frame senare och återgå direkt — det tvingar
  // Safari att re-sampla utan att användaren ser någon flimmer.
  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(() => {
      // 1 enhets skillnad i sista hex-paret → osynligt för ögat, nytt värde för Safari
      const nudge = color.length === 7
        ? color.slice(0, -2) + (color.slice(-2) === 'ff' ? 'fe' : (parseInt(color.slice(-2), 16) ^ 1).toString(16).padStart(2, '0'))
        : color;
      setThemeColor(nudge);
      window.requestAnimationFrame(() => setThemeColor(color));
    });
  }
};

// Mountar pageshow/popstate/visibilitychange-listeners som re-syncar chrome
// när Safari restorar sidan från bfcache eller när användaren växlar flik.
// Annars sitter den gamla theme-color-färgen kvar i URL-baren efter SPA-back.
let pageshowMounted = false;
export const mountChromePopstateGuard = () => {
  if (pageshowMounted || typeof window === 'undefined') return;
  pageshowMounted = true;
  const resync = () => syncBrowserChrome(window.location.pathname);
  window.addEventListener('pageshow', resync);
  window.addEventListener('popstate', resync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resync();
  });
};

export const noteChromePath = (_pathname: string) => {
  /* noop */
};
