import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceRoleOrCronSecret } from "../_shared/service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Interview {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  location_type: string;
  location_details: string | null;
  subject: string | null;
  applicant_id: string;
  employer_id: string;
  job_postings: {
    title: string;
  } | null;
}

interface InterviewTimelineAutomation {
  id: string;
  owner_user_id: string;
  organization_id: string | null;
  channel: "chat" | "email" | "push";
  template_id: string;
  trigger: "interview_before" | "interview_after";
  delay_minutes: number;
  filters: Record<string, unknown> | null;
}

const WINDOW_PADDING_MS = 150 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const authResp = await requireServiceRoleOrCronSecret(req, corsHeaders);
  if (authResp) return authResp;


  console.log("Interview reminders cron job started");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();

    const queueInterviewTimelineDispatches = async (trigger: "interview_before" | "interview_after") => {
      const { data: automations, error: automationsError } = await supabase
        .from("outreach_automations")
        .select("id, owner_user_id, organization_id, channel, template_id, trigger, delay_minutes, filters")
        .eq("trigger", trigger)
        .eq("recipient_type", "candidate")
        .eq("is_enabled", true);

      if (automationsError) {
        console.error(`Error fetching ${trigger} automations:`, automationsError);
        return 0;
      }

      let queued = 0;

      // En avaktiverad mall får inte skicka något – samma regel som vid ombokning.
      const templateIds = [...new Set(((automations || []) as InterviewTimelineAutomation[])
        .map((a) => (a as { template_id?: string | null }).template_id)
        .filter(Boolean))] as string[];
      const activeTemplateIds = new Set<string>();
      if (templateIds.length > 0) {
        const { data: templates } = await supabase
          .from("outreach_templates")
          .select("id")
          .in("id", templateIds)
          .eq("is_active", true);
        for (const t of templates || []) activeTemplateIds.add((t as { id: string }).id);
      }

      for (const automation of (automations || []) as InterviewTimelineAutomation[]) {
        const tplId = (automation as { template_id?: string | null }).template_id;
        if (tplId && !activeTemplateIds.has(tplId)) continue;
        const delayMs = Math.max(automation.delay_minutes ?? 0, 0) * 60 * 1000;
        const targetTime = trigger === "interview_before"
          ? new Date(now.getTime() + delayMs)
          : new Date(now.getTime() - delayMs);

        const rangeStart = new Date(targetTime.getTime() - WINDOW_PADDING_MS).toISOString();
        const rangeEnd = new Date(targetTime.getTime() + WINDOW_PADDING_MS).toISOString();

        const interviewStatuses = trigger === "interview_before" ? ["pending", "confirmed"] : ["pending", "confirmed", "completed"];

        const { data: interviews, error: interviewsError } = await supabase
          .from("interviews")
          .select("id, applicant_id, employer_id, job_id, scheduled_at, location_type, location_details, revision")
          .eq("employer_id", automation.owner_user_id)
          .in("status", interviewStatuses)
          .gte("scheduled_at", rangeStart)
          .lte("scheduled_at", rangeEnd);

        if (interviewsError) {
          console.error(`Error fetching interviews for ${trigger}:`, interviewsError);
          continue;
        }

        for (const interview of interviews || []) {
          // Revisionen gör att en ombokad intervju får en ny påminnelse –
          // utan den blockerar den redan skickade loggen alltid nya tider.
          const revision = (interview as { revision?: number }).revision ?? 0;

          const { data: existingLogs } = await supabase
            .from("outreach_dispatch_logs")
            .select("id, payload")
            .eq("automation_id", automation.id)
            .eq("interview_id", interview.id)
            .eq("recipient_user_id", interview.applicant_id)
            .eq("trigger", trigger);

          const alreadyQueued = (existingLogs || []).some((log) => {
            const payload = (log as { payload?: Record<string, unknown> | null }).payload;
            const loggedRevision = Number(payload?.revision ?? 0);
            return loggedRevision === revision;
          });

          if (alreadyQueued) continue;

          const { error: insertError } = await supabase.from("outreach_dispatch_logs").insert({
            owner_user_id: automation.owner_user_id,
            organization_id: automation.organization_id,
            automation_id: automation.id,
            template_id: automation.template_id,
            trigger,
            channel: automation.channel,
            recipient_user_id: interview.applicant_id,
            interview_id: interview.id,
            job_id: interview.job_id,
            payload: {
              source: "interview-reminders",
              queued_at: now.toISOString(),
              revision,
              delay_minutes: automation.delay_minutes,
              filters: automation.filters,
              location_type: interview.location_type,
              location_details: interview.location_details,
            },
            status: "pending",
          });


          if (!insertError) queued += 1;
        }
      }

      if (queued > 0) {
        await fetch(`${supabaseUrl}/functions/v1/outreach-dispatch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ trigger }),
        });
      }

      return queued;
    };

    // ─────────────────────────────────────────────────────────
    // PART 1: 10-minute pre-interview reminders (existing)
    // ─────────────────────────────────────────────────────────
    const nineMinutesFromNow = new Date(now.getTime() + 9 * 60 * 1000);
    const elevenMinutesFromNow = new Date(now.getTime() + 11 * 60 * 1000);

    console.log(`Looking for confirmed interviews between ${nineMinutesFromNow.toISOString()} and ${elevenMinutesFromNow.toISOString()}`);

    const { data: upcomingInterviews, error: interviewsError } = await supabase
      .from("interviews")
      .select(`
        id,
        scheduled_at,
        duration_minutes,
        location_type,
        location_details,
        subject,
        applicant_id,
        employer_id,
        job_postings(title)
      `)
      .eq("status", "confirmed")
      .gte("scheduled_at", nineMinutesFromNow.toISOString())
      .lte("scheduled_at", elevenMinutesFromNow.toISOString())
      // Fönstret är 2 minuter brett men cron kör varje minut – utan denna
      // markering skulle samma påminnelse skickas två gånger.
      .is("reminder_sent_at", null);

    if (interviewsError) {
      console.error("Error fetching interviews:", interviewsError);
      throw interviewsError;
    }

    let remindersSent = 0;
    const errors: string[] = [];

    // Arbetsgivaren äger besluten: har de stängt av "Före intervjun" helt
    // skickas ingenting till kandidaten – inte heller 10-minutersputten.
    const employerAllowsCandidateReminder = new Map<string, boolean>();
    const candidateRemindersAllowed = async (employerId: string) => {
      if (employerAllowsCandidateReminder.has(employerId)) {
        return employerAllowsCandidateReminder.get(employerId)!;
      }
      const { data } = await supabase
        .from("outreach_automations")
        .select("id")
        .eq("owner_user_id", employerId)
        .eq("trigger", "interview_before")
        .eq("recipient_type", "candidate")
        .eq("is_enabled", true)
        .limit(1);
      const allowed = (data?.length ?? 0) > 0;
      employerAllowsCandidateReminder.set(employerId, allowed);
      return allowed;
    };

    if (upcomingInterviews && upcomingInterviews.length > 0) {
      console.log(`Found ${upcomingInterviews.length} interviews to send reminders for`);

      for (const interview of upcomingInterviews as unknown as Interview[]) {
        // Claim direkt: en samtidig körning får aldrig skicka samma påminnelse.
        const { data: claimed } = await supabase
          .from("interviews")
          .update({ reminder_sent_at: now.toISOString() })
          .eq("id", interview.id)
          .is("reminder_sent_at", null)
          .select("id")
          .maybeSingle();
        if (!claimed) continue;

        const jobTitle = interview.job_postings?.title || "intervju";
        const scheduledTime = new Date(interview.scheduled_at);
        const timeString = scheduledTime.toLocaleTimeString("sv-SE", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Stockholm",
        });

        const locationInfo = interview.location_type === "video"
          ? "Videomöte"
          : interview.location_type === "office"
          ? "På plats"
          : "Telefonintervju";

        // Send reminder to candidate (only if the employer keeps it enabled)
        const candidateReminderAllowed = await candidateRemindersAllowed(interview.employer_id);
        if (!candidateReminderAllowed) {
          console.log(`Candidate reminder skipped – employer ${interview.employer_id} has interview_before off`);
        }
        try {
          if (!candidateReminderAllowed) throw { skip: true };



          const candidateResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              recipient_id: interview.applicant_id,
              title: "Intervju om 10 minuter ⏰",
              body: `Din intervju för "${jobTitle}" börjar kl ${timeString}. ${locationInfo}.`,
              data: {
                type: "interview_reminder",
                interview_id: interview.id,
                route: "/my-applications",
              },
            }),
          });
          const candidateResult = await candidateResponse.json();
          if (candidateResult.success || candidateResult.sent >= 0) {
            console.log(`Reminder sent to candidate ${interview.applicant_id}`);
            remindersSent++;
          }
        } catch (err) {
          if ((err as { skip?: boolean })?.skip) {
            // Avstängt av arbetsgivaren – inget fel, bara tyst.
          } else {
            console.error(`Error sending reminder to candidate ${interview.applicant_id}:`, err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            errors.push(`Candidate ${interview.applicant_id}: ${message}`);
          }
        }


        // Send reminder to employer
        try {
          const employerResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              recipient_id: interview.employer_id,
              title: "Intervju om 10 minuter ⏰",
              body: `Intervju för "${jobTitle}" börjar kl ${timeString}. ${locationInfo}.`,
              data: {
                type: "interview_reminder",
                interview_id: interview.id,
                route: "/employer",
              },
            }),
          });
          const employerResult = await employerResponse.json();
          if (employerResult.success || employerResult.sent >= 0) {
            console.log(`Reminder sent to employer ${interview.employer_id}`);
            remindersSent++;
          }
        } catch (err) {
          console.error(`Error sending reminder to employer ${interview.employer_id}:`, err);
          const message = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Employer ${interview.employer_id}: ${message}`);
        }
      }
    } else {
      console.log("No upcoming interviews found in the 10-minute window");
    }

    // ─────────────────────────────────────────────────────────
    // PART 2: Post-interview follow-up reminders (NEW)
    // Reminds recruiters 3 days after an interview if they
    // haven't taken action (changed candidate status).
    // ─────────────────────────────────────────────────────────
    let followupRemindersSent = 0;

    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

    // Find interviews that happened 3-4 days ago, are confirmed, 
    // and haven't had a follow-up reminder sent yet
    const { data: pastInterviews, error: pastError } = await supabase
      .from("interviews")
      .select(`
        id,
        applicant_id,
        employer_id,
        job_id,
        job_postings(title)
      `)
      .in("status", ["confirmed", "completed"])
      .gte("scheduled_at", fourDaysAgo.toISOString())
      .lte("scheduled_at", threeDaysAgo.toISOString())
      .is("followup_reminder_sent_at", null);

    if (pastError) {
      console.error("Error fetching past interviews for follow-up:", pastError);
    } else if (pastInterviews && pastInterviews.length > 0) {
      console.log(`Found ${pastInterviews.length} interviews needing follow-up reminders`);

      for (const interview of pastInterviews) {
        const jobTitle = (interview.job_postings as any)?.title || "tjänsten";

        // Claim först: samtidiga körningar får aldrig skicka dubbla påminnelser.
        const { data: claimedFollowup } = await supabase
          .from("interviews")
          .update({ followup_reminder_sent_at: now.toISOString() })
          .eq("id", interview.id)
          .is("followup_reminder_sent_at", null)
          .select("id")
          .maybeSingle();
        if (!claimedFollowup) continue;

        // Check if the recruiter has already taken action on this candidate
        // (changed status from pending/reviewed, or added to my_candidates with stage change)
        // maybeSingle: intervjun kan sakna koppling till en ansökan (manuellt tillagd kandidat).
        const { data: application } = interview.job_id
          ? await supabase
              .from("job_applications")
              .select("status")
              .eq("job_id", interview.job_id)
              .eq("applicant_id", interview.applicant_id)
              .limit(1)
              .maybeSingle()
          : { data: null };

        // If the candidate is still in "interview" status, the recruiter hasn't acted
        const needsReminder = application?.status === "interview" || application?.status === "pending" || application?.status === "reviewed";

        if (needsReminder) {
          // Get candidate name for the reminder
          const { data: candidateProfile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("user_id", interview.applicant_id)
            .maybeSingle();


          const candidateName = candidateProfile
            ? `${candidateProfile.first_name || ""} ${candidateProfile.last_name || ""}`.trim()
            : "kandidaten";

          // Send push notification to recruiter
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                recipient_id: interview.employer_id,
                title: "Dags att ge återkoppling 💬",
                body: `Det har gått 3 dagar sedan intervjun med ${candidateName} för "${jobTitle}". Ge kandidaten besked!`,
                data: {
                  type: "followup_reminder",
                  interview_id: interview.id,
                  applicant_id: interview.applicant_id,
                  route: "/employer",
                },
              }),
            });

            const result = await response.json();
            if (result.success || result.sent >= 0) {
              followupRemindersSent++;
              console.log(`Follow-up reminder sent to employer ${interview.employer_id} for candidate ${candidateName}`);
            }
          } catch (err) {
            console.error(`Error sending follow-up reminder for interview ${interview.id}:`, err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            errors.push(`Followup ${interview.id}: ${message}`);
          }
        }
      }

    }

    const beforeInterviewQueued = await queueInterviewTimelineDispatches("interview_before");
    const afterInterviewQueued = await queueInterviewTimelineDispatches("interview_after");

    console.log(`Interview reminders completed: ${remindersSent} pre-reminders, ${followupRemindersSent} follow-up reminders, ${beforeInterviewQueued} queued before-interview messages, ${afterInterviewQueued} queued after-interview messages`);

    return new Response(
      JSON.stringify({
        success: true,
        interviews_processed: upcomingInterviews?.length || 0,
        reminders_sent: remindersSent,
        followup_reminders_sent: followupRemindersSent,
        outreach_before_queued: beforeInterviewQueued,
        outreach_after_queued: afterInterviewQueued,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Interview reminders error:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
