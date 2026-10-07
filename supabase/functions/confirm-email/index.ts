import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const ConfirmSchema = z.object({ token: z.string().min(20).max(200) });

// The caller has already confirmed this user through Auth before provisioning.
const provisionEmployerWorkspace = async (userId: string): Promise<void> => {
  const { data, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authError || !data.user?.email_confirmed_at || !data.user.email) throw new Error('Confirmed account required');
  const { error } = await supabase.rpc('provision_confirmed_employer_workspace', {
    p_user_id: userId, p_email: data.user.email,
  });
  if (error) throw error;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const parsed = ConfirmSchema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: "Ogiltig bekräftelselänk." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { token } = parsed.data;

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
      // Idempotent: ser till att en arbetsgivare alltid får sin organisation
      // och admin-roll, även om ett tidigare försök avbröts.
      await provisionEmployerWorkspace(confirmation.user_id);
      return new Response(JSON.stringify({ 
        success: true,
        alreadyConfirmed: true,
        message: "Ditt konto är redan aktiverat. Du kan logga in direkt."
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // 3. Kontrollera utgångstid (24h) — leaked/gamla länkar ska inte fungera
    if (confirmation.expires_at && new Date(confirmation.expires_at) < new Date()) {
      return new Response(JSON.stringify({
        error: "Bekräftelselänken har gått ut. Begär en ny bekräftelselänk.",
        expired: true,
      }), {
        status: 410,
        headers: { "Content-Type": "application/json", ...corsHeaders },
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

    // 6. Arbetsgivare: organisation + admin-roll skapas nu, inte tidigare
    await provisionEmployerWorkspace(confirmation.user_id);

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
      JSON.stringify({ error: "Kunde inte bekräfta e-postadressen just nu." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);