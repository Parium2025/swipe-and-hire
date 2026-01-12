import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationPayload {
  recipient_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

// Cache for access token
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get OAuth2 access token for FCM HTTP v1 API
 * Uses Service Account credentials with JWT assertion
 */
async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  // Return cached token if still valid (with 5 minute buffer)
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 300000) {
    return cachedAccessToken;
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // Token valid for 1 hour

  // Create JWT header
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  // Create JWT claim set
  const claimSet = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: credentials.token_uri,
    iat: now,
    exp: exp,
  };

  // Base64URL encode
  const base64UrlEncode = (obj: object): string => {
    const json = JSON.stringify(obj);
    const base64 = btoa(json);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const headerB64 = base64UrlEncode(header);
  const claimSetB64 = base64UrlEncode(claimSet);
  const signatureInput = `${headerB64}.${claimSetB64}`;

  // Import the private key and sign
  const privateKeyPem = credentials.private_key;
  const pemContents = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${signatureInput}.${signature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch(credentials.token_uri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  cachedAccessToken = tokenData.access_token;
  tokenExpiresAt = Date.now() + (tokenData.expires_in * 1000);

  return cachedAccessToken!;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Check for Firebase Service Account credentials (FCM HTTP v1)
    const fcmServiceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT");
    
    if (!fcmServiceAccountJson) {
      console.log("FCM_SERVICE_ACCOUNT not configured - push notifications disabled");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Push notifications not configured. FCM_SERVICE_ACCOUNT is required.",
          hint: "Add FCM_SERVICE_ACCOUNT secret (Service Account JSON) to enable push notifications."
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    let credentials: ServiceAccountCredentials;
    try {
      credentials = JSON.parse(fcmServiceAccountJson);
    } catch (e) {
      console.error("Invalid FCM_SERVICE_ACCOUNT JSON:", e);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid FCM_SERVICE_ACCOUNT format. Must be valid JSON."
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: PushNotificationPayload = await req.json();
    const { recipient_id, title, body, data } = payload;

    if (!recipient_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: "recipient_id, title, and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all active push tokens for the recipient
    const { data: tokens, error: tokensError } = await supabase
      .from("device_push_tokens")
      .select("token, platform")
      .eq("user_id", recipient_id)
      .eq("is_active", true);

    if (tokensError) {
      console.error("Error fetching tokens:", tokensError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch push tokens" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log(`No active push tokens found for user ${recipient_id}`);
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No active tokens" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending push to ${tokens.length} devices for user ${recipient_id}`);

    // Get OAuth2 access token for FCM HTTP v1
    const accessToken = await getAccessToken(credentials);
    const projectId = credentials.project_id;

    // Send to all tokens using FCM HTTP v1 API
    const results = await Promise.allSettled(
      tokens.map(async ({ token, platform }) => {
        const fcmPayload = {
          message: {
            token: token,
            notification: {
              title,
              body,
            },
            android: {
              priority: "high",
              notification: {
                sound: "default",
                default_sound: true,
                default_vibrate_timings: true,
              },
            },
            apns: {
              payload: {
                aps: {
                  sound: "default",
                  badge: 1,
                },
              },
            },
            data: data || {},
          },
        };

        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(fcmPayload),
          }
        );

        const result = await response.json();

        // Handle invalid/expired tokens (FCM v1 error format)
        if (!response.ok) {
          const errorCode = result.error?.details?.[0]?.errorCode;
          if (errorCode === "UNREGISTERED" || errorCode === "INVALID_ARGUMENT") {
            // Mark token as inactive
            await supabase
              .from("device_push_tokens")
              .update({ is_active: false })
              .eq("token", token);
            console.log(`Deactivated invalid token for ${platform}: ${errorCode}`);
          }
          return { platform, success: false, error: result.error };
        }

        // Update last_used_at for successful sends
        await supabase
          .from("device_push_tokens")
          .update({ last_used_at: new Date().toISOString() })
          .eq("token", token);

        return { platform, success: true, messageId: result.name };
      })
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    console.log(`Push notifications sent: ${successful}/${tokens.length}`);

    return new Response(
      JSON.stringify({ success: true, sent: successful, total: tokens.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Push notification error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
