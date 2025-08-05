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

    // 2. Skapa bekräftelsetoken
    const confirmationToken = crypto.randomUUID();
    
    // 3. Spara token i databasen
    const { error: tokenError } = await supabase
      .from('email_confirmations')
      .insert({
        user_id: user.user.id,
        email,
        token: confirmationToken
      });

    if (tokenError) {
      console.error('Error saving confirmation token:', tokenError);
      // Ta bort användaren om token-sparandet misslyckades
      await supabase.auth.admin.deleteUser(user.user.id);
      throw new Error('Fel vid skapande av bekräftelsetoken');
    }
    
    const confirmationUrl = `${req.headers.get('origin')}/auth?confirm=${confirmationToken}`;

    // 4. Skicka bekräftelsemejl via Resend
    const emailResponse = await resend.emails.send({
      from: "Parium <noreply@parium.se>",
      to: [email],
      subject: "✨ Välkommen till Parium - Bekräfta ditt premium-konto",
      html: `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Välkommen till Parium</title>
          <!--[if mso]>
          <style type="text/css">
            .fallback-font { font-family: Arial, sans-serif !important; }
            .outlook-fix { mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important; }
          </style>
          <![endif]-->
        </head>
        <body style="margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
          
          <!-- Preheader text -->
          <div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
            Bekräfta ditt Parium-konto och börja din premium-upplevelse idag! ✨
          </div>
          
          <!-- Main container -->
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f7fa; min-width: 100%;" class="outlook-fix">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                
                <!-- Email content wrapper -->
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); max-width: 600px;" class="outlook-fix">
                  
                  <!-- Header with gradient background -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%); background-color: #1a237e; border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
                      
                      <!-- Logo placeholder -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center">
                            <div style="width: 80px; height: 80px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 24px auto; line-height: 80px; text-align: center;">
                              <span style="font-family: Arial, sans-serif; font-size: 36px; font-weight: bold; color: #ffffff; vertical-align: middle;">P</span>
                            </div>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- Header text -->
                      <h1 style="margin: 0 0 8px 0; font-family: Arial, sans-serif; font-size: 28px; font-weight: bold; color: #ffffff; line-height: 1.2;" class="fallback-font">
                        Välkommen till Parium
                      </h1>
                      <p style="margin: 0; font-family: Arial, sans-serif; font-size: 16px; color: rgba(255,255,255,0.9); line-height: 1.4;" class="fallback-font">
                        Din premium karriärplattform
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Main content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      
                      <!-- Welcome message -->
                      <h2 style="margin: 0 0 16px 0; font-family: Arial, sans-serif; font-size: 22px; font-weight: bold; color: #1a202c; text-align: center; line-height: 1.3;" class="fallback-font">
                        Tack för att du valde Parium! 🎉
                      </h2>
                      
                      <p style="margin: 0 0 32px 0; font-family: Arial, sans-serif; font-size: 16px; color: #4a5568; text-align: center; line-height: 1.5;" class="fallback-font">
                        Du är bara ett klick ifrån att upptäcka framtidens jobbsökningsupplevelse. Bekräfta din e-postadress för att komma igång.
                      </p>
                      
                      <!-- CTA Button -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center" style="padding: 20px 0;">
                            <table border="0" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%); background-color: #1a237e; border-radius: 50px; padding: 18px 40px;">
                                  <a href="${confirmationUrl}" style="font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; display: block;" class="fallback-font">
                                    ✨ Bekräfta mitt konto
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- Features section -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 40px;">
                        <tr>
                          <td>
                            <h3 style="margin: 0 0 24px 0; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; color: #1a202c; text-align: center;" class="fallback-font">
                              Vad väntar dig:
                            </h3>
                          </td>
                        </tr>
                        
                        <!-- Feature 1 -->
                        <tr>
                          <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                              <tr>
                                <td width="32" style="vertical-align: top; padding-right: 12px;">
                                  <span style="font-size: 20px;">🎯</span>
                                </td>
                                <td style="vertical-align: top;">
                                  <span style="font-family: Arial, sans-serif; font-size: 14px; color: #4a5568; font-weight: 500;" class="fallback-font">
                                    Intelligenta jobbrekommendationer
                                  </span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        
                        <!-- Feature 2 -->
                        <tr>
                          <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                              <tr>
                                <td width="32" style="vertical-align: top; padding-right: 12px;">
                                  <span style="font-size: 20px;">⚡</span>
                                </td>
                                <td style="vertical-align: top;">
                                  <span style="font-family: Arial, sans-serif; font-size: 14px; color: #4a5568; font-weight: 500;" class="fallback-font">
                                    Snabb och enkel ansökningsprocess
                                  </span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        
                        <!-- Feature 3 -->
                        <tr>
                          <td style="padding: 12px 0;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                              <tr>
                                <td width="32" style="vertical-align: top; padding-right: 12px;">
                                  <span style="font-size: 20px;">🚀</span>
                                </td>
                                <td style="vertical-align: top;">
                                  <span style="font-family: Arial, sans-serif; font-size: 14px; color: #4a5568; font-weight: 500;" class="fallback-font">
                                    Premium karriärverktyg
                                  </span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- Alternative link section -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 40px;">
                        <tr>
                          <td style="background-color: #f8fafc; border-radius: 12px; padding: 24px;">
                            <p style="margin: 0 0 12px 0; font-family: Arial, sans-serif; font-size: 14px; color: #64748b; text-align: center; font-weight: 500;" class="fallback-font">
                              Fungerar knappen inte? Kopiera denna länk:
                            </p>
                            <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #1a237e; background-color: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; word-break: break-all; text-align: center;" class="fallback-font">
                              ${confirmationUrl}
                            </p>
                          </td>
                        </tr>
                      </table>
                      
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; border-radius: 0 0 16px 16px;">
                      <p style="margin: 0 0 8px 0; font-family: Arial, sans-serif; font-size: 12px; color: #9ca3af;" class="fallback-font">
                        Detta meddelande skickades till <strong>${email}</strong>
                      </p>
                      <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #9ca3af;" class="fallback-font">
                        © 2024 Parium. Framtidens karriärplattform.
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