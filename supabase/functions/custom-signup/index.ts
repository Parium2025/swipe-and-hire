import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";
import { enforceRateLimit, normalizeEmail, requestIp } from "../_shared/rate-limit.ts";
import { findUserByEmail } from "../_shared/find-user.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);


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
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return new Response(JSON.stringify({ error: "E-post och lösenord krävs" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const rateLimitResponse = await enforceRateLimit(
      supabase,
      "custom-signup",
      [
        { scope: "email", identifier: normalizedEmail, limit: 3, windowSeconds: 60 * 60 },
        { scope: "ip", identifier: requestIp(req), limit: 10, windowSeconds: 60 * 60 },
      ],
      corsHeaders,
    );
    if (rateLimitResponse) return rateLimitResponse;
    
    const firstName = data?.first_name || 'där';
    const isEmployer = data?.role === 'employer';
    const companyName = data?.company_name || 'Ditt företag';

    console.log("Attempting signup", { role: data?.role === "employer" ? "employer" : "job_seeker" });

    // 1. Kontrollera om användaren redan finns och är bekräftad
    try {
      const existingUser = await findUserByEmail(supabase, normalizedEmail);

      {
        if (existingUser) {
          // Kontrollera om användaren är bekräftad
          if (existingUser.email_confirmed_at) {
            console.log("Signup target already exists and is confirmed");
            // Generic response — do NOT reveal that this specific email is registered.
            // Mirrors resend-confirmation / send-reset-password to prevent enumeration.
            return new Response(JSON.stringify({
              success: true,
              message: "Om adressen är giltig har vi skickat ett mejl med nästa steg.",
              needsConfirmation: true
            }), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            });

          } else {
            // Användaren finns men är inte bekräftad - ta bort och skapa ny
            console.log('Found existing unconfirmed signup, deleting first');
            
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

    // Rensa ev. gammal spärr från en tidigare kontoradering — annars blockeras
    // bekräftelsemejlet och personen kan aldrig verifiera sitt nya konto.
    try {
      await supabase
        .from('suppressed_emails')
        .delete()
        .eq('email', normalizedEmail)
        .eq('reason', 'account_deleted');
    } catch (e) {
      console.warn('suppression cleanup failed (continuing):', (e as Error).message);
    }

    // 2. Skapa användare utan automatisk bekräftelse
    const { data: user, error: signupError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: false, // Användaren måste bekräfta via mejl
      user_metadata: data || {}
    });

    console.log('Signup result:', { hasUser: !!user?.user?.id, error: signupError?.message });

    if (signupError) {
      console.error('Signup error details:', signupError);
      
      // Handle existing user case (fallback) — generic response, no enumeration
      if (signupError.message.includes("already been registered") ||
          signupError.message.includes("User already registered") ||
          signupError.message.includes("email_exists")) {

        return new Response(JSON.stringify({
          success: true,
          message: "Om adressen är giltig har vi skickat ett mejl med nästa steg.",
          needsConfirmation: true
        }), {
          status: 200,
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
    expiresAt.setHours(expiresAt.getHours() + 24 * 7); // 7 dagars giltighet

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
    const defaultAppUrl = "https://parium.se";

    // Om REDIRECT_URL är satt till en full URL och inte är en Supabase-domän, använd den
    let appBase = defaultAppUrl;
    if (redirectEnv && redirectEnv.startsWith("http")) {
      appBase = redirectEnv.includes("supabase.co") ? defaultAppUrl : redirectEnv;
    }

    const confirmationUrl = `${appBase}/email-confirm?confirm=${confirmationToken}`;
    
    console.log("Sending confirmation email");



    // 5. Anropa send-confirmation-email Edge Function via backendens SUPABASE_URL
    // Med retry-logik för robusthet
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const maxRetries = 3;
    let emailSent = false;
    let lastError = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Sending confirmation email (attempt ${attempt}/${maxRetries})...`);
        
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-confirmation-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
          },
          body: JSON.stringify({
            email: normalizedEmail,
            role: data?.role || 'job_seeker',
            first_name: firstName,
            confirmation_url: confirmationUrl,
            company_name: data?.company_name
          })
        });

        if (emailResponse.ok) {
          console.log("Confirmation email sent successfully");
          emailSent = true;
          break;
        } else {
          const errorText = await emailResponse.text();
          lastError = errorText;
          console.error(`Email send attempt ${attempt} failed:`, errorText);
          
          // Vänta lite innan nästa försök (exponential backoff)
          if (attempt < maxRetries) {
            const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      } catch (fetchError: any) {
        lastError = fetchError.message;
        console.error(`Email send attempt ${attempt} error:`, fetchError);
        
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    if (!emailSent) {
      console.error('Failed to send confirmation email after all retries:', lastError);
      
      // KRITISKT: Radera användaren om mejlet inte kunde skickas
      // Annars blir användaren fast (kan inte logga in, kan inte registrera igen)
      console.log('Deleting newly-created user due to email send failure');
      
      try {
        await supabase.from('email_confirmations').delete().eq('user_id', user.user.id);
        await supabase.from('profiles').delete().eq('user_id', user.user.id);
        await supabase.auth.admin.deleteUser(user.user.id);
        console.log('User deleted successfully after email failure');
      } catch (deleteError) {
        console.error('Failed to cleanup user after email failure:', deleteError);
      }
      
      // Returnera fel så användaren kan försöka igen senare
      return new Response(JSON.stringify({ 
        success: false,
        error: "Vi kunde inte skicka bekräftelsemejlet just nu. Vänligen försök igen om en stund eller kontakta support om problemet kvarstår.",
        retryable: true
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

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