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

    // Calculate the date range for jobs expiring in 8 hours (for testing, change to 3 days for production)
    const now = new Date();
    const eightHoursFromNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    console.log(`Looking for jobs expiring between now and ${eightHoursFromNow.toISOString()}`);

    // Find active jobs expiring within 8 hours
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
      .gt("expires_at", now.toISOString())
      .lte("expires_at", eightHoursFromNow.toISOString());

    if (jobsError) {
      console.error("Error fetching expiring jobs:", jobsError);
      throw jobsError;
    }

    console.log(`Found ${expiringJobs?.length || 0} jobs expiring within 8 hours`);

    if (!expiringJobs || expiringJobs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No jobs expiring within 8 hours", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send notification emails if Resend is configured
    let emailsSent = 0;
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      for (const job of expiringJobs) {
        const profile = job.profiles as any;
        const firstName = profile?.first_name || "Arbetsgivare";
        const companyName = profile?.company_name || "Ditt företag";
        
        // Get email from auth.users since profile.email might be null
        let email = profile?.email;
        if (!email) {
          const { data: authUser } = await supabase.auth.admin.getUserById(job.employer_id);
          email = authUser?.user?.email;
        }

        if (!email) {
          console.log(`No email found for employer ${job.employer_id}, skipping notification`);
          continue;
        }

        const expiresDate = new Date(job.expires_at!);
        const hoursRemaining = Math.max(0, Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
        const timeText = hoursRemaining <= 1 
          ? "mindre än en timme" 
          : hoursRemaining < 24 
            ? `${hoursRemaining} timmar`
            : `${Math.ceil(hoursRemaining / 24)} dag(ar)`;

        try {
          await resend.emails.send({
            from: "Parium <noreply@parium.se>",
            to: [email],
            subject: `Din annons "${job.title}" utgår snart!`,
            html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #ffffff;">
  
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; overflow: hidden;">
    
    <!-- Header -->
    <div style="background-color: #1a237e; padding: 40px 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Din annons utgår snart!</h1>
      <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 18px;">Lägg upp en ny annons för att fortsätta rekrytera</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="color: #333333; margin: 0 0 20px 0; font-size: 18px; line-height: 1.6; text-align: center;">
        Hej ${firstName}!
      </p>
      
      <p style="color: #333333; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; text-align: left;">
        Din jobbannons <strong>"${job.title}"</strong> utgår om <strong style="color: #e53935;">${timeText}</strong>.
      </p>
      
      <p style="color: #333333; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; text-align: left;">
        När annonsen har utgått kommer den inte längre att synas för jobbsökare. 
        Om du fortfarande letar efter kandidater rekommenderar vi att du skapar en ny annons.
      </p>
      
      <!-- Info box -->
      <div style="margin: 30px 0; padding: 20px; background-color: #e3f2fd; border-radius: 8px; border-left: 4px solid #1a237e;">
        <p style="color: #1a237e; font-size: 16px; font-weight: bold; margin: 0 0 10px 0;">
          Tips!
        </p>
        <p style="color: #333333; font-size: 14px; margin: 0; line-height: 1.5;">
          Med dina jobbmallar kan du skapa en ny annons på under 60 sekunder. 
          All information är redan sparad - du behöver bara klicka "Skapa ny annons" och välja din mall.
        </p>
      </div>
      
      <!-- Button -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0;">
        <tr>
          <td align="center" style="padding: 0;">
            <a href="https://parium.se/my-jobs" 
               style="background-color: #1a237e; border-radius: 5px; color: #ffffff; display: inline-block; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: bold; line-height: 48px; text-align: center; text-decoration: none; width: 280px; -webkit-text-size-adjust: none;">
              📋 Gå till Mina Annonser
            </a>
          </td>
        </tr>
      </table>
      
      <p style="color: #666666; margin: 20px 0 0 0; font-size: 16px; line-height: 1.6; text-align: center;">
        Lycka till med rekryteringen!
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
      <p style="color: #333333; font-size: 16px; margin: 0; font-weight: bold;">
        Med vänliga hälsningar,<br>
        Parium-teamet
      </p>
      
      <p style="color: #999999; font-size: 12px; margin: 20px 0 0 0;">
        Parium – Framtidens jobbsök börjar här.<br>
        Du får detta mail för att du har en aktiv jobbannons i Parium.
      </p>
    </div>
    
  </div>
  
</body>
</html>`,
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
        jobsExpiringIn8Hours: expiringJobs.length,
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
