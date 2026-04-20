export function appendVersionToUrl(url: string | null | undefined, version: string | null | undefined): string | null {
  if (!url) return null;

  const normalizedVersion = typeof version === 'string' ? version.trim() : '';
  if (!normalizedVersion) return url;

  try {
    const parsed = new URL(
      url,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    );
    parsed.searchParams.set('v', normalizedVersion);
    return parsed.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${encodeURIComponent(normalizedVersion)}`;
  }
}