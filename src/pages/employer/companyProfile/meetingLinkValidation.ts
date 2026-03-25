// Video meeting link validation
const VALID_MEETING_PATTERNS = [
  // Google Meet
  /^https?:\/\/(meet\.google\.com|hangouts\.google\.com)\/.+/i,
  // Microsoft Teams
  /^https?:\/\/teams\.microsoft\.com\/.+/i,
  // Zoom
  /^https?:\/\/([\w-]+\.)?zoom\.us\/.+/i,
  // Webex
  /^https?:\/\/([\w-]+\.)?webex\.com\/.+/i,
  // Whereby
  /^https?:\/\/whereby\.com\/.+/i,
  // Jitsi
  /^https?:\/\/meet\.jit\.si\/.+/i,
  // Skype
  /^https?:\/\/join\.skype\.com\/.+/i,
  // GoToMeeting
  /^https?:\/\/(gotomeet\.me|gotomeeting\.com)\/.+/i,
  // BlueJeans
  /^https?:\/\/([\w-]+\.)?bluejeans\.com\/.+/i,
  // Around
  /^https?:\/\/around\.co\/.+/i,
  // Daily.co
  /^https?:\/\/([\w-]+\.)?daily\.co\/.+/i,
  // Huddle
  /^https?:\/\/([\w-]+\.)?huddle\.team\/.+/i,
];

export const isValidMeetingLink = (url: string): boolean => {
  if (!url || url.trim() === '') return true; // Empty is valid (optional field)
  return VALID_MEETING_PATTERNS.some(pattern => pattern.test(url.trim()));
};
