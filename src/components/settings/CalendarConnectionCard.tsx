import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import {
  CALENDAR_CONNECTORS,
  CalendarStatusMap,
  connectCalendar,
  disconnectCalendar,
  fetchCalendarStatus,
} from '@/lib/calendarConnection';
import { Button } from '@/components/ui/button';

/**
 * Kopplingskort för kalender (Google Calendar / Outlook Calendar). Används i
 * både arbetsgivarens inställningar och jobbsökarens profil. Efter koppling
 * läggs intervjuer automatiskt in i användarens egen kalender — alla andra
 * får alltid "Lägg till i kalender"-knappen i mejlet.
 */
const CalendarConnectionCard = () => {
  const [status, setStatus] = useState<CalendarStatusMap | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await fetchCalendarStatus());
    } catch (error) {
      setStatus({
        google_calendar: { connected: false, email: null, available: false },
        microsoft_outlook: { connected: false, email: null, available: false },
      });
      toast({
        title: 'Kunde inte hämta kopplingsstatus',
        description: error instanceof Error ? error.message : 'Försök igen.',
        variant: 'destructive',
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConnect = async (connectorId: (typeof CALENDAR_CONNECTORS)[number]['id']) => {
    setBusy(connectorId);
    try {
      await connectCalendar(connectorId);
      await load();
      const name = CALENDAR_CONNECTORS.find((c) => c.id === connectorId)?.name ?? 'Kalendern';
      toast({
        title: `Kopplad till ${name}`,
        description: 'Intervjuer läggs nu in automatiskt i din kalender.',
      });
    } catch (error) {
      toast({
        title: 'Kopplingen misslyckades',
        description: error instanceof Error ? error.message : 'Försök igen.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async (connectorId: (typeof CALENDAR_CONNECTORS)[number]['id']) => {
    setBusy(connectorId);
    try {
      await disconnectCalendar(connectorId);
      await load();
      toast({ title: 'Kopplingen är borttagen' });
    } catch (error) {
      toast({
        title: 'Kunde inte koppla från',
        description: error instanceof Error ? error.message : 'Försök igen.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm px-6 md:px-4 py-4">
      <h3 className="text-sm font-semibold text-white">Kalender</h3>
      <p className="mt-1 text-sm text-white break-words">
        Koppla din kalender så läggs bokade intervjuer in automatiskt. Alla intervjuer kan
        fortfarande läggas till med ett klick via mejlet, oavsett kalender.
      </p>

      <div className="mt-4 space-y-3">
        {CALENDAR_CONNECTORS.map((connector) => {
          const connection = status?.[connector.id];
          const connecting = busy === connector.id;
          const unavailable = status !== null && connection?.available === false;
          return (
            <div
              key={connector.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{connector.name}</p>
                <p className="mt-0.5 text-xs text-white break-words">
                  {!status
                    ? 'Kontrollerar …'
                    : connection?.connected
                      ? `Kopplad${connection.email ? ` som ${connection.email}` : ''}`
                      : connection?.reconnectRequired
                        ? 'Kopplingen behöver förnyas.'
                        : unavailable
                          ? 'Inte tillgänglig ännu.'
                        : 'Inte kopplad.'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {connection?.connected ? (
                  <>
                    <Button
                      size="sm"
                      variant="outlineNeutral"
                      disabled={connecting}
                      onClick={() => void handleConnect(connector.id)}
                      className="min-w-[104px] justify-center rounded-full border-white/20 bg-transparent text-white"
                    >
                      {connecting ? 'Kopplar …' : 'Byt konto'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outlineNeutral"
                      disabled={connecting}
                      onClick={() => void handleDisconnect(connector.id)}
                      className="min-w-[104px] justify-center rounded-full border-white/20 bg-transparent text-white"
                    >
                      {connecting ? 'Kopplar från …' : 'Koppla från'}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outlineNeutral"
                    disabled={connecting || !status || unavailable}
                    onClick={() => void handleConnect(connector.id)}
                    className="min-w-[104px] justify-center rounded-full border-white/20 bg-transparent text-white"
                  >
                    {connecting
                      ? 'Kopplar …'
                      : unavailable
                        ? 'Ej tillgänglig'
                        : connection?.reconnectRequired
                          ? 'Förnya koppling'
                          : 'Koppla'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarConnectionCard;
