const LANDING_CHROME_COLOR = '#626262';
const PARIUM_CHROME_COLOR = '#001935';
const THEME_COLOR_MEDIA = ['', '(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'];
const BOTTOM_BAR_ID = 'parium-bottom-chrome';

const isLandingVideoPath = (pathname: string) => pathname === '/' || pathname === '';

// Remove any legacy sentinel elements that previous versions injected into <body>.
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
 * Synkroniserar browserns "chrome" (URL-bar topp + verktygsfält botten) med
 * appens nuvarande route. iOS Safari styrs av:
 *   - <meta name="theme-color"> för toppen
 *   - body's computed background-color för bottnen
 *
 * Inline-style på body/html har högre specificity än <style>-block, så vi
 * sätter färgen direkt på elementen — det överrider safe defaults i index.html
 * och funkar både vid first paint och SPA-navigering.
 */
export const syncBrowserChrome = (pathname = window.location.pathname) => {
  const isLandingVideo = isLandingVideoPath(pathname);
  const color = isLandingVideo ? LANDING_CHROME_COLOR : PARIUM_CHROME_COLOR;

  removeLegacySentinels();

  document.documentElement.classList.toggle('landing-video-chrome', isLandingVideo);
  document.body.classList.toggle('landing-video-chrome', isLandingVideo);
  document.documentElement.classList.toggle('parium-app-chrome', !isLandingVideo);
  document.body.classList.toggle('parium-app-chrome', !isLandingVideo);

  // Inline body/html-färg → Safari samplar bottnen baserat på denna.
  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;

  // Top URL-bar.
  setThemeColor(color);
};
