// Server-only. Lägger in och tar bort intervjuevents i den kopplade
// användarens egen kalender (Google Calendar eller Outlook) via kopplings-
// gatewayen. Anropas från outreach-dispatch — fel här får aldrig stoppa
// ett utskick, därför returneras alltid status i stället för att kasta.

import { appUserReconnectRequired, callAsAppUser } from './appUserConnector.ts';
import { getConnectionForUser } from './appUserConnections.ts';
import { GATEWAY_BASE_URL, scopesForConnector, type SupportedConnector } from './appUserScopes.ts';

export type CalendarRole = 'job_seeker' | 'employer';

export interface InterviewEventInput {
  interviewId: string;
  jobTitle: string;
  companyName: string;
  candidateName?: string | null;
  scheduledAt: string;
  durationMinutes: number | null;
  locationDetails?: string | null;
  message?: string | null;
}

export type CalendarSyncResult =
  | { status: 'connected' | 'skipped' | 'not_connected' }
  | { status: 'not_connected'; reconnectRequired: true };

const TIMEOUT_MS = 10_000;

const eventKey = (interviewId: string, role: CalendarRole) =>
  `${interviewId}:${role}`;

const icalUid = (interviewId: string, role: CalendarRole) =>
  `parium-interview-${interviewId}-${role}@parium.se`;

const transactionId = (interviewId: string, role: CalendarRole) =>
  `parium-interview-${interviewId}-${role}`;

function eventSummary(input: InterviewEventInput, role: CalendarRole): string {
  return role === 'job_seeker'
    ? `Intervju hos ${input.companyName} — ${input.jobTitle}`
    : `Intervju: ${input.candidateName ?? 'Kandidat'} — ${input.jobTitle}`;
}

function eventDescription(input: InterviewEventInput): string {
  const parts = [
    `Intervju bokad via Parium.`,
    `Tjänst: ${input.jobTitle}`,
    input.locationDetails ? `Plats/typ: ${input.locationDetails}` : null,
    input.message ? `\nMeddelande från ${input.companyName}:\n${input.message}` : null,
  ].filter(Boolean);
  return parts.join('\n');
}

function endIso(scheduledAt: string, durationMinutes: number | null): string {
  const start = new Date(scheduledAt).getTime();
  const duration = Number.isFinite(durationMinutes) && durationMinutes! > 0 ? durationMinutes! : 45;
  return new Date(start + duration * 60_000).toISOString();
}

async function googleRequest(
  connectionAPIKey: string,
  path: string,
  init?: RequestInit,
) {
  return callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: 'google_calendar',
    path,
    init,
    requiredScopes: scopesForConnector('google_calendar'),
  });
}

async function findGoogleEventIds(connectionAPIKey: string, interviewId: string, role: CalendarRole): Promise<string[]> {
  const query = new URLSearchParams({
    iCalUID: icalUid(interviewId, role),
    maxResults: '10',
    showDeleted: 'false',
  });
  const res = await googleRequest(connectionAPIKey, `/calendar/v3/calendars/primary/events?${query}`, {
    method: 'GET',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null) as { items?: Array<{ id?: string }> } | null;
  return (data?.items ?? []).flatMap((item) => item.id ? [item.id] : []);
}

function googleEventBody(input: InterviewEventInput, role: CalendarRole) {
  return {
    summary: eventSummary(input, role),
    description: eventDescription(input),
    location: input.locationDetails ?? undefined,
    start: { dateTime: new Date(input.scheduledAt).toISOString(), timeZone: 'Europe/Stockholm' },
    end: { dateTime: endIso(input.scheduledAt, input.durationMinutes), timeZone: 'Europe/Stockholm' },
    iCalUID: icalUid(input.interviewId, role),
    reminders: { useDefault: true },
    extendedProperties: {
      private: {
        parium_interview_id: input.interviewId,
        parium_role: role,
      },
    },
  };
}

async function upsertGoogleEvent(connectionAPIKey: string, input: InterviewEventInput, role: CalendarRole) {
  const existingIds = await findGoogleEventIds(connectionAPIKey, input.interviewId, role);
  const existingId = existingIds[0];
  const path = existingId
    ? `/calendar/v3/calendars/primary/events/${encodeURIComponent(existingId)}`
    : '/calendar/v3/calendars/primary/events';
  const body = {
    ...googleEventBody(input, role),
  };
  return googleRequest(connectionAPIKey, path, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

async function deleteGoogleEvents(connectionAPIKey: string, interviewId: string, role: CalendarRole) {
  const eventIds = await findGoogleEventIds(connectionAPIKey, interviewId, role);
  for (const eventId of eventIds) {
    const res = await googleRequest(connectionAPIKey, `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok && res.status !== 404) return res;
  }
  return null;
}

async function outlookRequest(
  connectionAPIKey: string,
  path: string,
  init?: RequestInit,
) {
  return callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: 'microsoft_outlook',
    path,
    init,
    requiredScopes: scopesForConnector('microsoft_outlook'),
  });
}

async function outlookEventExists(connectionAPIKey: string, interviewId: string, role: CalendarRole): Promise<boolean> {
  const filter = `transactionId eq '${transactionId(interviewId, role)}'`;
  const res = await outlookRequest(connectionAPIKey, `/v1.0/me/events?$filter=${encodeURIComponent(filter)}&$top=1`, {
    method: 'GET',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => null) as { value?: unknown[] } | null;
  return (data?.value?.length ?? 0) > 0;
}

async function insertOutlookEvent(connectionAPIKey: string, input: InterviewEventInput, role: CalendarRole) {
  const htmlDescription = eventDescription(input).replace(/\n/g, '<br>');
  const body = {
    subject: eventSummary(input, role),
    transactionId: transactionId(input.interviewId, role),
    body: { contentType: 'HTML', content: htmlDescription },
    start: { dateTime: new Date(input.scheduledAt).toISOString(), timeZone: 'Europe/Stockholm' },
    end: { dateTime: endIso(input.scheduledAt, input.durationMinutes), timeZone: 'Europe/Stockholm' },
    location: input.locationDetails ? { displayName: input.locationDetails } : undefined,
    isReminderOn: true,
  };
  return outlookRequest(connectionAPIKey, '/v1.0/me/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

async function deleteOutlookEvents(connectionAPIKey: string, interviewId: string, role: CalendarRole) {
  const filter = `transactionId eq '${transactionId(interviewId, role)}'`;
  const res = await outlookRequest(connectionAPIKey, `/v1.0/me/events?$filter=${encodeURIComponent(filter)}&$top=10`, {
    method: 'GET',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return res;
  const data = await res.json().catch(() => null) as { value?: Array<{ id?: string }> } | null;
  for (const item of data?.value ?? []) {
    if (!item.id) continue;
    const deleteRes = await outlookRequest(connectionAPIKey, `/v1.0/me/events/${encodeURIComponent(item.id)}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!deleteRes.ok && deleteRes.status !== 404) return deleteRes;
  }
  return null;
}

export async function addInterviewToCalendar(
  userId: string,
  connectorId: SupportedConnector,
  input: InterviewEventInput,
  role: CalendarRole,
): Promise<CalendarSyncResult> {
  let connection;
  try {
    connection = await getConnectionForUser(userId, connectorId);
  } catch (error) {
    console.error('Kalender: kunde inte läsa koppling', error);
    return { status: 'skipped' };
  }
  if (!connection) return { status: 'not_connected' };

  try {
    const res = connectorId === 'google_calendar'
      ? await upsertGoogleEvent(connection.connectionAPIKey, input, role)
      : await (async () => {
          const exists = await outlookEventExists(connection.connectionAPIKey, input.interviewId, role);
          if (exists) {
            await deleteOutlookEvents(connection.connectionAPIKey, input.interviewId, role);
          }
          return insertOutlookEvent(connection.connectionAPIKey, input, role);
        })();

    if (await appUserReconnectRequired(res)) {
      return { status: 'not_connected', reconnectRequired: true };
    }
    if (!res.ok) {
      console.error(`Kalender: inläggning misslyckades [${res.status}]: ${(await res.text()).slice(0, 300)}`);
      return { status: 'skipped' };
    }
    return { status: 'connected' };
  } catch (error) {
    console.error('Kalender: oväntat fel vid inläggning', error);
    return { status: 'skipped' };
  }
}

export async function removeInterviewFromCalendar(
  userId: string,
  connectorId: SupportedConnector,
  interviewId: string,
  role: CalendarRole,
): Promise<CalendarSyncResult> {
  let connection;
  try {
    connection = await getConnectionForUser(userId, connectorId);
  } catch (error) {
    console.error('Kalender: kunde inte läsa koppling', error);
    return { status: 'skipped' };
  }
  if (!connection) return { status: 'not_connected' };

  try {
    const failedResponse = connectorId === 'google_calendar'
      ? await deleteGoogleEvents(connection.connectionAPIKey, interviewId, role)
      : await deleteOutlookEvents(connection.connectionAPIKey, interviewId, role);
    if (failedResponse && await appUserReconnectRequired(failedResponse)) {
      return { status: 'not_connected', reconnectRequired: true };
    }
    if (failedResponse) {
      console.error(`Kalender: borttagning misslyckades [${failedResponse.status}]: ${(await failedResponse.text()).slice(0, 300)}`);
      return { status: 'skipped' };
    }
    return { status: 'connected' };
  } catch (error) {
    console.error('Kalender: oväntat fel vid borttag', error);
    return { status: 'skipped' };
  }
}
