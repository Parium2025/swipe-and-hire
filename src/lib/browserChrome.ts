const PARIUM_CHROME_COLOR = '#001935';
const THEME_COLOR_MEDIA = ['', '(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'];
const BOTTOM_BAR_ID = 'parium-bottom-chrome';

// Remove any legacy sentinel elements that previous versions injected.
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
 * Synkroniserar browserns chrome (URL-bar topp + verktygsfält botten).
 *
 * BESLUT (2026-05-06): Hela appen — inklusive landningssidan — använder
 * Parium-blå (#001935) för browser-chrome. Tidigare hade landningssidan
 * grått chrome (matchande videons fade), men iOS Safari behöll grå
 * sampling vid SPA-navigering vilket gav vit/fel botten på övriga sidor.
 *
 * Genom att alltid använda samma färg får vi:
 *   - Konsekvent topp-URL-bar i hela appen (Parium-blå).
 *   - Konsekvent bottenverktygsfält (Parium-blå).
 *   - Inga Safari-samplings-buggar vid SPA-navigering.
 *   - Videon på landningssidan fyller fortfarande hela viewporten.
 */
export const syncBrowserChrome = (_pathname = window.location.pathname) => {
  removeLegacySentinels();

  // Behåll klasser för bakåtkompatibilitet med befintlig CSS, men båda
  // pekar nu på samma färg.
  document.documentElement.classList.remove('landing-video-chrome');
  document.body.classList.remove('landing-video-chrome');
  document.documentElement.classList.add('parium-app-chrome');
  document.body.classList.add('parium-app-chrome');

  // Inline body/html-färg → Safari samplar bottnen baserat på denna.
  document.documentElement.style.backgroundColor = PARIUM_CHROME_COLOR;
  document.body.style.backgroundColor = PARIUM_CHROME_COLOR;

  // Top URL-bar.
  setThemeColor(PARIUM_CHROME_COLOR);
};
