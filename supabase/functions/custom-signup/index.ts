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

    // 2. Skapa användare med automatisk bekräftelse
    const { data: user, error: signupError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-bekräfta så användaren kan logga in direkt
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

    // Användaren är nu skapad och bekräftad - skicka välkomstmejl
    const appUrl = Deno.env.get("REDIRECT_URL") || "https://swipe-and-hire.lovable.app";
    const loginUrl = `${appUrl}/auth`;
    
    console.log(`Sending welcome email to ${email}`);

    // 4. Skicka välkomstmejl via Resend
    const emailResponse = await resend.emails.send({
      from: "Parium <noreply@parium.se>",
      to: [email],
      subject: isEmployer ? "Välkommen till Parium – Ditt företagskonto är aktivt" : "Välkommen till Parium – Ditt konto är aktivt",
      text: isEmployer ? 
        `Hej ${firstName}!

Välkommen till Parium - plattformen där ${companyName} hittar nästa generations talang/talanger.

Ditt konto är nu aktivt och du kan logga in direkt:
${loginUrl}

Med Parium får ni tillgång till:
• Kvalificerade kandidater som matchar era behov
• Smidiga rekryteringsverktyg
• Direkt kontakt med potentiella medarbetare

Parium Team` 
      :
        `Hej ${firstName}!

Ditt konto är nu aktivt och du kan logga in direkt:
${loginUrl}

Parium Team`,
      html: isEmployer ? 
        // Employer email template
        `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Välkommen till Parium – Ditt företagskonto är aktivt</title>
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
                         Hitta nästa generations talang/talanger
                       </p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td align="left" style="padding: 40px 30px; text-align: left;">
                      
                        <p style="margin: 0 0 24px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">
                          Hej ${firstName}!
                        </p>
                        <p style="margin: 0 0 24px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #111827; text-align: left; line-height: 24px;">
                           Välkommen till Parium - plattformen där <strong>${companyName}</strong> hittar nästa generations talang/talanger. Ditt konto är nu aktivt och du kan logga in direkt!
                         </p>
                        
                         <!-- Features list for employers -->
                         <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px;">
                           <tr>
                             <td style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #111827; text-align: left;">
                                <p style="margin: 0 0 12px 0; text-align: left;">• En smidig rekryteringsprocess från start till mål</p>
                                <p style="margin: 0 0 12px 0; text-align: left;">• Direktkontakt med kandidater</p>
                                <p style="margin: 0; text-align: left;">• Ett modernt gränssnitt anpassat för era krav</p>
                           </td>
                         </tr>
                       </table>
                       
                       <!-- Button with bulletproof mobile centering -->
                       <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 32px 0;">
                         <tr>
                           <td align="center" style="padding: 0;">
                             <!--[if mso]>
                             <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="21%" stroke="f" fillcolor="#1E3A8A">
                             <w:anchorlock/>
                             <center>
                             <![endif]-->
                             <a href="${loginUrl}" 
                                style="background-color: #1E3A8A; border-radius: 10px; color: #ffffff; display: inline-block; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; line-height: 48px; text-align: center; text-decoration: none; width: 280px; -webkit-text-size-adjust: none; mso-hide: all;">
                               Logga in nu
                             </a>
                             <!--[if mso]>
                             </center>
                             </v:roundrect>
                             <![endif]-->
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
                         Du får detta mail för att du registrerat ett företagskonto i Parium-appen.
                       </p>
                    </td>
                  </tr>
                  
                </table>
                
              </td>
            </tr>
          </table>
          
        </body>
        </html>
        `
      :
        // Job seeker email template
        `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Välkommen till Parium – Ditt konto är aktivt</title>
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
                          Hej ${firstName}!
                        </p>
                        <p style="margin: 0 0 24px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #111827; text-align: left; line-height: 24px;">
                          Du har just klivit in i nästa generation av jobbsök. Ditt konto är nu aktivt och du kan logga in direkt!
                        </p>
                      
                      <!-- Features list -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px;">
                        <tr>
                           <td style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #111827; text-align: left;">
                             <p style="margin: 0 0 12px 0; text-align: left;">• Matcha med jobb som passar dig</p>
                             <p style="margin: 0 0 12px 0; text-align: left;">• Swipea, ansök och gå vidare på sekunder</p>
                             <p style="margin: 0; text-align: left;">• Spara tid med smarta och effektiva verktyg</p>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- Button with bulletproof mobile centering -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 32px 0;">
                        <tr>
                          <td align="center" style="padding: 0;">
                            <!--[if mso]>
                            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="21%" stroke="f" fillcolor="#1E3A8A">
                            <w:anchorlock/>
                            <center>
                            <![endif]-->
                            <a href="${loginUrl}" 
                               style="background-color: #1E3A8A; border-radius: 10px; color: #ffffff; display: inline-block; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; line-height: 48px; text-align: center; text-decoration: none; width: 280px; -webkit-text-size-adjust: none; mso-hide: all;">
                              Logga in nu
                            </a>
                            <!--[if mso]>
                            </center>
                            </v:roundrect>
                            <![endif]-->
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
        `
    });

    console.log("Welcome email sent:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Konto skapat! Du kan logga in direkt.",
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