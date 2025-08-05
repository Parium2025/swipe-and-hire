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

interface ResendRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: ResendRequest = await req.json();

    console.log(`Resending confirmation for email: ${email}`);

    // 1. Hitta användaren i auth.users
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    const user = listData.users.find(u => u.email === email);
    
    if (!user) {
      return new Response(JSON.stringify({ 
        error: "Ingen användare hittad med denna e-postadress. Registrera dig först." 
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // 2. Kontrollera om användaren redan är bekräftad
    if (user.email_confirmed_at) {
      return new Response(JSON.stringify({ 
        error: "E-posten är redan bekräftad. Du kan logga in direkt." 
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    console.log(`Found unconfirmed user: ${user.id}`);

    // 3. Skapa ny bekräftelsetoken
    const newToken = crypto.randomUUID();
    
    // 4. Uppdatera eller skapa ny bekräftelsepost
    const { error: upsertError } = await supabase
      .from('email_confirmations')
      .upsert({
        user_id: user.id,
        email: email,
        token: newToken,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minuter
        confirmed_at: null
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error('Error updating confirmation:', upsertError);
      throw upsertError;
    }

    const confirmationUrl = `${req.headers.get('origin')}/auth?confirm=${newToken}`;
    
    // 5. Skicka nytt bekräftelsemejl
    const emailResponse = await resend.emails.send({
      from: "Parium <noreply@parium.se>",
      to: [email],
      subject: "✨ Bekräfta ditt Parium-konto - Ny länk",
      html: `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Bekräfta ditt Parium-konto</title>
        </head>
        <body style="margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
          
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f7fa; min-width: 100%;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); max-width: 600px;">
                  
                  <tr>
                    <td style="background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%); background-color: #1a237e; border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
                      
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center">
                            <div style="width: 80px; height: 80px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 24px auto; line-height: 80px; text-align: center;">
                              <span style="font-family: Arial, sans-serif; font-size: 36px; font-weight: bold; color: #ffffff; vertical-align: middle;">P</span>
                            </div>
                          </td>
                        </tr>
                      </table>
                      
                      <h1 style="margin: 0 0 8px 0; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; line-height: 1.2;">
                        Ny bekräftelselänk 📬
                      </h1>
                      <p style="margin: 0; font-family: Arial, sans-serif; font-size: 16px; color: rgba(255,255,255,0.9); line-height: 1.4;">
                        Din nya bekräftelselänk är här!
                      </p>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 40px 30px;">
                      
                      <p style="margin: 0 0 24px 0; font-family: Arial, sans-serif; font-size: 16px; color: #4a5568; text-align: center; line-height: 1.5;">
                        Du begärde en ny bekräftelselänk. Klicka på knappen nedan för att bekräfta din e-postadress och aktivera ditt Parium-konto.
                      </p>
                      
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center" style="padding: 20px 0;">
                            <table border="0" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%); background-color: #1a237e; border-radius: 50px; padding: 18px 40px;">
                                  <a href="${confirmationUrl}" style="font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; display: block;">
                                    ✨ Bekräfta mitt konto
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px;">
                        <tr>
                          <td style="background-color: #f8fafc; border-radius: 12px; padding: 20px;">
                            <p style="margin: 0 0 12px 0; font-family: Arial, sans-serif; font-size: 14px; color: #64748b; text-align: center; font-weight: 500;">
                              Fungerar knappen inte? Kopiera denna länk:
                            </p>
                            <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #1a237e; background-color: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; word-break: break-all; text-align: center;">
                              ${confirmationUrl}
                            </p>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 32px 0 0 0; font-family: Arial, sans-serif; font-size: 14px; color: #9ca3af; text-align: center;">
                        ⏰ Denna länk är giltig i 5 minuter
                      </p>
                      
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0; border-radius: 0 0 16px 16px;">
                      <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #9ca3af;">
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
    });

    console.log("Resend confirmation email sent:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Ny bekräftelselänk skickad! Kolla din e-post.",
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in resend-confirmation:", error);
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