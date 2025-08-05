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

interface ConfirmRequest {
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token }: ConfirmRequest = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ 
        error: "Token saknas" 
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // 1. Hitta bekräftelseposten
    const { data: confirmation, error: confirmError } = await supabase
      .from('email_confirmations')
      .select('*')
      .eq('token', token)
      .single();

    if (confirmError || !confirmation) {
      return new Response(JSON.stringify({ 
        error: "Ogiltig eller utgången bekräftelselänk" 
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // 2. Kontrollera om redan bekräftad
    if (confirmation.confirmed_at) {
      return new Response(JSON.stringify({ 
        error: "E-posten är redan bekräftad" 
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // 3. Kontrollera om utgången
    if (new Date(confirmation.expires_at) < new Date()) {
      // Ta bort utgången bekräftelse och användare
      await supabase.auth.admin.deleteUser(confirmation.user_id);
      await supabase
        .from('email_confirmations')
        .delete()
        .eq('id', confirmation.id);

      return new Response(JSON.stringify({ 
        error: "Bekräftelselänken har gått ut. Du kan registrera dig igen med samma e-postadress." 
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // 4. Bekräfta e-posten
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      confirmation.user_id,
      { email_confirm: true }
    );

    if (updateError) {
      console.error('Error confirming user:', updateError);
      throw new Error('Fel vid bekräftelse av e-post');
    }

    // 5. Markera bekräftelsen som klar
    await supabase
      .from('email_confirmations')
      .update({ confirmed_at: new Date().toISOString() })
      .eq('id', confirmation.id);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "E-post bekräftad! Du kan nu logga in.",
      email: confirmation.email
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in confirm-email:", error);
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