import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApplicationConfirmationRequest {
  applicant_email: string;
  applicant_first_name: string;
  job_title: string;
  company_name: string;
}

const getTemplate = (firstName: string, jobTitle: string, companyName: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Ansökan mottagen – Parium</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F9FAFB; font-family: Arial, Helvetica, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; max-width: 600px;">
          <tr>
            <td style="background-color: #1E3A8A; padding: 32px 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0 0 4px 0; font-size: 24px; font-weight: bold; color: #ffffff;">Parium</h1>
              <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.8);">Bekräftelse på din ansökan</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                Hej ${firstName}!
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                Din ansökan till <strong>${jobTitle}</strong> hos <strong>${companyName}</strong> har mottagits.
              </p>
              <div style="background-color: #F0F9FF; border-left: 4px solid #1E3A8A; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
                <p style="margin: 0; font-size: 15px; color: #1E3A8A; font-weight: 600;">${jobTitle}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #6B7280;">${companyName}</p>
              </div>
              <p style="margin: 20px 0 0; font-size: 15px; color: #333; line-height: 1.6;">
                Arbetsgivaren kommer att granska din ansökan och återkoppla.
              </p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 0;">
                <tr>
                  <td align="center">
                    <a href="https://www.parium.se/my-applications" style="background-color: #1E3A8A; border-radius: 10px; color: #ffffff; display: inline-block; font-size: 15px; font-weight: bold; line-height: 46px; text-align: center; text-decoration: none; width: 240px;">Se mina ansökningar</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 28px 0 0; font-size: 15px; color: #333; line-height: 1.6; text-align: center;">
                Lycka till! 🍀
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #F9FAFB; padding: 20px 30px; text-align: center; border-top: 1px solid #E5E7EB; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 13px; color: #9CA3AF;">Parium AB · Stockholm<br/>Du får detta mail för att du skickat en ansökan via Parium.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { applicant_email, applicant_first_name, job_title, company_name }: ApplicationConfirmationRequest = await req.json();

    const dispatchResponse = await fetch(`${supabaseUrl}/functions/v1/outreach-dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ trigger: "application_received" }),
    });

    if (dispatchResponse.ok) {
      const dispatchData = await dispatchResponse.json().catch(() => ({}));
      const processedCount = Number(dispatchData?.processedCount ?? 0);

      if (processedCount > 0) {
        return new Response(JSON.stringify({ success: true, processedCount, mode: "outreach_automation" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    console.log(`Sending application confirmation to ${applicant_email} for job: ${job_title}`);

    const emailResponse = await resend.emails.send({
      from: "Parium <noreply@parium.se>",
      to: [applicant_email],
      subject: `Ansökan mottagen – ${job_title}`,
      html: getTemplate(applicant_first_name, job_title, company_name),
    });

    console.log("Application confirmation email sent:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending application confirmation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
