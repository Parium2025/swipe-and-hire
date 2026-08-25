// Public endpoint that generates an .ics calendar file on demand for an interview.
// Interview UUIDs are unguessable (122 bits of entropy), so the ID acts as a capability token.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const formatIcsDate = (date: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`;
};

const escapeIcs = (text: string): string =>
  (text || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("Invalid interview id", { status: 400 });
  }

  const { data: interview, error } = await supabaseAdmin
    .from("interviews")
    .select("id, scheduled_at, duration_minutes, location_type, location_details, message, subject, job_id, employer_id, status, revision")
    .eq("id", id)
    .maybeSingle();

  if (error || !interview) {
    return new Response("Interview not found", { status: 404 });
  }

  if (interview.status === "cancelled") {
    return new Response("Interview cancelled", { status: 410 });
  }

  const [{ data: job }, { data: employerProfile }] = await Promise.all([
    supabaseAdmin.from("job_postings").select("title").eq("id", interview.job_id).maybeSingle(),
    supabaseAdmin.from("profiles").select("company_name").eq("id", interview.employer_id).maybeSingle(),
  ]);

  const jobTitle = job?.title || interview.subject || "Intervju";
  const companyName = employerProfile?.company_name || "";
  const startDate = new Date(interview.scheduled_at);
  const endDate = new Date(startDate.getTime() + (interview.duration_minutes || 30) * 60 * 1000);
  const uid = `interview-${interview.id}@parium.se`;
  const summary = escapeIcs(`Intervju – ${jobTitle}`);
  const locationLabel = interview.location_type === "video" ? "Videointervju" : "På plats";
  const locationDetails = interview.location_details || "";
  const location = interview.location_type === "video" && locationDetails.startsWith("http")
    ? escapeIcs(locationDetails)
    : locationDetails ? escapeIcs(locationDetails) : escapeIcs(locationLabel);

  let description = `${jobTitle}${companyName ? ` hos ${companyName}` : ""}\n\n${locationLabel}: ${locationDetails || "Information meddelas"}`;
  if (interview.message) description += `\n\n${interview.message}`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Parium//Interview//SV",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(startDate)}`,
    `DTEND:${formatIcsDate(endDate)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${location}`,
    companyName ? `ORGANIZER;CN=${escapeIcs(companyName)}:mailto:noreply@parium.se` : "ORGANIZER:mailto:noreply@parium.se",
    "STATUS:CONFIRMED",
    `SEQUENCE:${(interview as { revision?: number }).revision ?? 0}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Intervju om 1 timme",
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT10M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Intervju om 10 minuter",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="intervju-${interview.id.slice(0, 8)}.ics"`,
      "Cache-Control": "no-store",
    },
  });
});
