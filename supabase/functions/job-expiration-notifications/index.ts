import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { requireServiceRoleOrCronSecret } from "../_shared/service-auth.ts";
import { sendLoggedTemplateEmail } from '../_shared/transactional-email-templates/send-logged-email.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const authResp = await requireServiceRoleOrCronSecret(req, corsHeaders);
  if (authResp) return authResp;


  console.log("Job expiration notification cron started");
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  let lockAcquired = false;

  try {
    const { data: gotLock, error: lockError } = await supabase.rpc('try_claim_job_lock', {
      _key: 'job-expiration-notifications',
      _ttl_seconds: 55 * 60,
    });
    if (lockError) throw lockError;
    if (gotLock !== true) {
      return new Response(JSON.stringify({ success: true, skipped: 'already_running' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    lockAcquired = true;

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

    // Send employer notification emails via Lovable Emails (hanterad e-postleverans)
    // SKALA: utskicken kördes tidigare ett i taget. När många annonser går ut
    // samma timme hann körningen inte klart. Nu skickas de i grupper om 5,
    // vilket håller samma ordning och samma idempotensnyckel men blir snabbare.
    let emailsSent = 0;
    if (expiringJobs && expiringJobs.length > 0) {
      const sendOne = async (job: (typeof expiringJobs)[number]) => {
        const profile = job.profiles as any;
        const firstName = profile?.first_name || "Arbetsgivare";

        let email = profile?.email;
        if (!email) {
          const { data: authUser } = await supabase.auth.admin.getUserById(job.employer_id);
          email = authUser?.user?.email;
        }

        if (!email) {
          console.log('No email found for employer, skipping notification');
          return;
        }

        const expiresDate = new Date(job.expires_at!);
        const hoursRemaining = Math.max(0, Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
        const timeText = hoursRemaining <= 1
          ? "mindre än en timme"
          : hoursRemaining < 24
            ? `${hoursRemaining} timmar`
            : `${Math.ceil(hoursRemaining / 24)} dag(ar)`;

        try {
          await sendLoggedTemplateEmail('job-expiration', email, {
            idempotencyKey: `job-expiration-${job.id}-${Math.floor(expiresDate.getTime() / (60 * 60 * 1000))}`,
            templateData: {
              first_name: firstName,
              job_title: job.title,
              time_text: timeText,
            },
          });
          emailsSent++;
          console.log('Sent job expiration email', { jobId: job.id });
        } catch (emailError) {
          console.error('Failed to send job expiration email', { jobId: job.id, error: emailError });
        }
      };

      const BATCH = 5;
      for (let i = 0; i < expiringJobs.length; i += BATCH) {
        await Promise.all(expiringJobs.slice(i, i + BATCH).map(sendOne));
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

    // Candidate-facing job_closed messages are queued atomically by the
    // enqueue_outreach_dispatch database trigger when a job closes. Keeping a
    // second sender here caused duplicate chat, push and email deliveries.

    await supabase.rpc('release_job_lock', { _key: 'job-expiration-notifications' });
    lockAcquired = false;

    return new Response(
      JSON.stringify({
        message: "Job expiration notifications processed",
        jobsExpiringIn8Hours: expiringJobs?.length || 0,
        emailsSent,
        jobsDeactivated: expiredJobs?.length || 0,
        candidateMessages: 'queued_by_outreach_trigger',
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    if (lockAcquired) {
      try {
        await supabase.rpc('release_job_lock', { _key: 'job-expiration-notifications' });
      } catch {
        // Låsets TTL frigör körningen om även cleanup misslyckas.
      }
    }
    console.error("Error in job-expiration-notifications:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
