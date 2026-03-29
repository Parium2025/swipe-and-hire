const SUPPORTED_MEETING_HOSTS = [
  'meet.google.com',
  'hangouts.google.com',
  'teams.microsoft.com',
  'teams.live.com',
  'zoom.us',
  'zoom.com',
  'webex.com',
  'whereby.com',
  'meet.jit.si',
  'join.skype.com',
  'gotomeet.me',
  'gotomeeting.com',
  'bluejeans.com',
  'around.co',
  'daily.co',
  'huddle.team',
] as const;

const stripTrailingPunctuation = (value: string): string => value.replace(/[),.;!?]+$/g, '');

export const normalizeMeetingLink = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const withoutAngles = trimmed.replace(/^<+|>+$/g, '');
  const withProtocol = /^https?:\/\//i.test(withoutAngles) ? withoutAngles : `https://${withoutAngles}`;

  const firstUrlChunk = withProtocol
    .split(/(?=https?:\/\/)/i)
    .map((segment) => segment.trim())
    .filter(Boolean)[0] ?? withProtocol;

  const normalizedCandidate = stripTrailingPunctuation(firstUrlChunk);

  try {
    return new URL(normalizedCandidate).toString();
  } catch {
    return stripTrailingPunctuation(withoutAngles);
  }
};

export const isSupportedMeetingLink = (url: string): boolean => {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return SUPPORTED_MEETING_HOSTS.some(
      (supportedHost) => hostname === supportedHost || hostname.endsWith(`.${supportedHost}`)
    );
  } catch {
    return false;
  }
};
