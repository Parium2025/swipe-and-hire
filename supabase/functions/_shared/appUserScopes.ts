export const SUPPORTED_CONNECTORS = ['google_calendar', 'microsoft_outlook'] as const;
export type SupportedConnector = (typeof SUPPORTED_CONNECTORS)[number];

export function isSupportedConnector(value: unknown): value is SupportedConnector {
  return typeof value === 'string' && (SUPPORTED_CONNECTORS as readonly string[]).includes(value);
}

// Google: grundprofil + full kalenderåtkomst (behövs för att skapa/ta bort
// intervjuevents i användarens egen kalender).
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar',
];

// Microsoft: grundprofil + full kalenderåtkomst via Graph.
export const MICROSOFT_OUTLOOK_SCOPES = [
  'openid',
  'email',
  'profile',
  'offline_access',
  'Calendars.ReadWrite',
];

export function scopesForConnector(connectorId: SupportedConnector): string[] {
  return connectorId === 'google_calendar' ? GOOGLE_CALENDAR_SCOPES : MICROSOFT_OUTLOOK_SCOPES;
}

export function clientApiKeyEnvName(connectorId: SupportedConnector): string {
  return `${connectorId.toUpperCase()}_APP_USER_CONNECTOR_CLIENT_API_KEY`;
}

export const GATEWAY_BASE_URL = 'https://connector-gateway.lovable.dev';
