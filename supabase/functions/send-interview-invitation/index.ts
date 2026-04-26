import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Input validation ──────────────────────────────────────
const RequestSchema = z.object({
  candidateEmail: z.string().email().max(320),
  candidateName: z.string().min(1).max(200),
  companyName: z.string().min(1).max(200),
  jobTitle: z.string().min(1).max(300),
  scheduledAt: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date"),
  durationMinutes: z.number().int().min(5).max(480),
  locationType: z.enum(["video", "office"]),
  locationDetails: z.string().max(2000).optional(),
  message: z.string().max(5000).optional(),
  employerEmail: z.string().email().max(320).optional(),
  employerName: z.string().max(200).optional(),
});

// ── Helpers ───────────────────────────────────────────────

const getSecondProtocolIndex = (value: string): number => {
  const lower = value.toLowerCase();
  const secondHttps = lower.indexOf('https://', 8);
  const secondHttp = lower.indexOf('http://', 7);
  const candidates = [secondHttps, secondHttp].filter((idx) => idx > 0);
  return candidates.length > 0 ? Math.min(...candidates) : -1;
};

const normalizeLocationDetails = (locationType: string, locationDetails: string): string => {
  const trimmed = (locationDetails || '').trim().replace(/^<+|>+$/g, '');
  if (!trimmed || locationType !== 'video') return trimmed;

  const secondProtocolIndex = getSecondProtocolIndex(trimmed);
  const deduped = secondProtocolIndex > 0 ? trimmed.slice(0, secondProtocolIndex) : trimmed;

  return deduped.trim();
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Stockholm' });
};

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
};

const generateGoogleCalendarUrl = (
  companyName: string, jobTitle: string, scheduledAt: string,
  durationMinutes: number, locationType: string, locationDetails: string, message: string
): string => {
  const startDate = new Date(scheduledAt);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const title = `Intervju – ${jobTitle}`;
  const locationLabel = locationType === 'video' ? 'Videointervju' : 'På plats';
  let details = `${jobTitle} hos ${companyName}\n\n${locationLabel}: ${locationDetails || 'Information meddelas'}`;
  if (message) details += `\n\n${message}`;
  const location = locationType === 'video' && locationDetails?.startsWith('http')
    ? locationDetails
    : locationType === 'office' && locationDetails ? locationDetails : locationLabel;
  const params = new URLSearchParams({
    action: 'TEMPLATE', text: title,
    dates: `${fmt(startDate)}/${fmt(endDate)}`,
    details, location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

// ── ICS generation ────────────────────────────────────────

const formatIcsDate = (date: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`;
};

const escapeIcsText = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

const generateIcsContent = (
  recipientName: string, companyName: string, jobTitle: string, scheduledAt: string,
  durationMinutes: number, locationType: string, locationDetails: string, message: string
): string => {
  const startDate = new Date(scheduledAt);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  const uid = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@parium.se`;
  const summary = escapeIcsText(`Intervju – ${jobTitle}`);
  const locationLabel = locationType === 'video' ? 'Videointervju' : 'På plats';
  const location = locationType === 'video' && locationDetails?.startsWith('http')
    ? escapeIcsText(locationDetails) : locationType === 'office' && locationDetails
    ? escapeIcsText(locationDetails) : escapeIcsText(locationLabel);
  let description = escapeIcsText(`${jobTitle} hos ${companyName}\n\n${locationLabel}: ${locationDetails || 'Information meddelas'}`);
  if (message) description += escapeIcsText(`\n\n${message}`);

  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Parium//Interview//SV',
    'CALSCALE:GREGORIAN', 'METHOD:REQUEST', 'BEGIN:VEVENT',
    `UID:${uid}`, `DTSTAMP:${formatIcsDate(new Date())}`, `DTSTART:${formatIcsDate(startDate)}`,
    `DTEND:${formatIcsDate(endDate)}`, `SUMMARY:${summary}`, `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `ORGANIZER;CN=${escapeIcsText(companyName)}:mailto:noreply@parium.se`,
    'STATUS:CONFIRMED', 'SEQUENCE:0',
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Intervju om 1 timme', 'END:VALARM',
    'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:Intervju om 10 minuter', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
};

// ── Email builder ─────────────────────────────────────────

const buildEmail = (
  recipientName: string, companyName: string, jobTitle: string, scheduledAt: string,
  durationMinutes: number, locationType: string, locationDetails: string, message: string,
  googleCalendarUrl: string, isEmployer: boolean = false
) => {
  const dateStr = formatDate(scheduledAt);
  const timeStr = formatTime(scheduledAt);
  const locationLabel = locationType === 'video' ? 'Videointervju' : 'På plats';
  const addressFirstLine = locationDetails?.split('\n')[0] || '';
  const mapsUrl = locationType === 'office' && addressFirstLine
    ? `https://maps.google.com/?q=${encodeURIComponent(addressFirstLine)}`
    : null;

  const greeting = isEmployer
    ? `Hej ${recipientName}, du har bokat en intervju för ${jobTitle}.`
    : `Hej ${recipientName}, du är kallad till intervju för ${jobTitle}.`;

  // === PLAIN TEXT VERSION ===
  let text = `${greeting}

Datum: ${dateStr}
Tid: ${timeStr} · ${durationMinutes} min
${locationLabel}: ${locationDetails || 'Information meddelas'}`;

  if (mapsUrl) text += `\nÖppna i karta: ${mapsUrl}`;
  if (locationType === 'video' && locationDetails?.startsWith('http')) text += `\n\nAnslut till videomötet: ${locationDetails}`;
  if (message && !isEmployer) text += `\n\nMeddelande inför intervjun:\n${message}`;
  if (message && isEmployer) text += `\n\nDitt meddelande till kandidaten:\n${message}`;
  text += `\n\n📅 Kalenderhändelse bifogad\nLägg till i Google Kalender: ${googleCalendarUrl}`;

  // === HTML VERSION ===
  const locationValueHtml = locationType === 'video' && locationDetails?.startsWith('http')
    ? `<a href="${locationDetails}" style="color:#1E3A8A;text-decoration:underline;word-break:break-all;">${locationDetails}</a>`
    : mapsUrl
    ? `<a href="${mapsUrl}" style="color:#1E3A8A;text-decoration:underline;">${addressFirstLine}</a>`
    : locationDetails || 'Information meddelas';

  const videoButtonHtml = locationType === 'video' && locationDetails?.startsWith('http') ? `
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:12px;">
                <tr><td align="center">
                  <a href="${locationDetails}" style="background-color:#1E3A8A;border-radius:8px;color:#ffffff;display:inline-block;font-size:14px;font-weight:600;line-height:42px;text-align:center;text-decoration:none;width:200px;">Anslut till videomötet</a>
                </td></tr>
              </table>` : '';

  const messageLabel = isEmployer ? 'Ditt meddelande till kandidaten:' : `Meddelande från ${companyName} inför intervjun:`;
  const messageHtml = message ? `
              <p style="margin:10px 0 2px;font-size:14px;color:#6B7280;font-weight:600;">${messageLabel}</p>
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;white-space:pre-line;">${message}</p>` : '';

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F4F4F5;">
<tr><td align="center" style="padding:24px 16px;">
<table border="0" cellpadding="0" cellspacing="0" width="520" style="background-color:#ffffff;border-radius:12px;max-width:520px;">
<tr><td style="padding:20px 24px;">
<p style="margin:0 0 6px;font-size:15px;color:#111827;line-height:1.4;">${greeting.replace(jobTitle, `<strong>${jobTitle}</strong>`)}</p>
<p style="margin:0;font-size:14px;color:#111827;line-height:1.7;"><strong>Datum:</strong> ${dateStr}<br/><strong>Tid:</strong> ${timeStr} · ${durationMinutes} min<br/><strong>${locationLabel}:</strong> ${locationValueHtml}</p>
${messageHtml}${videoButtonHtml}
<p style="margin:12px 0 0;font-size:12px;color:#9CA3AF;line-height:1.4;text-align:center;">📅 Kalenderhändelse bifogad · <a href="${googleCalendarUrl}" style="color:#6B7280;text-decoration:underline;">Google Kalender</a></p>
</td></tr>
<tr><td style="padding:10px 24px;text-align:center;border-top:1px solid #E5E7EB;"><p style="margin:0;font-size:11px;color:#9CA3AF;">Parium AB · Stockholm</p></td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return { text, html };
};

// ── Handler ───────────────────────────────────────────────

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const parsed = RequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      console.error("Validation error:", parsed.error.flatten().fieldErrors);
      return new Response(
        JSON.stringify({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const {
      candidateEmail, candidateName, companyName, jobTitle,
      scheduledAt, durationMinutes, locationType, locationDetails, message,
      employerEmail, employerName,
    } = parsed.data;

    const normalizedLocationDetails = normalizeLocationDetails(locationType, locationDetails || '');

    console.log(`Sending interview invitation to ${candidateEmail} for ${jobTitle} at ${companyName}`);

    const googleCalendarUrl = generateGoogleCalendarUrl(
      companyName, jobTitle, scheduledAt, durationMinutes,
      locationType, normalizedLocationDetails, message || ''
    );

    // --- Candidate email ---
    const { text, html } = buildEmail(
      candidateName, companyName, jobTitle, scheduledAt, durationMinutes,
      locationType, normalizedLocationDetails, message || '',
      googleCalendarUrl, false
    );

    const icsContent = generateIcsContent(
      candidateName, companyName, jobTitle, scheduledAt, durationMinutes,
      locationType, normalizedLocationDetails, message || ''
    );
    const icsBase64 = btoa(unescape(encodeURIComponent(icsContent)));

    const emailResponse = await resend.emails.send({
      from: `${companyName} via Parium <noreply@parium.se>`,
      to: [candidateEmail],
      subject: `Intervjukallelse: ${jobTitle} – ${companyName}`,
      text, html,
      attachments: [{
        filename: 'intervju.ics',
        content: icsBase64,
      }],
    });

    console.log("Interview invitation sent to candidate:", emailResponse);

    // --- Employer email (calendar confirmation) ---
    // Skip if employer email is the same as candidate email (avoids confusing duplicate)
    let employerEmailResponse = null;
    if (employerEmail && employerEmail.toLowerCase() !== candidateEmail.toLowerCase()) {
      try {
        const empName = employerName || companyName;

        const { text: empText, html: empHtml } = buildEmail(
          empName, companyName, jobTitle, scheduledAt, durationMinutes,
          locationType, normalizedLocationDetails, message || '',
          googleCalendarUrl, true
        );

        const empIcsContent = generateIcsContent(
          empName, companyName, jobTitle, scheduledAt, durationMinutes,
          locationType, normalizedLocationDetails, message || ''
        );
        const empIcsBase64 = btoa(unescape(encodeURIComponent(empIcsContent)));

        employerEmailResponse = await resend.emails.send({
          from: `Parium <noreply@parium.se>`,
          to: [employerEmail],
          subject: `Intervju bokad: ${jobTitle} – ${candidateName}`,
          text: empText, html: empHtml,
          attachments: [{
            filename: 'intervju.ics',
            content: empIcsBase64,
          }],
        });

        console.log("Interview confirmation sent to employer:", employerEmailResponse);
      } catch (empErr) {
        console.error("Error sending employer confirmation:", empErr);
      }
    }

    return new Response(JSON.stringify({ success: true, ...emailResponse, employerEmailSent: !!employerEmailResponse }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-interview-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
