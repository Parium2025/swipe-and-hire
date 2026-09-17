import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { isCalendarConnector } from '@/lib/calendarConnection';

/**
 * Återvägssida för kalenderkopplingen. Leverantören skickar hit en engångs-
 * kod i popup-fönstret. Koden skickas vidare till fönstret som öppnade popupen
 * — där finns den inloggade sessionen — och växlas mot kopplingsnyckeln i en
 * serverfunktion. Aldrig en nyckel i webbläsaren.
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

    const post = (payload: Record<string, unknown>) => {
      window.opener?.postMessage({ connectorId, ...payload }, window.location.origin);
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get('success') !== 'true') {
      const reason = params.get('error') ?? 'Kopplingen kunde inte slutföras.';
      setMessage(reason);
      post({ type: 'appUserConnectorOAuthFailed', reason });
      window.close();
      return;
    }

    const code = params.get('code');
    if (!code) {
      const reason =
        'Kopplingen kan inte användas ännu: en administratör måste aktivera offline-åtkomst för kopplingsklienten.';
      setMessage(reason);
      post({ type: 'appUserConnectorOAuthFailed', reason });
      return;
    }

    post({ type: 'appUserConnectorOAuthCode', code });
    window.close();
  }, [connector]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <p className="text-base text-white text-center max-w-sm break-words">{message}</p>
    </div>
  );
}
