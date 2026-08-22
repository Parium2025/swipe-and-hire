/**
 * 🔒 FILTYPSKONTROLL FÖR CHATTBILAGOR
 *
 * Samma lista används på tre ställen:
 *   1. <input accept="..."> — vad filväljaren visar
 *   2. Klientvalidering innan uppladdning (tydligt felmeddelande)
 *   3. Storage-bucketens allowed_mime_types (server-side, kan inte kringgås)
 *
 * Servern litar aldrig på klienten: även om någon manipulerar frontend
 * avvisar Storage uppladdningen om MIME-typen inte finns i listan.
 */

/** Filändelse → korrekt MIME-typ. Används när webbläsaren inte kan avgöra typen. */
export const EXTENSION_MIME_MAP: Record<string, string> = {
  // Bilder
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  // Video
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2',
  avi: 'video/x-msvideo',
  // Ljud
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/opus',
  flac: 'audio/flac',
  amr: 'audio/amr',
  // Dokument
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  rtf: 'application/rtf',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  pages: 'application/vnd.apple.pages',
  numbers: 'application/vnd.apple.numbers',
  key: 'application/vnd.apple.keynote',
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  json: 'application/json',
  // Arkiv
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  gz: 'application/gzip',
  tar: 'application/x-tar',
};

/** MIME-typer som Storage accepterar. Håll i synk med migrationen. */
export const ALLOWED_MIME_TYPES: string[] = Array.from(
  new Set([
    ...Object.values(EXTENSION_MIME_MAP),
    'audio/mp3',
    'audio/x-m4a',
    'audio/webm',
    'video/mpeg',
    'text/plain;charset=utf-8',
  ]),
);

/** Ändelser som alltid blockeras — körbara filer och skript. */
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'cpl', 'jar', 'app', 'dmg',
  'pkg', 'deb', 'rpm', 'apk', 'sh', 'bash', 'zsh', 'ps1', 'vbs', 'vbe', 'js',
  'jse', 'wsf', 'wsh', 'hta', 'dll', 'sys', 'reg', 'lnk', 'iso',
]);

export const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;

export function getExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) return '';
  return (parts.pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Bestämmer vilken MIME-typ filen ska laddas upp med. Webbläsare rapporterar
 * ofta tom typ för HEIC, Pages och gamla Office-format — då härleds typen
 * från filändelsen så att den passerar serverkontrollen.
 */
export function resolveContentType(file: File): string | null {
  const ext = getExtension(file.name);
  const fromExt = EXTENSION_MIME_MAP[ext];
  if (fromExt) return fromExt;
  if (file.type && ALLOWED_MIME_TYPES.includes(file.type)) return file.type;
  return null;
}

export interface FileValidationResult {
  ok: boolean;
  contentType?: string;
  error?: string;
  description?: string;
}

export function validateAttachment(file: File): FileValidationResult {
  const ext = getExtension(file.name);

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: 'Filtypen tillåts inte',
      description: 'Program- och skriptfiler kan inte skickas i chatten.',
    };
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    return { ok: false, error: 'Filen är för stor (max 50 MB)' };
  }

  if (file.size === 0) {
    return { ok: false, error: 'Filen är tom' };
  }

  const contentType = resolveContentType(file);
  if (!contentType) {
    return {
      ok: false,
      error: 'Filtypen stöds inte',
      description: 'Prova att spara om filen som PDF, bild eller ett vanligt dokumentformat.',
    };
  }

  return { ok: true, contentType };
}

/** accept-attribut för filväljaren. */
export const ATTACHMENT_ACCEPT = [
  ...Object.keys(EXTENSION_MIME_MAP).map((e) => `.${e}`),
  'image/*',
  'video/*',
  'audio/*',
].join(',');
