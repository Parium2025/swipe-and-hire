import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

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

// Arbetsgivare: organisation + admin-roll skapas först när e-posten är
// bekräftad — aldrig vid själva registreringen. Annars kunde vem som helst
// registrera en obekräftad adress och direkt få arbetsgivarbehörighet.
const provisionEmployerWorkspace = async (userId: string): Promise<void> => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_name')
      .eq('user_id', userId)
      .maybeSingle();

    if (profile?.role !== 'employer') return;

    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (existingRole) return;

    const orgName = (profile.company_name || '').trim() || 'Min organisation';
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgName })
      .select('id')
      .single();
    if (orgError || !org) {
      console.error('Failed to create employer organization:', orgError);
      return;
    }

    await supabase.from('user_roles').insert({
      user_id: userId,
      role: 'admin',
      organization_id: org.id,
      is_active: true,
    });
    await supabase.from('profiles').update({ organization_id: org.id }).eq('user_id', userId);
  } catch (e) {
    console.error('provisionEmployerWorkspace failed:', e);
  }
};

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