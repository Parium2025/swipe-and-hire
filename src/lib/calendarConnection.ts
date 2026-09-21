import { supabase } from '@/integrations/supabase/client';

export type CalendarConnector = 'google_calendar' | 'microsoft_outlook';

export interface CalendarConnectionStatus {
  connected: boolean;
  email: string | null;
  reconnectRequired?: boolean;
  available?: boolean;
}

export type CalendarStatusMap = Record<CalendarConnector, CalendarConnectionStatus>;

export const CALENDAR_CONNECTORS: { id: CalendarConnector; name: string }[] = [
  { id: 'google_calendar', name: 'Google Calendar' },
  { id: 'microsoft_outlook', name: 'Outlook Calendar' },
];

export const isCalendarConnector = (value: unknown): value is CalendarConnector =>
  value === 'google_calendar' || value === 'microsoft_outlook';

// Senast kända status för den här fliken. Kortet visar den direkt vid
// öppning och hämtar färsk status tyst i bakgrunden, så rutan aldrig är tom.
let cachedCalendarStatus: CalendarStatusMap | null = null;

export const getCachedCalendarStatus = (): CalendarStatusMap | null => cachedCalendarStatus;

export const clearCachedCalendarStatus = () => {
  cachedCalendarStatus = null;
};

export async function fetchCalendarStatus(): Promise<CalendarStatusMap> {
  const { data, error } = await supabase.functions.invoke('app-user-connection-status');
  if (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`Kunde inte hämta kopplingsstatus. ${details}`);
  }
  const connections = (data?.connections ?? {}) as Record<string, CalendarConnectionStatus>;
  const status: CalendarStatusMap = {
    google_calendar: connections.google_calendar ?? { connected: false, email: null, available: false },
    microsoft_outlook: connections.microsoft_outlook ?? { connected: false, email: null, available: false },
  };
  cachedCalendarStatus = status;
  return status;
}


function waitForOAuthCompletion(popup: Window, connectorId: CalendarConnector) {
  return new Promise<void>((resolve, reject) => {
    let poll: number | undefined;
    let exchanging = false;
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.data?.connectorId !== connectorId ||
        (type !== 'appUserConnectorOAuthComplete' &&
          type !== 'appUserConnectorOAuthCode' &&
          type !== 'appUserConnectorOAuthFailed')
      ) return;
      if (type === 'appUserConnectorOAuthCode') {
        // Koden växlas här, i fönstret som har den inloggade sessionen.
        cleanup();
        exchanging = true;
        void supabase.functions
          .invoke('app-user-oauth-complete', { body: { code: event.data.code } })
          .then(async ({ error }) => {
            if (error) {
              const details = FunctionsHttpErrorLike(error) ? await readErrorDetails(error) : '';
              throw new Error(details || 'Kunde inte slutföra kopplingen. Försök igen.');
            }
            resolve();
          })
          .catch((err) => reject(err instanceof Error ? err : new Error('Kunde inte slutföra kopplingen.')));
        return;
      }
      cleanup();
      if (type === 'appUserConnectorOAuthComplete') {
        resolve();
        return;
      }
      popup.close();
      reject(new Error(event.data?.reason ?? 'Kopplingen kunde inte slutföras.'));
    };
    window.addEventListener('message', onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed || exchanging) return;
      cleanup();
      reject(new Error('Fönstret stängdes innan kopplingen var klar.'));
    }, 500);
  });
}

/** Öppnar leverantörens samtyckessida i popup och slutför kopplingen. */
export async function connectCalendar(connectorId: CalendarConnector): Promise<void> {
  // Popupen öppnas synkront i klicket så att webbläsaren inte blockerar den
  // när svaret från start-funktionen kommer tillbaka.
  const popup = window.open('', 'lovable-oauth', 'width=600,height=720');
  if (!popup) throw new Error('Popup blockerad. Tillåt popup-fönster och försök igen.');
  try {
    const { data, error } = await supabase.functions.invoke('app-user-oauth-start', {
      body: { origin: window.location.origin, connector_id: connectorId },
    });
    if (error) {
      const details = error instanceof FunctionsHttpErrorLike ? await readErrorDetails(error) : error.message;
      throw new Error(details || 'Kunde inte starta kopplingen.');
    }
    if (!data?.authorizationUrl) throw new Error('Kunde inte starta kopplingen.');
    const completion = waitForOAuthCompletion(popup, connectorId);
    popup.location.href = data.authorizationUrl as string;
    await completion;
  } catch (err) {
    if (!popup.closed) popup.close();
    throw err instanceof Error ? err : new Error('Kopplingen kunde inte slutföras.');
  }
}

const FunctionsHttpErrorLike = (value: unknown): value is { context: { text: () => Promise<string> } } =>
  typeof value === 'object' && value !== null && 'context' in value;

async function readErrorDetails(error: unknown): Promise<string> {
  try {
    const text = await (error as { context: { text: () => Promise<string> } }).context.text();
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error ?? '';
  } catch {
    return '';
  }
}

export async function disconnectCalendar(connectorId: CalendarConnector): Promise<void> {
  const { error } = await supabase.functions.invoke('app-user-oauth-disconnect', {
    body: { connector_id: connectorId },
  });
  if (error) {
    const details = error instanceof FunctionsHttpErrorLike ? await readErrorDetails(error) : error.message;
    throw new Error(details || 'Kunde inte koppla från.');
  }
}
