import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationEmailRequest {
  email: string;
  role: 'job_seeker' | 'employer';
  first_name: string;
  confirmation_url: string;
}

const getJobSeekerTemplate = (firstName: string, confirmationUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #ffffff;">
  
  <!-- Simple container -->
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; overflow: hidden;">
    
    <!-- Header -->
    <div style="background-color: #1a237e; padding: 40px 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Parium</h1>
      <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 18px;">Framtiden börjar med ett swipe</p>
    </div>
    
     <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="color: #333333; margin: 0 0 20px 0; font-size: 18px; line-height: 1.6; text-align: center;">
        Hej ${firstName}!
      </p>
      <p style="color: #333333; margin: 0 0 20px 0; font-size: 18px; line-height: 1.6; text-align: center;">
        Välkommen till Parium — nästa steg i ett smartare jobbsökande.<br>
        Genom vår plattform får du tillgång till moderna verktyg som effektiviserar varje steg i din process.
      </p>
      
      <p style="color: #333333; margin: 20px 0 10px 0; font-size: 16px; font-weight: bold; text-align: center;">
        Med Parium kan du:
      </p>
      
      <!-- Benefits list -->
      <div style="margin: 10px auto 30px auto; text-align: left; max-width: 450px;">
        <div style="margin-bottom: 12px; padding-left: 15px; text-indent: -15px;">
          <span style="color: #333333; font-size: 16px; line-height: 1.6;">• Hitta jobb som verkligen matchar din profil</span>
        </div>
        <div style="margin-bottom: 12px; padding-left: 15px; text-indent: -15px;">
          <span style="color: #333333; font-size: 16px; line-height: 1.6;">• Swipea dig igenom alternativ och ansöka på några sekunder</span>
        </div>
        <div style="margin-bottom: 12px; padding-left: 15px; text-indent: -15px;">
          <span style="color: #333333; font-size: 16px; line-height: 1.6;">• Spara tid med verktyg som gör processen både enkel och effektiv</span>
        </div>
      </div>
      
      <p style="color: #333333; margin: 20px 0 10px 0; font-size: 16px; line-height: 1.6; text-align: center;">
        Bekräfta ditt konto för att komma igång!
      </p>
      
      <!-- Button -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
        <tr>
          <td align="center" style="padding: 0;">
            <a href="${confirmationUrl}" 
               style="background-color: #1a237e; border-radius: 5px; color: #ffffff; display: inline-block; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: bold; line-height: 48px; text-align: center; text-decoration: none; width: 280px; -webkit-text-size-adjust: none; mso-hide: all;">
              Bekräfta mitt konto
            </a>
          </td>
        </tr>
      </table>
      
      <p style="color: #666666; margin: 30px 0 0 0; font-size: 16px; line-height: 1.6; text-align: center;">
        Tack för ditt förtroende.<br>
        Det här kan bli början på något riktigt bra!
      </p>
      
      <!-- Alternative link -->
      <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 5px;">
        <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
          Fungerar inte knappen? Kopiera länken nedan:
        </p>
        <p style="color: #0066cc; font-size: 14px; word-break: break-all; margin: 0;">
          ${confirmationUrl}
        </p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
      <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
        Fick du detta mail av misstag? Ignorera det bara.
      </p>
      <p style="color: #333333; font-size: 16px; margin: 0; font-weight: bold;">
        Med vänliga hälsningar,<br>
        Parium-teamet
      </p>
      
      <p style="color: #999999; font-size: 12px; margin: 20px 0 0 0;">
        Parium – Framtidens jobbsök börjar här.
      </p>
    </div>
    
  </div>
  
</body>
</html>
`;

const getEmployerTemplate = (firstName: string, confirmationUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #ffffff;">
  
  <!-- Simple container -->
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; overflow: hidden;">
    
    <!-- Header -->
    <div style="background-color: #1a237e; padding: 40px 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Parium</h1>
      <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 18px;">Hitta nästa generations talang/talanger</p>
    </div>
    
     <!-- Content -->
     <div style="padding: 40px 30px; text-align: left;">
       <p style="color: #333333; margin: 0 0 20px 0; font-size: 18px; line-height: 1.6; text-align: center;">
         Hej ${firstName}!
       </p>
       <p style="color: #333333; margin: 0 0 20px 0; font-size: 18px; line-height: 1.6; text-align: left;">
          Välkommen till Parium - plattformen där <strong>RS6</strong> hittar nästa generations talang/talanger. Vi hjälper er att rekrytera enklare, snabbare och träffsäkrare.
        </p>
        
        <!-- Benefits list for employers -->
        <div style="margin: 30px 0; text-align: left; max-width: 450px; margin-left: auto; margin-right: auto;">
           <div style="margin-bottom: 15px; text-align: left;">
             <span style="color: #1a237e; font-size: 18px; margin-right: 10px; line-height: 1.4;">•</span>
             <span style="color: #333333; font-size: 16px; line-height: 1.4;">En smidig rekryteringsprocess från start till mål</span>
           </div>
           <div style="margin-bottom: 15px; text-align: left;">
             <span style="color: #1a237e; font-size: 18px; margin-right: 10px; line-height: 1.4;">•</span>
             <span style="color: #333333; font-size: 16px; line-height: 1.4;">Direktkontakt med kandidater</span>
           </div>
           <div style="margin-bottom: 30px; text-align: left;">
             <span style="color: #1a237e; font-size: 18px; margin-right: 10px; line-height: 1.4;">•</span>
             <span style="color: #333333; font-size: 16px; line-height: 1.4;">Ett modernt gränssnitt anpassat för era krav</span>
           </div>
        </div>
      
      <!-- Button -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
        <tr>
          <td align="center" style="padding: 0;">
            <a href="${confirmationUrl}" 
               style="background-color: #1a237e; border-radius: 5px; color: #ffffff; display: inline-block; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: bold; line-height: 48px; text-align: center; text-decoration: none; width: 280px; -webkit-text-size-adjust: none; mso-hide: all;">
              Bekräfta företagskonto
            </a>
          </td>
        </tr>
      </table>
      
      <p style="color: #666666; margin: 20px 0 0 0; font-size: 16px; line-height: 1.6; text-align: center;">
        Tack för att du väljer Parium för er rekrytering.<br>
        Tillsammans skapar vi framtidens arbetsliv.
      </p>
      
      <!-- Alternative link -->
      <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 5px;">
        <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
          Fungerar inte knappen? Kopiera länken nedan:
        </p>
        <p style="color: #0066cc; font-size: 14px; word-break: break-all; margin: 0;">
          ${confirmationUrl}
        </p>
      </div>
    </div>
    
     <!-- Footer -->
     <div style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
       <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
         Fick du detta mail av misstag? Ignorera det bara.
       </p>
       <p style="color: #333333; font-size: 16px; margin: 0; font-weight: bold;">
         Med vänliga hälsningar,<br>
         Parium-teamet
       </p>
       
       <p style="color: #999999; font-size: 12px; margin: 20px 0 0 0;">
         Parium – Framtidens jobbsök börjar här.<br>
         Du får detta mail för att du registrerat ett företagskonto i Parium-appen.
       </p>
     </div>
    
  </div>
  
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, role, first_name, confirmation_url }: ConfirmationEmailRequest = await req.json();

    console.log(`Sending confirmation email to ${email} with role ${role}`);

    // Choose the correct template based on role
    const emailHtml = role === 'employer' 
      ? getEmployerTemplate(first_name, confirmation_url)
      : getJobSeekerTemplate(first_name, confirmation_url);

    const subject = role === 'employer' 
      ? 'Välkommen till Parium – Bekräfta ditt företagskonto'
      : 'Bekräfta ditt konto – Parium';

    const emailResponse = await resend.emails.send({
      from: "Parium <noreply@parium.se>",
      to: [email],
      subject: subject,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-confirmation-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );  }
};

serve(handler);