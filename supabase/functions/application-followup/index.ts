import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getFollowupTemplate = (firstName: string, jobTitle: string, companyName: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Uppdatering om din ansökan – Parium</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F9FAFB; font-family: Arial, Helvetica, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; max-width: 600px;">
          <tr>
            <td style="background-color: #1E3A8A; padding: 32px 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0 0 4px 0; font-size: 24px; font-weight: bold; color: #ffffff;">Parium</h1>
              <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.8);">Uppdatering om din ansökan</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                Hej ${firstName}!
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                Det har gått 14 dagar sedan du ansökte till <strong>${jobTitle}</strong> hos <strong>${companyName}</strong> och vi vill bara informera dig att din ansökan fortfarande behandlas.
              </p>
              <div style="background-color: #FFFBEB; border-left: 4px solid #F59E0B; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
                <p style="margin: 0; font-size: 14px; color: #92400E; line-height: 1.5;">
                  Rekryteringsprocesser kan ta tid. Om arbetsgivaren är intresserad kommer de att kontakta dig direkt via Parium.
                </p>
              </div>
              <p style="margin: 20px 0 0; font-size: 15px; color: #333; line-height: 1.6;">
                Under tiden – håll din profil uppdaterad och fortsätt söka nya jobb! Nya möjligheter dyker upp dagligen.
              </p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 0;">
                <tr>
                  <td align="center">
                    <a href="https://parium-ab.lovable.app/search-jobs" style="background-color: #1E3A8A; border-radius: 10px; color: #ffffff; display: inline-block; font-size: 15px; font-weight: bold; line-height: 46px; text-align: center; text-decoration: none; width: 240px;">Sök fler jobb</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #F9FAFB; padding: 20px 30px; text-align: center; border-top: 1px solid #E5E7EB; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 13px; color: #9CA3AF;">Parium AB · Stockholm<br/>Du får detta mail automatiskt 14 dagar efter din ansökan. Du kan hantera mejlinställningar i appen.</p>
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find applications that are exactly 14 days old and still in 'pending' status
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const dayStart = new Date(fourteenDaysAgo);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(fourteenDaysAgo);
    dayEnd.setHours(23, 59, 59, 999);

    const { data: applications, error } = await supabase
      .from('job_applications')
      .select(`
        id, applicant_id, first_name, email, status, applied_at,
        job_postings!inner(title, employer_id, profiles:employer_id(company_name))
      `)
      .eq('status', 'pending')
      .gte('applied_at', dayStart.toISOString())
      .lte('applied_at', dayEnd.toISOString());

    if (error) {
      console.error('Error fetching applications:', error);
      throw error;
    }

    console.log(`Found ${applications?.length || 0} applications for 14-day followup`);

    let sentCount = 0;
    for (const app of (applications || [])) {
      if (!app.email || !app.first_name) continue;

      const jobTitle = (app.job_postings as any)?.title || 'Okänt jobb';
      const companyName = (app.job_postings as any)?.profiles?.company_name || 'Företaget';

      try {
        await resend.emails.send({
          from: "Parium <noreply@parium.se>",
          to: [app.email],
          subject: `Uppdatering om din ansökan – ${jobTitle}`,
          html: getFollowupTemplate(app.first_name, jobTitle, companyName),
        });
        sentCount++;
      } catch (emailError) {
        console.error(`Failed to send followup to ${app.email}:`, emailError);
      }
    }

    console.log(`Sent ${sentCount} followup emails`);

    return new Response(
      JSON.stringify({ sent: sentCount, total: applications?.length || 0 }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in application-followup:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
