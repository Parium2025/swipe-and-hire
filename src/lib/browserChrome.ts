const LANDING_CHROME_COLOR = '#626262';
const PARIUM_CHROME_COLOR = '#001935';
const THEME_COLOR_MEDIA = ['', '(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'];
const CHROME_SYNC_DELAYS = [0, 16, 80, 180, 360, 720, 1200];
const CHROME_SENTINELS = [
  { id: 'parium-browser-chrome-top', edge: 'top' },
  { id: 'parium-browser-chrome-bottom', edge: 'bottom' },
] as const;
let chromeSyncVersion = 0;

const isLandingVideoPath = (pathname: string) => pathname === '/' || pathname === '';

const ensureChromeSentinel = ({ id, edge }: (typeof CHROME_SENTINELS)[number]) => {
  let sentinel = document.getElementById(id) as HTMLDivElement | null;

  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.id = id;
    sentinel.className = 'parium-browser-chrome-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.dataset.chromeEdge = edge;
    document.body.appendChild(sentinel);
  }

  return sentinel;
};

const paintChromeSentinels = (color: string) => {
  CHROME_SENTINELS.forEach((sentinelConfig) => {
    const sentinel = ensureChromeSentinel(sentinelConfig);
    sentinel.style.backgroundColor = color;
    sentinel.style.setProperty('--active-browser-chrome-color', color);
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

  requestAnimationFrame(() => {
    metas.forEach((meta) => {
      const clone = meta.cloneNode() as HTMLMetaElement;
      clone.setAttribute('content', color);
      meta.replaceWith(clone);
    });
  });
};

const paintChromeBase = (color: string, isLandingVideo: boolean) => {
  document.documentElement.classList.toggle('landing-video-chrome', isLandingVideo);
  document.body.classList.toggle('landing-video-chrome', isLandingVideo);
  document.documentElement.classList.toggle('parium-app-chrome', !isLandingVideo);
  document.body.classList.toggle('parium-app-chrome', !isLandingVideo);

  document.documentElement.style.setProperty('--active-browser-chrome-color', color);
  document.body.style.setProperty('--active-browser-chrome-color', color);
  document.documentElement.style.background = color;
  document.documentElement.style.backgroundColor = color;
  document.body.style.background = color;
  document.body.style.backgroundColor = color;

  paintChromeSentinels(color);
  setThemeColor(color);
};

export const syncBrowserChrome = (pathname = window.location.pathname) => {
  const syncVersion = ++chromeSyncVersion;
  const isLandingVideo = isLandingVideoPath(pathname);
  const color = isLandingVideo ? LANDING_CHROME_COLOR : PARIUM_CHROME_COLOR;

  CHROME_SYNC_DELAYS.forEach((delay) => {
    window.setTimeout(() => {
      if (syncVersion !== chromeSyncVersion) return;
      paintChromeBase(color, isLandingVideo);
    }, delay);
  });
};