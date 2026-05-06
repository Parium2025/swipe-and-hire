const LANDING_CHROME_COLOR = '#626262';
const PARIUM_CHROME_COLOR = '#001935';
const THEME_COLOR_MEDIA = ['', '(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'];
const BOTTOM_BAR_ID = 'parium-bottom-chrome';

const isLandingVideoPath = (pathname: string) => pathname === '/' || pathname === '';

// Remove any legacy sentinel elements that previous versions injected into <body>.
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

/**
 * iOS Safari har ingen API för att styra bottenverktygsfältets färg
 * (theme-color påverkar bara toppen). Lösningen: rendera ett fixed
 * DOM-element längst ner som täcker safe-area-bottnen. Safari samplar
 * den nedersta synliga pixeln för bottenfältet → vår remsa styr färgen.
 *
 * Detta är samma princip som theme-color använder för toppen, fast
 * implementerat manuellt för bottnen.
 */
const ensureBottomChrome = (color: string) => {
  if (typeof document === 'undefined') return;
  let bar = document.getElementById(BOTTOM_BAR_ID);
  if (!bar) {
    bar = document.createElement('div');
    bar.id = BOTTOM_BAR_ID;
    bar.setAttribute('aria-hidden', 'true');
    bar.style.cssText = [
      'position:fixed',
      'left:0',
      'right:0',
      'bottom:0',
      // Täck hela safe-area + några extra pixlar så Safari garanterat
      // samplar vår färg, inte gradienten ovanför.
      'height:calc(env(safe-area-inset-bottom, 0px) + 24px)',
      'pointer-events:none',
      // Ovanpå app-content men UNDER modaler/toasts (z-index < 9999).
      'z-index:2147483646',
      'transform:translateZ(0)',
      'will-change:background-color',
      'transition:background-color 0.2s ease-out',
    ].join(';');
    document.body.appendChild(bar);
  }
  bar.style.backgroundColor = color;
};

export const syncBrowserChrome = (pathname = window.location.pathname) => {
  const isLandingVideo = isLandingVideoPath(pathname);
  const color = isLandingVideo ? LANDING_CHROME_COLOR : PARIUM_CHROME_COLOR;

  removeLegacySentinels();

  document.documentElement.classList.toggle('landing-video-chrome', isLandingVideo);
  document.body.classList.toggle('landing-video-chrome', isLandingVideo);
  document.documentElement.classList.toggle('parium-app-chrome', !isLandingVideo);
  document.body.classList.toggle('parium-app-chrome', !isLandingVideo);

  // Toppen: theme-color (officiell API som Safari/Chrome respekterar).
  setThemeColor(color);

  // Bottnen: fixed DOM-remsa (eftersom ingen theme-color-API finns för
  // bottenverktygsfältet på iOS). Färgen byts automatiskt vid varje
  // SPA-navigering — exakt samma trigger-punkt som toppen.
  ensureBottomChrome(color);
};

