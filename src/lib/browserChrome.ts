const LANDING_CHROME_COLOR = '#626262';
const PARIUM_CHROME_COLOR = '#001935';
const THEME_COLOR_MEDIA = ['', '(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'];
const BOTTOM_BAR_ID = 'parium-bottom-chrome';

const isLandingVideoPath = (pathname: string) => pathname === '/' || pathname === '';

const removeLegacySentinels = () => {
  ['parium-browser-chrome-top', 'parium-browser-chrome-bottom', BOTTOM_BAR_ID].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
};

const setThemeColor = (color: string) => {
  const existing = Array.from(document.querySelectorAll('meta[name="theme-color"]')) as HTMLMetaElement[];
  const metas: HTMLMetaElement[] = [];

  THEME_COLOR_MEDIA.forEach((media) => {
    const meta = existing.find((item) => (item.getAttribute('media') || '') === media) ?? document.createElement('meta');
    meta.name = 'theme-color';
    if (media) meta.media = media;
    else meta.removeAttribute('media');
    meta.setAttribute('content', color);
    document.head.insertBefore(meta, document.head.firstChild);
    metas.push(meta);
  });

  existing.forEach((meta) => {
    if (!metas.includes(meta)) meta.remove();
  });
};

/**
 * Synkroniserar browser-chrome (URL-bar topp + bottenverktygsfält).
 *
 * KÄND iOS SAFARI-BUGG:
 * Safari samplar body's bakgrundsfärg för bottenverktygsfältet vid
 * SIDLADDNING. Vid SPA-navigering uppdateras topp-URL-baren via
 * <meta name="theme-color">, men bottenfältet behåller sin första
 * sampling tills sidan laddas om.
 *
 * LÖSNING: Om vi byter mellan en grå route (/) och en blå route
 * (resten av appen) tvingar vi en hard reload via location.assign,
 * så Safari samplar den nya färgen från scratch.
 */
export const syncBrowserChrome = (pathname = window.location.pathname) => {
  const isLandingVideo = isLandingVideoPath(pathname);
  const color = isLandingVideo ? LANDING_CHROME_COLOR : PARIUM_CHROME_COLOR;

  removeLegacySentinels();

  document.documentElement.classList.toggle('landing-video-chrome', isLandingVideo);
  document.body.classList.toggle('landing-video-chrome', isLandingVideo);
  document.documentElement.classList.toggle('parium-app-chrome', !isLandingVideo);
  document.body.classList.toggle('parium-app-chrome', !isLandingVideo);

  // Inline body/html-färg vinner över CSS (utom !important).
  document.documentElement.style.setProperty('background-color', color, 'important');
  document.body.style.setProperty('background-color', color, 'important');

  setThemeColor(color);
};

/**
 * Navigerar till en route med hard reload om bottenfältets färg behöver
 * byta. Användning: window-nivå navigation från landing → app eller back.
 */
export const navigateWithChromeSync = (target: string) => {
  const currentIsLanding = isLandingVideoPath(window.location.pathname);
  const targetIsLanding = isLandingVideoPath(target);

  if (currentIsLanding !== targetIsLanding) {
    // Färgbyte krävs → hard reload så iOS Safari samplar om bottenfältet.
    window.location.assign(target);
    return true;
  }
  return false;
};

/**
 * Lyssnar på popstate (back/forward-knapp). Om vi byter mellan grå/blå
 * routes via back-knappen tvingar vi en reload så bottenfältet uppdateras.
 *
 * Detta är säkert att alltid montera — det körs bara en gång per popstate
 * och gör bara reload när färgbyte faktiskt sker.
 */
let popstateMounted = false;
let lastSeenPath = typeof window !== 'undefined' ? window.location.pathname : '/';

export const mountChromePopstateGuard = () => {
  if (popstateMounted || typeof window === 'undefined') return;
  popstateMounted = true;

  window.addEventListener('popstate', () => {
    const newPath = window.location.pathname;
    const wasLanding = isLandingVideoPath(lastSeenPath);
    const isLanding = isLandingVideoPath(newPath);
    lastSeenPath = newPath;

    if (wasLanding !== isLanding) {
      // Färgbyte via back/forward → hard reload för korrekt iOS-rendering.
      window.location.reload();
    }
  });
};

// Track path changes from SPA navigation too.
export const noteChromePath = (pathname: string) => {
  lastSeenPath = pathname;
};
