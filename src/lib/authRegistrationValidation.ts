export const MIN_AUTH_PASSWORD_LENGTH = 8;

export const AUTH_REGISTRATION_LIMITS = {
  email: 254,
  password: 128,
  name: 100,
  phone: 30,
  companyName: 200,
  industry: 120,
  address: 160,
  website: 200,
  companyDescription: 3000,
} as const;

function isPublicHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  if (!normalized.includes('.')) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized)) return false;
  if (normalized.includes(':')) return false;

  const reservedSuffixes = [
    '.localhost',
    '.local',
    '.internal',
    '.lan',
    '.home',
    '.test',
    '.invalid',
    '.example',
  ];
  if (normalized === 'localhost' || reservedSuffixes.some((suffix) => normalized.endsWith(suffix))) {
    return false;
  }

  return !normalized.startsWith('.') && !normalized.endsWith('.');
}

/**
 * Accepts a normal public http(s) address and adds https:// when the user
 * omitted a scheme. Credentials and non-web schemes are rejected before the
 * value is persisted as company metadata.
 */
export function normalizeAuthWebsite(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(candidate);
    const isWebProtocol = url.protocol === 'https:' || url.protocol === 'http:';
    const hasPublicHostname = isPublicHostname(url.hostname);
    const hasCredentials = Boolean(url.username || url.password);

    if (!isWebProtocol || !hasPublicHostname || hasCredentials) return null;
    return url.toString();
  } catch {
    return null;
  }
}
