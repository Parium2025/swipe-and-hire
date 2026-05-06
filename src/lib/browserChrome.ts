const LANDING_CHROME_COLOR = '#626262';
const PARIUM_CHROME_COLOR = '#001935';
const THEME_COLOR_MEDIA = ['', '(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'];

const isLandingVideoPath = (pathname: string) => pathname === '/' || pathname === '';

// Remove any legacy sentinel elements that previous versions injected into <body>.
// These caused a visible dark strip at the top/bottom of the viewport.
const removeLegacySentinels = () => {
  ['parium-browser-chrome-top', 'parium-browser-chrome-bottom'].forEach((id) => {
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

export const syncBrowserChrome = (pathname = window.location.pathname) => {
  const isLandingVideo = isLandingVideoPath(pathname);
  const color = isLandingVideo ? LANDING_CHROME_COLOR : PARIUM_CHROME_COLOR;

  removeLegacySentinels();

  document.documentElement.classList.toggle('landing-video-chrome', isLandingVideo);
  document.body.classList.toggle('landing-video-chrome', isLandingVideo);
  document.documentElement.classList.toggle('parium-app-chrome', !isLandingVideo);
  document.body.classList.toggle('parium-app-chrome', !isLandingVideo);

  // IMPORTANT: Do NOT touch body/html background — that would override the
  // app's own gradient. theme-color alone tells Safari/Chrome which color
  // to paint their browser UI (URL bar / toolbar) with.
  document.body.style.removeProperty('background-color');
  document.body.style.removeProperty('background');
  document.documentElement.style.removeProperty('background-color');
  document.documentElement.style.removeProperty('background');

  setThemeColor(color);
};
