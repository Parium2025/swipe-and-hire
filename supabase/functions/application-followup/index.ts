import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    let queuedCount = 0;

    for (const app of (applications || [])) {
      const employerId = (app.job_postings as any)?.employer_id;
      if (!employerId) continue;

      const { data: matchingAutomations, error: automationError } = await supabase
        .from("outreach_automations")
        .select("id, owner_user_id, organization_id, template_id, channel, recipient_type, delay_minutes, filters")
        .eq("owner_user_id", employerId)
        .eq("trigger", "application_no_response_14d")
        .eq("recipient_type", "candidate")
        .eq("is_enabled", true);

      if (automationError) {
        console.error("Error fetching application followup automations:", automationError);
        continue;
      }

      for (const automation of matchingAutomations || []) {
        const { data: existingLog } = await supabase
          .from("outreach_dispatch_logs")
          .select("id")
          .eq("automation_id", automation.id)
          .eq("recipient_user_id", app.applicant_id)
          .eq("job_id", app.id)
          .eq("trigger", "application_no_response_14d")
          .limit(1)
          .maybeSingle();

        if (existingLog) continue;

        const { error: insertError } = await supabase.from("outreach_dispatch_logs").insert({
          owner_user_id: automation.owner_user_id,
          organization_id: automation.organization_id,
          automation_id: automation.id,
          template_id: automation.template_id,
          trigger: "application_no_response_14d",
          channel: automation.channel,
          recipient_user_id: app.applicant_id,
          job_id: app.id,
          payload: {
            source: "application-followup",
            application_id: app.id,
            queued_at: new Date().toISOString(),
            delay_minutes: automation.delay_minutes,
            filters: automation.filters,
          },
          status: "pending",
        });

        if (!insertError) queuedCount += 1;
      }
    }

    let processedCount = 0;
    if (queuedCount > 0) {
      const dispatchResponse = await fetch(`${supabaseUrl}/functions/v1/outreach-dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ trigger: "application_no_response_14d" }),
      });

      if (dispatchResponse.ok) {
        const dispatchData = await dispatchResponse.json().catch(() => ({}));
        processedCount = Number(dispatchData?.processedCount ?? 0);
      }
    }

    console.log(`Queued ${queuedCount} and processed ${processedCount} 14-day followups`);

    return new Response(
      JSON.stringify({ queued: queuedCount, processed: processedCount, total: applications?.length || 0 }),
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
