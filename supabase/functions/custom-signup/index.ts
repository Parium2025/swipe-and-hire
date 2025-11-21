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
    
    const firstName = data?.first_name || 'där';
    const isEmployer = data?.role === 'employer';
    const companyName = data?.company_name || 'Ditt företag';

    console.log(`Attempting signup for email: ${email}`);

    // 1. Kontrollera om användaren redan finns och är bekräftad
    try {
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      
      if (!listError && listData?.users) {
        const existingUser = listData.users.find(u => u.email === email);
        
        if (existingUser) {
          // Kontrollera om användaren är bekräftad
          if (existingUser.email_confirmed_at) {
            console.log(`User ${email} already exists and is confirmed`);
            return new Response(JSON.stringify({ 
              success: false,
              error: "Hoppsan! Den här adressen är redan registrerad.",
              message: `Det ser ut som att du redan har ett konto med ${email}.\nLogga gärna in – eller återställ lösenordet om du har glömt det.`,
              isExistingUser: true
            }), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            });
          } else {
            // Användaren finns men är inte bekräftad - ta bort och skapa ny
            console.log(`Found existing unconfirmed user ${existingUser.id}, deleting first...`);
            
            // Ta bort från relaterade tabeller
            await supabase.from('email_confirmations').delete().eq('user_id', existingUser.id);
            await supabase.from('profiles').delete().eq('user_id', existingUser.id);
            await supabase.from('user_roles').delete().eq('user_id', existingUser.id);
            
            // Ta bort användaren
            await supabase.auth.admin.deleteUser(existingUser.id);
            console.log('Existing unconfirmed user deleted successfully');
          }
        }
      }
    } catch (cleanupError) {
      console.error('Cleanup error (continuing anyway):', cleanupError);
    }

    // 2. Skapa användare utan automatisk bekräftelse
    const { data: user, error: signupError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Användaren måste bekräfta via mejl
      user_metadata: data || {}
    });

    console.log('Signup result:', { userId: user?.user?.id, error: signupError?.message });

    if (signupError) {
      console.error('Signup error details:', signupError);
      
      // Handle existing user case (fallback)
      if (signupError.message.includes("already been registered") || 
          signupError.message.includes("User already registered") ||
          signupError.message.includes("email_exists")) {
        
        return new Response(JSON.stringify({ 
          error: "E-post redan registrerad. Vänta en minut och försök igen, eller använd en annan e-postadress." 
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }
      throw new Error(signupError.message);
    }

    // 3. Skapa bekräftelsetoken och spara i databasen
    const confirmationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 timmars giltighet

    const { error: tokenError } = await supabase
      .from('email_confirmations')
      .insert({
        user_id: user.user.id,
        token: confirmationToken,
        expires_at: expiresAt.toISOString()
      });

    if (tokenError) {
      console.error('Error creating confirmation token:', tokenError);
      throw new Error('Failed to create confirmation token');
    }

    // 4. Bygg bekräftelse-URL direkt mot frontend-appens email-confirm-sida
    const redirectEnv = Deno.env.get("REDIRECT_URL") || "";
    const defaultAppUrl = "https://swipe-and-hire.lovable.app";

    // Om REDIRECT_URL är satt till en full URL och inte är en Supabase-domän, använd den
    let appBase = defaultAppUrl;
    if (redirectEnv && redirectEnv.startsWith("http")) {
      appBase = redirectEnv.includes("supabase.co") ? defaultAppUrl : redirectEnv;
    }


    const confirmationUrl = `${appBase}/email-confirm?confirm=${confirmationToken}`;
    
    console.log(`Sending confirmation email to ${email}`);

    // 5. Anropa send-confirmation-email Edge Function via backendens SUPABASE_URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-confirmation-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
      },
      body: JSON.stringify({
        email,
        role: data?.role || 'job_seeker',
        first_name: firstName,
        confirmation_url: confirmationUrl
      })
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Error sending confirmation email:', errorText);
      throw new Error('Failed to send confirmation email');
    }

    console.log("Confirmation email sent successfully");

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Konto skapat! Kolla din e-post för att bekräfta ditt konto.",
      user: user.user,
      needsConfirmation: true
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