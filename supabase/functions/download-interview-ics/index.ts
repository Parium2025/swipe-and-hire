// Genererar en .ics-fil för en intervju. Åtkomst kräver antingen en signerad
// länk (mejlen) eller en inloggad deltagare i mötet — intervju-id ensamt
// räcker inte.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { icsSignatureValid } from "../_shared/icsLink.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

/**
 * RFC 5545: rader får vara max 75 oktetter. Långa meddelanden bröt tidigare
 * kalenderfilen i Outlook/Google. Vi viker på oktettgräns så att UTF-8-tecken
 * (å, ä, ö) aldrig delas mitt itu.
 */
const foldIcsLine = (line: string): string => {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (currentBytes + size > limit) {
      out.push(current);
      current = "";
      currentBytes = 0;
      limit = 74; // efterföljande rader inleds med ett mellanslag
    }
    current += char;
    currentBytes += size;
  }
  if (current) out.push(current);

  return out.map((part, idx) => (idx === 0 ? part : ` ${part}`)).join("\r\n");
};


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("Invalid interview id", { status: 400, headers: corsHeaders });
  }

  const { data: interview, error } = await supabaseAdmin
    .from("interviews")
    .select("id, scheduled_at, duration_minutes, location_type, location_details, message, subject, job_id, employer_id, applicant_id, status, revision")
    .eq("id", id)
    .maybeSingle();

  if (error || !interview) {
    return new Response("Interview not found", { status: 404, headers: corsHeaders });
  }

  // === ÅTKOMST ===
  // (a) signerad länk från våra egna mejl, eller
  // (b) inloggad deltagare i mötet (kandidat eller arbetsgivare).
  let allowed = await icsSignatureValid(id, url.searchParams.get("sig"));
  if (!allowed) {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: `Bearer ${token}` } } },
      );
      const { data: claims } = await authClient.auth.getClaims(token);
      const uid = claims?.claims?.sub as string | undefined;
      allowed = !!uid && (uid === interview.employer_id || uid === interview.applicant_id);
    }
  }
  if (!allowed) {
    return new Response("Not authorized", { status: 403, headers: corsHeaders });
  }

  // Avbokad intervju får aldrig hamna i någons kalender. En nekad intervju
  // ligger kvar – historik och statistik ska inte försvinna – men märks upp.
  if (interview.status === "cancelled") {
    return new Response("Interview cancelled", { status: 410 });
  }

  // job_id saknas för manuellt tillagda kandidater – fråga bara när det finns.
  const [{ data: job }, { data: employerProfile }] = await Promise.all([
    interview.job_id
      ? supabaseAdmin.from("job_postings").select("title").eq("id", interview.job_id).maybeSingle()
      : Promise.resolve({ data: null as { title?: string } | null }),
    supabaseAdmin.from("profiles").select("company_name").eq("id", interview.employer_id).maybeSingle(),
  ]);

  const jobTitle = job?.title || interview.subject || "Intervju";
  const companyName = employerProfile?.company_name || "";
  const startDate = new Date(interview.scheduled_at);
  const endDate = new Date(startDate.getTime() + (interview.duration_minutes || 30) * 60 * 1000);
  const uid = `interview-${interview.id}@parium.se`;
  const statusPrefix = interview.status === "declined" ? "Nekad – " : "";
  const summary = escapeIcs(`${statusPrefix}Intervju – ${jobTitle}`);
  const locationLabel = interview.location_type === "video" ? "Videointervju" : "På plats";
  const locationDetails = interview.location_details || "";
  const location = locationDetails ? escapeIcs(locationDetails) : escapeIcs(locationLabel);

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
    interview.status === "confirmed" ? "STATUS:CONFIRMED" : "STATUS:TENTATIVE",
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
  ].map(foldIcsLine).join("\r\n");


  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="intervju-${interview.id.slice(0, 8)}.ics"`,
      "Cache-Control": "no-store",
    },
  });
});
