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

/* ------------------------------------------------------------------ *
 * 🔬 INNEHÅLLSKONTROLL (magic bytes)
 *
 * Filändelsen kan ljuga: någon kan döpa om virus.exe till rapport.pdf.
 * Därför läser vi de första byten i filen och jämför med det som
 * ändelsen påstår. Körbara filer blockeras alltid, oavsett namn.
 * ------------------------------------------------------------------ */

function bytesStartWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

/** Signaturer för körbara filer/skript — blockeras alltid. */
const EXECUTABLE_SIGNATURES: { name: string; sig: number[]; offset?: number }[] = [
  { name: 'Windows-program', sig: [0x4d, 0x5a] }, // MZ
  { name: 'Linux-program', sig: [0x7f, 0x45, 0x4c, 0x46] }, // ELF
  { name: 'macOS-program', sig: [0xcf, 0xfa, 0xed, 0xfe] }, // Mach-O 64
  { name: 'macOS-program', sig: [0xce, 0xfa, 0xed, 0xfe] }, // Mach-O 32
  { name: 'macOS-program', sig: [0xca, 0xfe, 0xba, 0xbe] }, // Universal binary / Java class
  { name: 'Skriptfil', sig: [0x23, 0x21] }, // #!
];

/** Förväntade signaturer per filändelse. Saknas ändelsen görs ingen kontroll. */
const EXPECTED_SIGNATURES: Record<string, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  png: [[0x89, 0x50, 0x4e, 0x47]],
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  gif: [[0x47, 0x49, 0x46, 0x38]],
  bmp: [[0x42, 0x4d]],
  flac: [[0x66, 0x4c, 0x61, 0x43]],
  mp3: [[0x49, 0x44, 0x33], [0xff, 0xfb], [0xff, 0xf3], [0xff, 0xf2]],
  ogg: [[0x4f, 0x67, 0x67, 0x53]],
  oga: [[0x4f, 0x67, 0x67, 0x53]],
  opus: [[0x4f, 0x67, 0x67, 0x53]],
  // ZIP-baserade format (Office, OpenDocument, Apple iWork)
  docx: [[0x50, 0x4b, 0x03, 0x04]],
  xlsx: [[0x50, 0x4b, 0x03, 0x04]],
  pptx: [[0x50, 0x4b, 0x03, 0x04]],
  odt: [[0x50, 0x4b, 0x03, 0x04]],
  ods: [[0x50, 0x4b, 0x03, 0x04]],
  odp: [[0x50, 0x4b, 0x03, 0x04]],
  pages: [[0x50, 0x4b, 0x03, 0x04]],
  numbers: [[0x50, 0x4b, 0x03, 0x04]],
  key: [[0x50, 0x4b, 0x03, 0x04]],
  zip: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08]],
  rar: [[0x52, 0x61, 0x72, 0x21]],
  '7z': [[0x37, 0x7a, 0xbc, 0xaf]],
  gz: [[0x1f, 0x8b]],
  // Gamla Office-format (OLE Compound File)
  doc: [[0xd0, 0xcf, 0x11, 0xe0]],
  xls: [[0xd0, 0xcf, 0x11, 0xe0]],
  ppt: [[0xd0, 0xcf, 0x11, 0xe0]],
};

/** Format där signaturen ligger på en annan position än början av filen. */
const OFFSET_SIGNATURES: Record<string, { sig: number[]; offset: number }[]> = {
  mp4: [{ sig: [0x66, 0x74, 0x79, 0x70], offset: 4 }], // ....ftyp
  m4v: [{ sig: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
  m4a: [{ sig: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
  mov: [{ sig: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
  heic: [{ sig: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
  heif: [{ sig: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
  avif: [{ sig: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
  webp: [{ sig: [0x57, 0x45, 0x42, 0x50], offset: 8 }], // RIFF....WEBP
  wav: [{ sig: [0x57, 0x41, 0x56, 0x45], offset: 8 }], // RIFF....WAVE
  avi: [{ sig: [0x41, 0x56, 0x49, 0x20], offset: 8 }],
};

/**
 * Läser filens första byte och avgör om innehållet stämmer med ändelsen.
 * Körs innan uppladdning — kompletterar serverns ändelsekontroll.
 */
export async function inspectFileContent(file: File): Promise<FileValidationResult> {
  const ext = getExtension(file.name);
  let bytes: Uint8Array;

  try {
    const buffer = await file.slice(0, 32).arrayBuffer();
    bytes = new Uint8Array(buffer);
  } catch {
    // Kan vi inte läsa filen låter vi ändelsekontrollen på servern avgöra.
    return { ok: true };
  }

  for (const exe of EXECUTABLE_SIGNATURES) {
    if (bytesStartWith(bytes, exe.sig)) {
      // ZIP och Java-class delar signatur med universal binaries i vissa fall —
      // men ZIP fångas av PK-signaturen ovan, så här är det ett riktigt program.
      return {
        ok: false,
        error: 'Filen ser ut att vara ett program',
        description: `Innehållet identifieras som ${exe.name.toLowerCase()} och kan inte skickas i chatten, oavsett filnamn.`,
      };
    }
  }

  const expected = EXPECTED_SIGNATURES[ext];
  if (expected && !expected.some((sig) => bytesStartWith(bytes, sig))) {
    return {
      ok: false,
      error: 'Filen matchar inte sin filändelse',
      description: `Innehållet ser inte ut att vara en giltig .${ext}-fil. Spara om filen och försök igen.`,
    };
  }

  const offsetSigs = OFFSET_SIGNATURES[ext];
  if (offsetSigs && !offsetSigs.some(({ sig, offset }) => bytesStartWith(bytes, sig, offset))) {
    return {
      ok: false,
      error: 'Filen matchar inte sin filändelse',
      description: `Innehållet ser inte ut att vara en giltig .${ext}-fil. Spara om filen och försök igen.`,
    };
  }

  return { ok: true };
}

