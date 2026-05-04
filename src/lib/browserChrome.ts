const LANDING_CHROME_COLOR = '#626262';
const PARIUM_CHROME_COLOR = '#001935';

const isLandingVideoPath = (pathname: string) => pathname === '/' || pathname === '';

const setThemeColor = (color: string) => {
  const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]')) as HTMLMetaElement[];

  if (!metas.some((meta) => !meta.hasAttribute('media'))) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
    metas.push(meta);
  }

  metas.forEach((meta) => meta.setAttribute('content', color));

  requestAnimationFrame(() => {
    metas.forEach((meta) => meta.setAttribute('content', color));
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