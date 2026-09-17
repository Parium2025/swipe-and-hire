// Startar per-användare OAuth mot kopplingsgatewayen (Google Calendar /
// Outlook). Kräver inloggad användare; appUserId hämtas alltid från den
// verifierade JWT:en, aldrig från request-body.

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { authorizeAppUserOAuth } from '../_shared/appUserConnector.ts';
import { getConnectionForUser } from '../_shared/appUserConnections.ts';
import {
  GATEWAY_BASE_URL,
  clientApiKeyEnvName,
  isSupportedConnector,
  scopesForConnector,
} from '../_shared/appUserScopes.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Sign in required', { status: 401, headers: corsHeaders });

  let body: { connector_id?: unknown; origin?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Ogiltig förfrågan' }, { status: 400, headers: corsHeaders });
  }

  const connectorId = body.connector_id;
  if (!isSupportedConnector(connectorId)) {
    return Response.json({ error: 'Kopplingen stöds inte' }, { status: 400, headers: corsHeaders });
  }

  const clientAPIKey = Deno.env.get(clientApiKeyEnvName(connectorId));
  if (!clientAPIKey) {
    return Response.json(
      { error: 'Kopplingsklienten är inte konfigurerad. En administratör måste koppla den först.' },
      { status: 500, headers: corsHeaders },
    );
  }

  const origin = typeof body.origin === 'string' ? body.origin : '';
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return Response.json({ error: 'Ogiltig ursprungsadress' }, { status: 400, headers: corsHeaders });
  }
  const returnUrl = new URL(`/oauth/${connectorId}/return`, originUrl).toString();

  // Återkoppling: skicka med sparad nyckel så gatewayen kan bekräfta ägarskap.
  let connectionAPIKey: string | undefined;
  try {
    const existing = await getConnectionForUser(user.id, connectorId);
    connectionAPIKey = existing?.connectionAPIKey;
  } catch {
    // Första kopplingen — ingen nyckel finns.
  }

  try {
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId,
      appUserId: user.id,
      clientAPIKey,
      returnUrl,
      connectionAPIKey,
      credentialsConfiguration: {
        scopes: scopesForConnector(connectorId),
      },
    });
    return Response.json({ authorizationUrl }, { headers: corsHeaders });
  } catch (error) {
    console.error('OAuth-start misslyckades:', error);
    return Response.json(
      { error: 'Kunde inte starta kopplingen. Försök igen.' },
      { status: 502, headers: corsHeaders },
    );
  }
});
