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

    console.log(`Attempting signup for email: ${email}`);

    // 1. Först, försök ta bort befintlig användare om den finns
    try {
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      
      if (!listError && listData?.users) {
        const existingUser = listData.users.find(u => u.email === email);
        
        if (existingUser) {
          console.log(`Found existing user ${existingUser.id}, deleting first...`);
          
          // Ta bort från relaterade tabeller
          await supabase.from('email_confirmations').delete().eq('user_id', existingUser.id);
          await supabase.from('profiles').delete().eq('user_id', existingUser.id);
          await supabase.from('user_roles').delete().eq('user_id', existingUser.id);
          
          // Ta bort användaren
          await supabase.auth.admin.deleteUser(existingUser.id);
          console.log('Existing user deleted successfully');
        }
      }
    } catch (cleanupError) {
      console.error('Cleanup error (continuing anyway):', cleanupError);
    }

    // 2. Skapa användare utan bekräftelse
    const { data: user, error: signupError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Vi hanterar bekräftelse manuellt
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

    // 2. Skapa bekräftelsetoken och PIN-kod
    const confirmationToken = crypto.randomUUID();
    const pinCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-siffrig PIN
    
    // 3. Spara token och PIN i databasen
    const { error: tokenError } = await supabase
      .from('email_confirmations')
      .insert({
        user_id: user.user.id,
        email,
        token: confirmationToken,
        pin_code: pinCode
      });

    if (tokenError) {
      console.error('Error saving confirmation token:', tokenError);
      // Ta bort användaren om token-sparandet misslyckades
      await supabase.auth.admin.deleteUser(user.user.id);
      throw new Error('Fel vid skapande av bekräftelsetoken');
    }
    
    // 4. Skapa bekräftelse-URL med email för backup
    const confirmationUrl = `https://09c4e686-17a9-467e-89b1-3cf832371d49.lovableproject.com/verify?confirm=${confirmationToken}&email=${encodeURIComponent(email)}`;

    // 5. Skicka bekräftelsemejl med flera alternativ
    const emailResponse = await resend.emails.send({
      from: "Parium <noreply@parium.se>",
      to: [email],
      subject: "Bekräfta ditt konto – Parium (3 enkla sätt)",
      html: `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Bekräfta ditt konto – Parium</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #F9FAFB; font-family: Arial, Helvetica, sans-serif;">
          
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; max-width: 600px;">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #1E3A8A; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                      
                      <h1 style="margin: 0 0 8px 0; font-family: Arial, Helvetica, sans-serif; font-size: 28px; font-weight: bold; color: #ffffff;">
                        Parium
                      </h1>
                      <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #ffffff;">
                        Framtiden börjar med ett swipe
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      
                        <p style="margin: 0 0 24px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">
                          Hej ${firstName}!<br><br>
                          Du har just klivit in i nästa generation av jobbsök.<br>
                          <strong>Bekräfta ditt konto på 3 enkla sätt:</strong>
                        </p>

                        <!-- PIN-kod sektion -->
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                          <tr>
                            <td style="background-color: #EF4444; border-radius: 10px; padding: 16px; text-align: center;">
                              <p style="margin: 0 0 8px 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: bold; color: #ffffff;">
                                🔐 SNABBASTE SÄTTET - PIN-KOD
                              </p>
                              <p style="margin: 0 0 12px 0; font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: 3px;">
                                ${pinCode}
                              </p>
                              <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #ffffff;">
                                Ange denna kod på bekräftelsesidan
                              </p>
                            </td>
                          </tr>
                        </table>
                      
                      <!-- Email-länk sektion -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                        <tr>
                          <td style="background-color: #1E3A8A; border-radius: 10px; padding: 12px; text-align: center;">
                            <p style="margin: 0 0 8px 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #ffffff;">
                              📧 ALTERNATIV 2 - EMAIL-LÄNK
                            </p>
                            <table border="0" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="background-color: #ffffff; border-radius: 6px; padding: 0;">
                                  <a href="${confirmationUrl}" style="display: block; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: bold; color: #1E3A8A; text-decoration: none; padding: 10px 20px; border-radius: 6px;">
                                    Bekräfta mitt konto
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- Problem med Gmail sektion -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                        <tr>
                          <td style="background-color: #FFA500; border-radius: 10px; padding: 12px;">
                            <p style="margin: 0 0 8px 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: bold; color: #000000; text-align: center;">
                              📱 GMAIL-APP PROBLEM?
                            </p>
                            <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000000; text-align: center;">
                              Om länken inte fungerar i Gmail-appen:<br/>
                              • Använd PIN-koden ovan ELLER<br/>
                              • Kopiera länken och öppna i Safari
                            </p>
                          </td>
                        </tr>
                      </table>

                      <!-- Funktioner -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px;">
                        <tr>
                          <td style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #111827; text-align: center;">
                            <p style="margin: 0 0 8px 0; font-weight: bold;">När kontot är aktiverat kan du:</p>
                            <p style="margin: 0 0 6px 0;">• Matcha med jobb som passar dig</p>
                            <p style="margin: 0 0 6px 0;">• Swipea, ansök och gå vidare på sekunder</p>
                            <p style="margin: 0;">• Spara tid med smarta och effektiva verktyg</p>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- Backup länk -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px;">
                        <tr>
                          <td style="background-color: #F9FAFB; padding: 16px; border-radius: 8px;">
                            <p style="margin: 0 0 8px 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #6B7280; text-align: center;">
                              🌐 ALTERNATIV 3 - MANUELL LÄNK
                            </p>
                            <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #1E3A8A; word-break: break-all; text-align: center;">
                              ${confirmationUrl}
                            </p>
                          </td>
                        </tr>
                      </table>
                      
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #F9FAFB; padding: 24px 30px; text-align: center; border-top: 1px solid #E5E7EB; border-radius: 0 0 12px 12px;">
                      <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #6B7280;">
                        Parium AB · Stockholm<br>
                        Du får detta mail för att du registrerat ett konto i Parium-appen.
                      </p>
                    </td>
                  </tr>
                  
                </table>
                
              </td>
            </tr>
          </table>
          
        </body>
        </html>
      `,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
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