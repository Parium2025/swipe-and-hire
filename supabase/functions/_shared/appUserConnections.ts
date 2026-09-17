// Server-only. Lagra och hämta krypterade kopplingsnycklar per inloggad
// användare och kopplingstyp. Används bara från edge-funktioner med
// service-roll-klient.

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { encryptConnectionKey, decryptConnectionKey } from './connectionKeyCrypto.ts';

export interface StoredConnection {
  connectionAPIKey: string;
  providerAccountEmail: string | null;
  connectedAt: string;
}

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

export async function saveConnectionKeyForUser(
  userId: string,
  connectorId: string,
  connectionAPIKey: string,
  providerAccountEmail?: string | null,
): Promise<void> {
  const { error } = await adminClient().from('app_user_connections').upsert(
    {
      user_id: userId,
      connector_id: connectorId,
      connection_key_ciphertext: await encryptConnectionKey(connectionAPIKey),
      provider_account_email: providerAccountEmail ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,connector_id' },
  );
  if (error) throw error;
}

export async function getConnectionForUser(
  userId: string,
  connectorId: string,
): Promise<StoredConnection | null> {
  const { data, error } = await adminClient()
    .from('app_user_connections')
    .select('connection_key_ciphertext, provider_account_email, updated_at')
    .eq('user_id', userId)
    .eq('connector_id', connectorId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    connectionAPIKey: await decryptConnectionKey(data.connection_key_ciphertext),
    providerAccountEmail: data.provider_account_email ?? null,
    connectedAt: data.updated_at,
  };
}

export async function deleteConnectionForUser(userId: string, connectorId: string): Promise<void> {
  const { error } = await adminClient()
    .from('app_user_connections')
    .delete()
    .eq('user_id', userId)
    .eq('connector_id', connectorId);
  if (error) throw error;
}

export async function hasConnection(userId: string, connectorId: string): Promise<boolean> {
  const { count, error } = await adminClient()
    .from('app_user_connections')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('connector_id', connectorId)
    .limit(1);
  if (error) throw error;
  return (count ?? 0) > 0;
}
