// Returnerar kopplingsstatus för den inloggade användaren: om kontot är
// kopplat och till vilken mejladress. Läser aldrig nyckeln i klartext till
// klienten — bara om den finns.

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { getConnectionForUser } from '../_shared/appUserConnections.ts';
import { clientApiKeyEnvName, SUPPORTED_CONNECTORS } from '../_shared/appUserScopes.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Sign in required', { status: 401, headers: corsHeaders });

  const connections: Record<string, {
    connected: boolean;
    email: string | null;
    reconnectRequired?: boolean;
    available: boolean;
  }> = {};
  for (const connectorId of SUPPORTED_CONNECTORS) {
    const available = Boolean(Deno.env.get(clientApiKeyEnvName(connectorId)));
    if (!available) {
      connections[connectorId] = { connected: false, email: null, available: false };
      continue;
    }
    try {
      const connection = await getConnectionForUser(user.id, connectorId);
      connections[connectorId] = connection
        ? { connected: true, email: connection.providerAccountEmail, available: true }
        : { connected: false, email: null, available: true };
    } catch (error) {
      console.error(`Kopplingsstatus misslyckades för ${connectorId}:`, error);
      connections[connectorId] = { connected: false, email: null, reconnectRequired: true, available: true };
    }
  }

  return Response.json({ connections }, { headers: corsHeaders });
});
