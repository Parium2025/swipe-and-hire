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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Check for Firebase credentials
    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
    
    if (!fcmServerKey) {
      console.log("FCM_SERVER_KEY not configured - push notifications disabled");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Push notifications not configured. FCM_SERVER_KEY is required.",
          hint: "Add FCM_SERVER_KEY secret to enable push notifications."
        }),
        { 
          status: 200, 
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

    // Send to all tokens (FCM handles both Android and iOS via Firebase)
    const results = await Promise.allSettled(
      tokens.map(async ({ token, platform }) => {
        const fcmPayload = {
          to: token,
          notification: {
            title,
            body,
            sound: "default",
            badge: 1,
          },
          data: {
            ...data,
            click_action: "FLUTTER_NOTIFICATION_CLICK",
          },
        };

        const response = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${fcmServerKey}`,
          },
          body: JSON.stringify(fcmPayload),
        });

        const result = await response.json();

        // Handle invalid/expired tokens
        if (result.failure > 0 && result.results?.[0]?.error) {
          const error = result.results[0].error;
          if (error === "NotRegistered" || error === "InvalidRegistration") {
            // Mark token as inactive
            await supabase
              .from("device_push_tokens")
              .update({ is_active: false })
              .eq("token", token);
            console.log(`Deactivated invalid token for ${platform}`);
          }
        }

        // Update last_used_at for successful sends
        if (result.success > 0) {
          await supabase
            .from("device_push_tokens")
            .update({ last_used_at: new Date().toISOString() })
            .eq("token", token);
        }

        return { platform, success: result.success > 0, result };
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
