// Tar emot engångskoden från återvägsidan, byter den mot kopplingsnyckeln
// och sparar den krypterat per inloggad användare. Kräver inloggad användare.

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { exchangeAppUserOAuthCode } from '../_shared/appUserConnector.ts';
import { saveConnectionKeyForUser } from '../_shared/appUserConnections.ts';
import { GATEWAY_BASE_URL, isSupportedConnector, scopesForConnector } from '../_shared/appUserScopes.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('OAuth-klar: ingen inloggad användare i förfrågan');
    return new Response('Sign in required', { status: 401, headers: corsHeaders });
  }

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Ogiltig förfrågan' }, { status: 400, headers: corsHeaders });
  }
  const code = typeof body.code === 'string' ? body.code : '';
  if (!code) {
    return Response.json({ error: 'Koden saknas' }, { status: 400, headers: corsHeaders });
  }

  try {
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, code);
    if (!isSupportedConnector(connectorId)) {
      return Response.json({ error: 'Kopplingen stöds inte' }, { status: 400, headers: corsHeaders });
    }

    // Hämta kontots mejladress så gränssnittet kan visa "Kopplad som …".
    // Misslyckas det är kopplingen ändå giltig — mejladressen är valfri.
    let providerAccountEmail: string | null = null;
    try {
      const probe = await fetch(`${GATEWAY_BASE_URL}/${connectorId}${connectorId === 'google_calendar' ? '/calendar/v3/calendars/primary' : '/v1.0/me'}`, {
        headers: {
          Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')!}`,
          'X-Connection-Api-Key': connectionAPIKey,
          'X-Lovable-Required-Scopes': scopesForConnector(connectorId).join(' '),
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (probe.ok) {
        const data = await probe.json();
        providerAccountEmail = connectorId === 'google_calendar' ? (data?.id ?? null) : (data?.mail ?? data?.userPrincipalName ?? null);
        if (typeof providerAccountEmail !== 'string') providerAccountEmail = null;
      }
    } catch (error) {
      console.error('Kunde inte hämta kalenderkontots mejladress:', error);
    }

    await saveConnectionKeyForUser(user.id, connectorId, connectionAPIKey, providerAccountEmail);
    return Response.json({ ok: true, connectorId }, { headers: corsHeaders });
  } catch (error) {
    console.error('OAuth-klar misslyckades:', error);
    return Response.json(
      { error: 'Kunde inte slutföra kopplingen. Försök igen.' },
      { status: 502, headers: corsHeaders },
    );
  }
});
