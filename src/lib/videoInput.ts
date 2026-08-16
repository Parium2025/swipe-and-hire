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
