import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Hämta utgångna bekräftelser
    const { data: expiredConfirmations, error: fetchError } = await supabase
      .from('email_confirmations')
      .select('user_id')
      .lt('expires_at', new Date().toISOString())
      .is('confirmed_at', null);

    if (fetchError) {
      console.error('Error fetching expired confirmations:', fetchError);
      throw fetchError;
    }

    if (expiredConfirmations && expiredConfirmations.length > 0) {
      console.log(`Found ${expiredConfirmations.length} expired confirmations to clean up`);

      // Ta bort obekräftade användare
      for (const confirmation of expiredConfirmations) {
        try {
          await supabase.auth.admin.deleteUser(confirmation.user_id);
          console.log(`Deleted user: ${confirmation.user_id}`);
        } catch (error) {
          console.error(`Error deleting user ${confirmation.user_id}:`, error);
        }
      }

      // Ta bort utgångna bekräftelser
      const { error: deleteError } = await supabase
        .from('email_confirmations')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .is('confirmed_at', null);

      if (deleteError) {
        console.error('Error deleting expired confirmations:', deleteError);
        throw deleteError;
      }

      console.log('Cleanup completed successfully');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Cleaned up ${expiredConfirmations?.length || 0} expired confirmations`
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in cleanup function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);