import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { requireServiceRoleOrCronSecret } from "../_shared/service-auth.ts";

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
      // Har användaren redan sökt jobbet är "sök innan det är för sent" meningslöst –
      // hen får i stället beskedet när annonsen avslutas. Hoppa över dessa.
      const userIds = [...new Set(savedJobs.map((s) => s.user_id))];
      const jobIds = [...new Set(savedJobs.map((s) => s.job_id))];
      const { data: applications } = await supabase
        .from("job_applications")
        .select("applicant_id, job_id")
        .in("applicant_id", userIds)
        .in("job_id", jobIds);
      const alreadyApplied = new Set(
        (applications || []).map((a) => `${a.applicant_id}:${a.job_id}`)
      );

      // SKALA: tidigare gjordes två extra databasfrågor PER sparat jobb. Vid
      // tiotusentals sparade annonser blev det tiotusentals sekventiella anrop
      // och körningen hann aldrig klart. Nu hämtas samma information i två
      // samlade frågor och notiserna skrivs i klumpar.
      const [prefsRes, existingRes] = await Promise.all([
        supabase
          .from("notification_preferences")
          .select("user_id, is_enabled")
          .eq("notification_type", "saved_job_expiring")
          .in("user_id", userIds),
        supabase
          .from("notifications")
          .select("user_id, metadata")
          .eq("type", "saved_job_expiring")
          .in("user_id", userIds)
          .gte("created_at", new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const disabledUsers = new Set(
        (prefsRes.data || [])
          .filter((p) => (p as { is_enabled: boolean | null }).is_enabled === false)
          .map((p) => (p as { user_id: string }).user_id)
      );
      const alreadyNotified = new Set(
        (existingRes.data || [])
          .map((n) => {
            const meta = (n as { metadata: Record<string, unknown> | null }).metadata;
            const jobId = meta && typeof meta === "object" ? (meta as { job_id?: string }).job_id : undefined;
            return jobId ? `${(n as { user_id: string }).user_id}:${jobId}` : null;
          })
          .filter((k): k is string => Boolean(k))
      );

      const rows: Array<Record<string, unknown>> = [];
      const queuedKeys = new Set<string>();

      for (const saved of savedJobs) {
        const key = `${saved.user_id}:${saved.job_id}`;
        if (alreadyApplied.has(key)) continue;
        // Standard är påslaget – bara uttryckligt avstängt hoppas över.
        if (disabledUsers.has(saved.user_id)) continue;
        if (alreadyNotified.has(key)) continue;
        if (queuedKeys.has(key)) continue;
        queuedKeys.add(key);

        const job = saved.job_postings as any;
        const companyName = job.profiles?.company_name || "Företaget";

        const expiresDate = new Date(job.expires_at);
        const hoursRemaining = Math.max(0, Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
        const timeText = hoursRemaining <= 1
          ? "mindre än en timme"
          : hoursRemaining < 24
            ? `${hoursRemaining} timmar`
            : `${Math.ceil(hoursRemaining / 24)} dag(ar)`;

        rows.push({
          user_id: saved.user_id,
          type: "saved_job_expiring",
          title: `"${job.title}" utgår snart!`,
          body: `Din sparade annons hos ${companyName} utgår om ${timeText}. Sök nu innan det är för sent!`,
          metadata: { job_id: saved.job_id },
        });
      }

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error: notifError } = await supabase.from("notifications").insert(chunk);
        if (notifError) {
          console.error("Failed to create saved_job_expiring notifications chunk:", notifError);
          continue;
        }
        notificationsSent += chunk.length;
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
