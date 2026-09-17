import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { isCalendarConnector } from '@/lib/calendarConnection';

/**
 * Återvägssida för kalenderkopplingen. Leverantören skickar hit en engångs-
 * kod i popup-fönstret; koden byts mot en kopplingsnyckel i en serverfunktion
 * och sparas krypterat. Aldrig en nyckel i webbläsaren — bara en signal till
 * fönstret som öppnade popupen.
 */
export default function OAuthReturn() {
  const { connector } = useParams<{ connector: string }>();
  const [message, setMessage] = useState('Slutför kopplingen …');

  useEffect(() => {
    if (!isCalendarConnector(connector)) {
      setMessage('Kopplingen stöds inte.');
      return;
    }
    const connectorId = connector;

    const notifyOpenerAndClose = (
      type: 'appUserConnectorOAuthComplete' | 'appUserConnectorOAuthFailed',
      reason?: string,
    ) => {
      window.opener?.postMessage(
        { type, connectorId, ...(reason ? { reason } : {}) },
        window.location.origin,
      );
      window.close();
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get('success') !== 'true') {
      setMessage(params.get('error') ?? 'Kopplingen kunde inte slutföras.');
      notifyOpenerAndClose('appUserConnectorOAuthFailed', params.get('error') ?? undefined);
      return;
    }

    const code = params.get('code');
    if (!code) {
      const reason =
        'Kopplingen kan inte användas ännu: en administratör måste aktivera offline-åtkomst för kopplingsklienten.';
      setMessage(reason);
      window.opener?.postMessage(
        { type: 'appUserConnectorOAuthFailed', connectorId, reason },
        window.location.origin,
      );
      return;
    }

    void supabase.functions
      .invoke('app-user-oauth-complete', { body: { code } })
      .then(({ error }) => {
        if (error) throw error;
        notifyOpenerAndClose('appUserConnectorOAuthComplete');
      })
      .catch(() => {
        const reason = 'Kunde inte slutföra kopplingen. Försök igen.';
        setMessage(reason);
        notifyOpenerAndClose('appUserConnectorOAuthFailed', reason);
      });
  }, [connector]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <p className="text-base text-white text-center max-w-sm break-words">{message}</p>
    </div>
  );
}
