// Delad FCM-klient för köade pushnotiser.
//
// send-push-notification skickar EN notis per anrop och gör alla kontroller
// (blockeringar, behörighet, inställningar) själv. Den lämnas orörd.
// Den här modulen används av köarbetaren, som behöver skicka tusentals
// notiser i samma körning med EN access token och ETT tokenuppslag.

export interface ServiceAccountCredentials {
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri: string;
}

let cachedToken: string | null = null;
let cachedTokenExpiresAt = 0;

const base64UrlEncode = (obj: object): string =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** OAuth2-token för FCM HTTP v1. Cachas tills fem minuter före utgång. */
export async function getFcmAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 300_000) return cachedToken;

  const now = Math.floor(Date.now() / 1000);
  const headerB64 = base64UrlEncode({ alg: 'RS256', typ: 'JWT' });
  const claimB64 = base64UrlEncode({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: credentials.token_uri,
    iat: now,
    exp: now + 3600,
  });
  const signatureInput = `${headerB64}.${claimB64}`;

  const pemContents = credentials.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput),
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(credentials.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signatureInput}.${signature}`,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Failed to get FCM access token: ${await response.text()}`);
  }

  const tokenData = await response.json();
  cachedToken = tokenData.access_token as string;
  cachedTokenExpiresAt = Date.now() + tokenData.expires_in * 1000;
  return cachedToken;
}

export interface FcmSendResult {
  ok: boolean;
  /** Satt när token är ogiltig och bör avaktiveras. */
  unregistered: boolean;
  error?: string;
}

/** Skickar en notis till EN enhetstoken. */
export async function sendFcmMessage(
  accessToken: string,
  projectId: string,
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<FcmSendResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title, body },
            android: {
              priority: 'high',
              notification: { sound: 'default', default_sound: true, default_vibrate_timings: true },
            },
            apns: { payload: { aps: { sound: 'default', badge: 1 } } },
            data,
          },
        }),
        signal: controller.signal,
      },
    );

    if (response.ok) return { ok: true, unregistered: false };

    const result = await response.json().catch(() => ({}));
    const errorCode = result?.error?.details?.[0]?.errorCode;
    return {
      ok: false,
      unregistered: errorCode === 'UNREGISTERED' || errorCode === 'INVALID_ARGUMENT',
      error: result?.error?.message ?? `HTTP ${response.status}`,
    };
  } catch (err) {
    return { ok: false, unregistered: false, error: err instanceof Error ? err.message : 'fetch failed' };
  } finally {
    clearTimeout(timeoutId);
  }
}
