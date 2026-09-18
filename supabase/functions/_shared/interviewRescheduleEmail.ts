// Skickar ett tydligt "ny tid"-mejl till kandidaten så fort en intervjutid
// ändras — oavsett om arbetsgivaren bokar om i appen eller flyttar mötet
// direkt i sin Google-/Outlook-kalender. Idempotent per revision, så samma
// ändring aldrig kan ge två mejl.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendLoggedTemplateEmail } from "./transactional-email-templates/send-logged-email.ts";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("sv-SE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "Europe/Stockholm",
  });

const formatTime = (value: string) =>
  `${new Date(value).toLocaleTimeString("sv-SE", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm",
  })} (svensk tid)`;

function googleCalendarUrl(
  jobTitle: string, companyName: string, scheduledAt: string,
  durationMinutes: number, locationType: string, locationDetails: string,
): string {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const locationLabel = locationType === "video" ? "Videointervju" : "På plats";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Intervju – ${jobTitle}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `${jobTitle} hos ${companyName}\n\n${locationLabel}: ${locationDetails || "Information meddelas"}`,
    location: locationDetails || locationLabel,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export async function sendInterviewRescheduleEmail(
  interviewId: string,
  oldScheduledAt: string | null,
): Promise<Record<string, unknown>> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("id, applicant_id, employer_id, job_id, scheduled_at, duration_minutes, location_type, location_details, status, revision")
    .eq("id", interviewId)
    .maybeSingle();
  if (error) throw error;
  if (!interview) return { skipped: "interview_not_found" };
  if (!["pending", "confirmed"].includes(interview.status)) return { skipped: "status_not_active" };
  if (new Date(interview.scheduled_at).getTime() <= Date.now()) return { skipped: "in_the_past" };

  const [{ data: candidate }, { data: employer }, jobResult] = await Promise.all([
    supabase.from("profiles").select("email, first_name, last_name").eq("user_id", interview.applicant_id).maybeSingle(),
    supabase.from("profiles").select("company_name").eq("user_id", interview.employer_id).maybeSingle(),
    interview.job_id
      ? supabase.from("job_postings").select("title").eq("id", interview.job_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const job = (jobResult as { data: { title?: string } | null }).data;

  const candidateEmail = candidate?.email as string | undefined;
  if (!candidateEmail) return { skipped: "no_candidate_email" };

  const candidateName = [candidate?.first_name, candidate?.last_name].filter(Boolean).join(" ") || "där";
  const companyName = (employer?.company_name as string | null) || "Parium";
  const jobTitle = job?.title || "tjänsten";

  // Respektera kandidatens mejlinställning för intervjuutskick.
  try {
    const { data: allowed } = await supabase.rpc("is_email_notification_enabled", {
      p_email: candidateEmail,
      p_type: "interview_scheduled",
    });
    if (allowed === false) return { skipped: "email_disabled" };
  } catch (prefErr) {
    console.warn("Kunde inte läsa mejlinställning, skickar ändå:", prefErr);
  }

  // Nytt svarstoken per ändring: gamla ja/nej-länkar slutar gälla så att ett
  // svar alltid hör ihop med den tid kandidaten faktiskt fick.
  const nowIso = new Date().toISOString();
  await supabase
    .from("interview_email_tokens")
    .update({ expires_at: nowIso })
    .eq("interview_id", interviewId)
    .is("used_at", null)
    .gt("expires_at", nowIso);

  const { data: created } = await supabase
    .from("interview_email_tokens")
    .insert({ interview_id: interviewId, applicant_id: interview.applicant_id })
    .select("token")
    .single();
  const token = created?.token as string | undefined;
  const responseBase = token
    ? `https://parium.se/intervjusvar?token=${encodeURIComponent(token)}`
    : null;

  const duration = interview.duration_minutes ?? 30;
  const locationDetails = (interview.location_details as string | null) ?? "";
  const locationType = interview.location_type === "office" ? "office" : "video";

  const result = await sendLoggedTemplateEmail("interview-rescheduled", candidateEmail, {
    idempotencyKey: `interview-reschedule-${interviewId}-r${interview.revision ?? 0}`,
    fromName: `${companyName} via Parium`,
    templateData: {
      recipient_name: candidateName,
      company_name: companyName,
      job_title: jobTitle,
      old_date_str: oldScheduledAt ? formatDate(oldScheduledAt) : "",
      old_time_str: oldScheduledAt ? formatTime(oldScheduledAt) : "",
      date_str: formatDate(interview.scheduled_at),
      time_str: formatTime(interview.scheduled_at),
      duration_minutes: duration,
      location_type: locationType,
      location_details: locationDetails,
      maps_url: locationType === "office" && locationDetails
        ? `https://maps.google.com/?q=${encodeURIComponent(locationDetails.split("\n")[0])}`
        : "",
      google_calendar_url: googleCalendarUrl(
        jobTitle, companyName, interview.scheduled_at, duration, locationType, locationDetails,
      ),
      ics_url: `${supabaseUrl}/functions/v1/download-interview-ics?id=${interviewId}`,
      accept_url: responseBase ? `${responseBase}&answer=yes` : undefined,
      decline_url: responseBase ? `${responseBase}&answer=no` : undefined,
    },
  });

  console.log(`Ny tid-mejl för intervju ${interviewId} (rev ${interview.revision ?? 0}):`, result);
  return { ok: true, result };
}
