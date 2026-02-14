import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

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

  console.log("Saved job expiration reminders cron started");

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const now = new Date();
    const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Find saved jobs where the job expires within 48 hours
    const { data: savedJobs, error: savedError } = await supabase
      .from("saved_jobs")
      .select(`
        id,
        user_id,
        job_id,
        job_postings!inner (
          id,
          title,
          expires_at,
          is_active,
          profiles!job_postings_employer_id_fkey (
            company_name
          )
        )
      `)
      .gt("job_postings.expires_at", now.toISOString())
      .lte("job_postings.expires_at", fortyEightHoursFromNow.toISOString())
      .eq("job_postings.is_active", true);

    if (savedError) {
      console.error("Error fetching saved jobs:", savedError);
      throw savedError;
    }

    console.log(`Found ${savedJobs?.length || 0} saved jobs expiring within 48h`);

    let notificationsSent = 0;

    if (savedJobs && savedJobs.length > 0) {
      for (const saved of savedJobs) {
        const job = saved.job_postings as any;
        const companyName = job.profiles?.company_name || "Företaget";

        // Check if user has this notification type enabled
        const { data: pref } = await supabase
          .from("notification_preferences")
          .select("is_enabled")
          .eq("user_id", saved.user_id)
          .eq("notification_type", "saved_job_expiring")
          .maybeSingle();

        // Default is enabled if no preference exists
        if (pref && pref.is_enabled === false) {
          continue;
        }

        // Check if we already sent this notification (avoid duplicates)
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", saved.user_id)
          .eq("type", "saved_job_expiring")
          .contains("metadata", { job_id: saved.job_id })
          .limit(1);

        if (existing && existing.length > 0) {
          continue;
        }

        const expiresDate = new Date(job.expires_at);
        const hoursRemaining = Math.max(0, Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
        const timeText = hoursRemaining <= 1
          ? "mindre än en timme"
          : hoursRemaining < 24
            ? `${hoursRemaining} timmar`
            : `${Math.ceil(hoursRemaining / 24)} dag(ar)`;

        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            user_id: saved.user_id,
            type: "saved_job_expiring",
            title: `"${job.title}" utgår snart!`,
            body: `Din sparade annons hos ${companyName} utgår om ${timeText}. Sök nu innan det är för sent!`,
            metadata: { job_id: saved.job_id },
          });

        if (notifError) {
          console.error(`Failed to create notification for user ${saved.user_id}:`, notifError);
          continue;
        }

        notificationsSent++;
      }
    }

    console.log(`Sent ${notificationsSent} saved job expiration notifications`);

    return new Response(
      JSON.stringify({
        message: "Saved job expiration reminders processed",
        savedJobsExpiring: savedJobs?.length || 0,
        notificationsSent,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in saved-job-expiration-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
