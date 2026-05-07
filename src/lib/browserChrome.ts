const LANDING_CHROME_COLOR = '#0a0a0a';
const PARIUM_CHROME_COLOR = '#001935';
const THEME_COLOR_MEDIA = ['', '(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'];

const isLandingVideoPath = (pathname: string) => pathname === '/' || pathname === '';

const removeLegacySentinels = () => {
  ['parium-browser-chrome-top', 'parium-browser-chrome-bottom', 'parium-bottom-chrome'].forEach((id) => {
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
 * Synkar browser-chrome (URL-bar topp + body-bakgrund).
 *
 * iOS Safaris bottenverktygsfält samplar body's bakgrundsfärg vid first paint
 * och uppdaterar inte vid SPA-nav. Vi accepterar den begränsningen — topp-baren
 * och body-färgen byts dock korrekt. Hard reloads tas bort eftersom de orsakade
 * vit/trasig sida i kombination med cache-killswitchen i index.html.
 */
export const syncBrowserChrome = (pathname = window.location.pathname) => {
  const isLandingVideo = isLandingVideoPath(pathname);
  const color = isLandingVideo ? LANDING_CHROME_COLOR : PARIUM_CHROME_COLOR;

  removeLegacySentinels();

  document.documentElement.classList.toggle('landing-video-chrome', isLandingVideo);
  document.body.classList.toggle('landing-video-chrome', isLandingVideo);
  document.documentElement.classList.toggle('parium-app-chrome', !isLandingVideo);
  document.body.classList.toggle('parium-app-chrome', !isLandingVideo);

  document.documentElement.style.setProperty('background-color', color, 'important');
  document.body.style.setProperty('background-color', color, 'important');

  setThemeColor(color);
};

// Behållna no-ops för bakåtkompatibilitet med App.tsx-importer.
export const mountChromePopstateGuard = () => {
  /* intentionally noop — hard reloads togs bort, de orsakade vit sida vid back. */
};

export const noteChromePath = (_pathname: string) => {
  /* noop */
};
