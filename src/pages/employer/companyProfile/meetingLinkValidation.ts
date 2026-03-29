import { isSupportedMeetingLink, normalizeMeetingLink } from '@/lib/meetingLink';

export const isValidMeetingLink = (url: string): boolean => {
  if (!url || url.trim() === '') return true; // Empty is valid (optional field)
  const normalized = normalizeMeetingLink(url);
  return isSupportedMeetingLink(normalized);
};
