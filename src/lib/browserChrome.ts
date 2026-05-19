const LANDING_CHROME_COLOR = '#626262';
// Matcha body-bakgrunden exakt (hsl(215 100% 12%) ≈ #00193D) så att den övre
// URL-baren får samma färg som iOS Safaris bottenverktygsfält samplar från
// body. På så vis "följer toppen med" precis som bottens färg gör.
const PARIUM_CHROME_COLOR = '#00193D';
const AUDIENCE_LANDING_CHROME_COLOR = '#00193D';
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

  // iOS Safari samplar body-färgen för bottenverktygsfältet vid first paint och
  // uppdaterar inte vid SPA-nav. Trigga en forcerad re-sampling:
  //   1) Forcera reflow via offsetHeight read
  //   2) Mikro-scroll-nudge (1px ner och tillbaka) i nästa frame — det är det
  //      som faktiskt får Safari att om-sampla URL-bar och bottenfält.
  // Detta påverkar inget visuellt och berör inte layout/spacing.
  void document.body.offsetHeight;
  if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
    requestAnimationFrame(() => {
      const y = window.scrollY;
      window.scrollTo(0, y + 1);
      requestAnimationFrame(() => window.scrollTo(0, y));
    });
  }

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
};

export const noteChromePath = (_pathname: string) => {
  /* noop */
};
