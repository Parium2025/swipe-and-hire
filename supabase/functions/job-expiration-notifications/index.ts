import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Job expiration notification cron started");

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const now = new Date();
    const eightHoursFromNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    console.log(`Looking for jobs expiring between now and ${eightHoursFromNow.toISOString()}`);

    // Find active jobs expiring within 8 hours (for employer email notification)
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

    // Send employer notification emails if Resend is configured
    let emailsSent = 0;
    if (resendApiKey && expiringJobs && expiringJobs.length > 0) {
      const resend = new Resend(resendApiKey);

      for (const job of expiringJobs) {
        const profile = job.profiles as any;
        const firstName = profile?.first_name || "Arbetsgivare";
        
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
    <div style="background-color: #1a237e; padding: 40px 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Din annons utgår snart!</h1>
      <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 18px;">Lägg upp en ny annons för att fortsätta rekrytera</p>
    </div>
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
      <div style="margin: 30px 0; padding: 20px; background-color: #e3f2fd; border-radius: 8px; border-left: 4px solid #1a237e;">
        <p style="color: #1a237e; font-size: 16px; font-weight: bold; margin: 0 0 10px 0;">Tips!</p>
        <p style="color: #333333; font-size: 14px; margin: 0; line-height: 1.5;">
          Med dina jobbmallar kan du skapa en ny annons på under 60 sekunder. 
          All information är redan sparad - du behöver bara välja din mall och trycka på "Skapa ny annons" och sedan "Publicera".
        </p>
      </div>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0;">
        <tr>
          <td align="center" style="padding: 0;">
            <a href="https://parium.se/my-jobs" 
               style="background-color: #1a237e; border-radius: 5px; color: #ffffff; display: inline-block; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: bold; line-height: 48px; text-align: center; text-decoration: none; width: 280px; -webkit-text-size-adjust: none;">
              Gå till Mina Annonser
            </a>
          </td>
        </tr>
      </table>
      <p style="color: #666666; margin: 20px 0 0 0; font-size: 16px; line-height: 1.6; text-align: center;">
        Lycka till med rekryteringen!
      </p>
    </div>
    <div style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
      <p style="color: #333333; font-size: 16px; margin: 0; font-weight: bold;">
        Med vänliga hälsningar,<br>Parium-teamet
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
    }

    // Deactivate any jobs that have already expired
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

    // ─────────────────────────────────────────────────────────
    // AUTO-CLOSE: Send chat messages to candidates of closed jobs
    // ─────────────────────────────────────────────────────────
    let autoCloseMessagesSent = 0;

    // Find closed/expired jobs that haven't notified candidates yet
    const { data: closedJobs, error: closedError } = await supabase
      .from("job_postings")
      .select(`
        id,
        title,
        employer_id,
        profiles!job_postings_employer_id_fkey (
          company_name
        )
      `)
      .eq("is_active", false)
      .is("auto_close_notified_at", null)
      .limit(50); // Process in batches

    if (closedError) {
      console.error("Error fetching closed jobs for auto-close notifications:", closedError);
    } else if (closedJobs && closedJobs.length > 0) {
      console.log(`Found ${closedJobs.length} closed jobs needing candidate notifications`);

      for (const job of closedJobs) {
        const profile = job.profiles as any;
        const companyName = profile?.company_name || "Arbetsgivaren";

        // Find all candidates who applied and haven't been hired or rejected
        const { data: applicants, error: appError } = await supabase
          .from("job_applications")
          .select("applicant_id")
          .eq("job_id", job.id)
          .not("status", "in", '("hired","rejected")');

        if (appError) {
          console.error(`Error fetching applicants for job ${job.id}:`, appError);
          continue;
        }

        if (!applicants || applicants.length === 0) {
          // No candidates to notify, mark as done
          await supabase
            .from("job_postings")
            .update({ auto_close_notified_at: now.toISOString() })
            .eq("id", job.id);
          continue;
        }

        console.log(`Sending auto-close messages to ${applicants.length} candidates for "${job.title}"`);

        // Check if employer has a default message template
        let messageContent = `Hej! Tjänsten "${job.title}" hos ${companyName} har nu avslutats. Vi ser över alla kandidater som sökt och kontaktar dig om du blir aktuell för att gå vidare. Tack för ditt intresse och lycka till! 🙏`;

        const { data: defaultTemplate } = await supabase
          .from("employer_message_templates")
          .select("content")
          .eq("employer_id", job.employer_id)
          .eq("category", "rejection")
          .eq("is_default", true)
          .limit(1)
          .maybeSingle();

        if (defaultTemplate?.content) {
          messageContent = defaultTemplate.content.replace(/\{job_title\}/g, job.title);
        }

        // Send message to each candidate via the messages table
        const messagesToInsert = applicants.map(app => ({
          sender_id: job.employer_id,
          recipient_id: app.applicant_id,
          content: messageContent,
          job_id: job.id,
          is_read: false,
        }));

        const { error: msgError } = await supabase
          .from("messages")
          .insert(messagesToInsert);

        if (msgError) {
          console.error(`Error sending auto-close messages for job ${job.id}:`, msgError);
          continue;
        }

        autoCloseMessagesSent += applicants.length;

        // Mark job as notified
        await supabase
          .from("job_postings")
          .update({ auto_close_notified_at: now.toISOString() })
          .eq("id", job.id);

        console.log(`Auto-close messages sent for "${job.title}" to ${applicants.length} candidates`);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Job expiration notifications processed",
        jobsExpiringIn8Hours: expiringJobs?.length || 0,
        emailsSent,
        jobsDeactivated: expiredJobs?.length || 0,
        autoCloseMessagesSent,
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
