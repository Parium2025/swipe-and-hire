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

  // Sätt body/html bakgrundsfärg INLINE så iOS Safari ser ändringen direkt
  // vid SPA-navigering. Endast klasser räcker inte — Safari samplar bottnen
  // baserat på computed background-color och behöver en faktisk style-mutation.
  document.body.style.backgroundColor = color;
  document.documentElement.style.backgroundColor = color;

  setThemeColor(color);

  // Tvinga iOS Safari att re-sampla bottenverktygsfältet med en micro-scroll.
  // Utan detta behåller Safari färgen från first paint tills användaren själv
  // scrollar. Detta är ett känt iOS-beteende vid SPA-navigering.
  if (typeof window !== 'undefined') {
    requestAnimationFrame(() => {
      const y = window.scrollY;
      window.scrollTo(0, y + 1);
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    });
  }
};
