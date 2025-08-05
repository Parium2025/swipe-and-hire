import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { Resend } from "npm:resend@2.0.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SignupRequest {
  email: string;
  password: string;
  data?: any;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, data }: SignupRequest = await req.json();

    // 1. Skapa användare utan bekräftelse
    const { data: user, error: signupError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Vi hanterar bekräftelse manuellt
      user_metadata: data || {}
    });

    if (signupError) {
      throw new Error(signupError.message);
    }

    // 2. Skapa bekräftelsetoken
    const confirmationToken = crypto.randomUUID();
    
    // 3. Spara token i databasen (du kan skapa en tabell för detta)
    // För nu: skicka e-post direkt
    
    const confirmationUrl = `${req.headers.get('origin')}/auth?confirm=${confirmationToken}&email=${encodeURIComponent(email)}`;

    // 4. Skicka bekräftelsemejl via Resend
    const emailResponse = await resend.emails.send({
      from: "Parium <noreply@parium.se>",
      to: [email],
      subject: "Välkommen till Parium - Bekräfta din e-post",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a237e;">Välkommen till Parium!</h1>
          <p>Tack för att du registrerade dig. Klicka på länken nedan för att bekräfta din e-postadress:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${confirmationUrl}" 
               style="background-color: #1a237e; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Bekräfta e-post
            </a>
          </div>
          <p>Om knappen inte fungerar, kopiera denna länk: ${confirmationUrl}</p>
        </div>
      `,
    });

    console.log("Custom signup email sent:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Användare skapad. Kolla din e-post för bekräftelse.",
      user: user.user
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in custom-signup:", error);
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