// Kopplar från kalenderkontot: meddelar gatewayen och raderar den krypterade
// nyckeln. Kräver inloggad användare.

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { disconnectAppUser } from '../_shared/appUserConnector.ts';
import { deleteConnectionForUser, getConnectionForUser } from '../_shared/appUserConnections.ts';
import { GATEWAY_BASE_URL, isSupportedConnector } from '../_shared/appUserScopes.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Sign in required', { status: 401, headers: corsHeaders });

  let body: { connector_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Ogiltig förfrågan' }, { status: 400, headers: corsHeaders });
  }
  const connectorId = body.connector_id;
  if (!isSupportedConnector(connectorId)) {
    return Response.json({ error: 'Kopplingen stöds inte' }, { status: 400, headers: corsHeaders });
  }

  const connection = await getConnectionForUser(user.id, connectorId);
  if (!connection) return Response.json({ ok: true }, { headers: corsHeaders });

  try {
    await disconnectAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey: connection.connectionAPIKey,
      connectorId,
    });
  } catch (error) {
    console.error('Frånkoppling hos gatewayen misslyckades:', error);
    // Radera ändå lokalt — utan lokal nyckel kan kopplingen inte användas.
  }
  await deleteConnectionForUser(user.id, connectorId);

  return Response.json({ ok: true }, { headers: corsHeaders });
});
