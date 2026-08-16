/**
 * Vilka videofiler vi tar emot som *indata*.
 *
 * Alla videor körs genom `optimizeVideoForUpload` och lagras som H.264/MP4 —
 * därför kan indata-listan vara bred. Det som avgör om filen får sparas är
 * `playableEverywhere`, inte MIME-typen från filväljaren.
 *
 * Viktigt i praktiken:
 *  - Android-galleriet kan skicka `video/3gpp`, `video/x-matroska` eller webm.
 *  - Vissa Android/Windows-filväljare skickar tom `file.type` → då faller vi
 *    tillbaka på filändelsen i stället för att blockera användaren.
 */
export const ACCEPTED_VIDEO_MIME = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
  'video/m4v',
  'video/3gpp',
  'video/3gpp2',
  'video/x-matroska',
  'video/mpeg',
  'video/ogg',
] as const;

const ACCEPTED_VIDEO_EXT = [
  'mp4',
  'm4v',
  'mov',
  'webm',
  '3gp',
  '3g2',
  'mkv',
  'mpeg',
  'mpg',
  'ogv',
];

/**
 * Samma lista som ändelser med punkt, för filväljare och react-dropzone.
 *
 * Utan detta faller Android-filer med tom MIME-typ bort redan i filväljaren
 * ("Filtypen stöds inte") innan vår egen, bredare kontroll ens körs.
 */
export const ACCEPTED_VIDEO_EXTENSIONS = ACCEPTED_VIDEO_EXT.map((e) => `.${e}`);


/** Ändelse i gemener utan punkt, eller tom sträng. */
function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
}

/** Är detta en videofil vi kan försöka bearbeta? */
export function isAcceptedVideoFile(file: { type?: string; name?: string }): boolean {
  const type = (file.type || '').toLowerCase();
  if ((ACCEPTED_VIDEO_MIME as readonly string[]).includes(type)) return true;
  // Tom eller generisk MIME (vanligt på Android/Windows) → lita på ändelsen.
  if (!type || type === 'application/octet-stream') {
    return ACCEPTED_VIDEO_EXT.includes(extensionOf(file.name || ''));
  }
  return false;
}

/** Ser filen ut som video över huvud taget (MIME eller ändelse)? */
export function looksLikeVideoFile(file: { type?: string; name?: string }): boolean {
  if ((file.type || '').toLowerCase().startsWith('video/')) return true;
  return ACCEPTED_VIDEO_EXT.includes(extensionOf(file.name || ''));
}

/** Hård gräns för videolängd (sekunder). Skyddar lagring och bandbredd i skala. */
export const MAX_VIDEO_SECONDS = 90;

/**
 * Läser videons längd via ett <video>-element. Returnerar null om längden
 * inte går att läsa (då släpper vi igenom filen hellre än att blockera fel).
 */
export function readVideoDurationFromBlob(blob: Blob): Promise<number | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const el = document.createElement('video');
    el.preload = 'metadata';
    let settled = false;
    const done = (value: number | null) => {
      if (settled) return;
      settled = true;
      el.onloadedmetadata = null;
      el.onerror = null;
      el.removeAttribute('src');
      try { el.load(); } catch { /* ignore */ }
      URL.revokeObjectURL(url);
      resolve(value);
    };
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null);
    el.onerror = () => done(null);
    el.src = url;
    window.setTimeout(() => done(null), 8000);
  });
}
