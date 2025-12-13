import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Job expiration notification cron started");

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Calculate the date range for jobs expiring in 3 days
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    // Set time boundaries for the 3-day mark (full day)
    const startOfDay = new Date(threeDaysFromNow);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(threeDaysFromNow);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`Looking for jobs expiring between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

    // Find active jobs expiring in 3 days
    const { data: expiringJobs, error: jobsError } = await supabase
      .from("job_postings")
      .select(`
        id,
        title,
        expires_at,
        employer_id,
        profiles!job_postings_employer_id_fkey (
          email,
          first_name,
          company_name
        )
      `)
      .eq("is_active", true)
      .gte("expires_at", startOfDay.toISOString())
      .lte("expires_at", endOfDay.toISOString());

    if (jobsError) {
      console.error("Error fetching expiring jobs:", jobsError);
      throw jobsError;
    }

    console.log(`Found ${expiringJobs?.length || 0} jobs expiring in 3 days`);

    if (!expiringJobs || expiringJobs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No jobs expiring in 3 days", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send notification emails if Resend is configured
    let emailsSent = 0;
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      for (const job of expiringJobs) {
        const profile = job.profiles as any;
        const email = profile?.email;
        const firstName = profile?.first_name || "Arbetsgivare";
        const companyName = profile?.company_name || "Ditt företag";

        if (!email) {
          console.log(`No email found for employer ${job.employer_id}, skipping notification`);
          continue;
        }

        const expiresDate = new Date(job.expires_at!);
        const formattedDate = expiresDate.toLocaleDateString("sv-SE", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        });

        try {
          await resend.emails.send({
            from: "Parium <noreply@parium.se>",
            to: [email],
            subject: `Din jobbannons "${job.title}" går ut om 3 dagar`,
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #ffffff; padding: 40px 20px; margin: 0;">
                  <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <h1 style="color: #14b8a6; font-size: 28px; margin: 0;">Parium</h1>
                      <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin-top: 8px;">Framtiden börjar med ett swipe</p>
                    </div>
                    
                    <h2 style="color: #ffffff; font-size: 22px; margin-bottom: 20px;">Hej ${firstName}!</h2>
                    
                    <p style="color: rgba(255,255,255,0.9); font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                      Din jobbannons <strong style="color: #14b8a6;">"${job.title}"</strong> hos ${companyName} går ut om <strong>3 dagar</strong>.
                    </p>
                    
                    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid rgba(255,255,255,0.1);">
                      <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin: 0;">Annonsen går ut:</p>
                      <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 8px 0 0 0;">${formattedDate}</p>
                    </div>
                    
                    <p style="color: rgba(255,255,255,0.9); font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                      Om du fortfarande söker efter kandidater, skapa gärna en ny annons. Med våra jobbmallar tar det bara 30 sekunder!
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="https://parium.se/my-jobs" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                        Gå till Mina Annonser
                      </a>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 30px 0;">
                    
                    <p style="color: rgba(255,255,255,0.5); font-size: 12px; text-align: center; margin: 0;">
                      Detta är ett automatiskt meddelande från Parium.<br>
                      © ${new Date().getFullYear()} Parium AB
                    </p>
                  </div>
                </body>
              </html>
            `,
          });

          emailsSent++;
          console.log(`Sent expiration notification to ${email} for job "${job.title}"`);
        } catch (emailError) {
          console.error(`Failed to send email to ${email}:`, emailError);
        }
      }
    } else {
      console.log("RESEND_API_KEY not configured, skipping email notifications");
    }

    // Also deactivate any jobs that have already expired
    const { data: expiredJobs, error: expireError } = await supabase
      .from("job_postings")
      .update({ is_active: false })
      .eq("is_active", true)
      .lt("expires_at", now.toISOString())
      .select("id, title");

    if (expireError) {
      console.error("Error deactivating expired jobs:", expireError);
    } else if (expiredJobs && expiredJobs.length > 0) {
      console.log(`Deactivated ${expiredJobs.length} expired jobs:`, expiredJobs.map(j => j.title));
    }

    return new Response(
      JSON.stringify({
        message: "Job expiration notifications processed",
        jobsExpiringIn3Days: expiringJobs.length,
        emailsSent,
        jobsDeactivated: expiredJobs?.length || 0
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in job-expiration-notifications:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
