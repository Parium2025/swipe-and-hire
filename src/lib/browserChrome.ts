const LANDING_CHROME_COLOR = '#626262';
const PARIUM_CHROME_COLOR = '#001935';
const THEME_COLOR_MEDIA = ['', '(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'];

const isLandingVideoPath = (pathname: string) => pathname === '/' || pathname === '';

const setThemeColor = (color: string) => {
  const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]')) as HTMLMetaElement[];

  THEME_COLOR_MEDIA.forEach((media) => {
    if (metas.some((meta) => (meta.getAttribute('media') || '') === media)) return;
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    if (media) meta.media = media;
    document.head.appendChild(meta);
    metas.push(meta);
  });

  metas.forEach((meta) => meta.setAttribute('content', color));

  requestAnimationFrame(() => {
    metas.forEach((meta) => {
      const clone = meta.cloneNode() as HTMLMetaElement;
      clone.setAttribute('content', color);
      meta.replaceWith(clone);
    });
  });
};

export const syncBrowserChrome = (pathname = window.location.pathname) => {
  const isLandingVideo = isLandingVideoPath(pathname);
  const color = isLandingVideo ? LANDING_CHROME_COLOR : PARIUM_CHROME_COLOR;

  document.documentElement.classList.toggle('landing-video-chrome', isLandingVideo);
  document.body.classList.toggle('landing-video-chrome', isLandingVideo);
  document.documentElement.classList.toggle('parium-app-chrome', !isLandingVideo);
  document.body.classList.toggle('parium-app-chrome', !isLandingVideo);

  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;

  setThemeColor(color);
};