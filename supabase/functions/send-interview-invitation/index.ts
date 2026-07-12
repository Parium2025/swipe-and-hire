import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  interviewId: z.string().uuid().optional(),
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
  return new Date(dateString).toLocaleDateString('sv-SE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Stockholm'
  });
};

const formatTime = (dateString: string): string => {
  return new Date(dateString).toLocaleTimeString('sv-SE', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm'
  });
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

const enqueueInvitation = async (
  recipientEmail: string, isEmployer: boolean, payload: Record<string, any>, idempotencyKey: string
) => {
  const { data, error } = await supabaseAdmin.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'interview-invitation',
      recipientEmail,
      idempotencyKey,
      templateData: { ...payload, is_employer: isEmployer },
    },
  });
  if (error) throw new Error(error.message || 'send-transactional-email failed');
  return data;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const parsed = RequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const {
      candidateEmail, candidateName, companyName, jobTitle,
      scheduledAt, durationMinutes, locationType, locationDetails, message,
      employerEmail, employerName, interviewId,
    } = parsed.data;

    const normalizedLocationDetails = normalizeLocationDetails(locationType, locationDetails || '');
    const dateStr = formatDate(scheduledAt);
    const timeStr = formatTime(scheduledAt);
    const addressFirstLine = normalizedLocationDetails?.split('\n')[0] || '';
    const mapsUrl = locationType === 'office' && addressFirstLine
      ? `https://maps.google.com/?q=${encodeURIComponent(addressFirstLine)}`
      : '';
    const googleCalendarUrl = generateGoogleCalendarUrl(
      companyName, jobTitle, scheduledAt, durationMinutes,
      locationType, normalizedLocationDetails, message || ''
    );

    const baseData = {
      company_name: companyName,
      job_title: jobTitle,
      date_str: dateStr,
      time_str: timeStr,
      duration_minutes: durationMinutes,
      location_type: locationType,
      location_details: normalizedLocationDetails,
      message: message || '',
      google_calendar_url: googleCalendarUrl,
      maps_url: mapsUrl,
    };

    const idBase = interviewId || `${candidateEmail}-${scheduledAt}`;

    // Candidate email — respect notification preference
    let candidateResult: any = { skipped: false };
    let candidateAllowed = true;
    try {
      const { data: allowed } = await supabaseAdmin.rpc('is_email_notification_enabled', {
        p_email: candidateEmail,
        p_type: 'interview_scheduled',
      });
      candidateAllowed = allowed !== false;
    } catch (prefErr) {
      console.warn('Preference check failed, defaulting to send:', prefErr);
    }

    if (candidateAllowed) {
      candidateResult = await enqueueInvitation(
        candidateEmail,
        false,
        { ...baseData, recipient_name: candidateName },
        `interview-candidate-${idBase}`,
      );
    } else {
      candidateResult = { skipped: 'email_disabled' };
    }

    // Employer confirmation (if different address)
    let employerResult: any = null;
    if (employerEmail && employerEmail.toLowerCase() !== candidateEmail.toLowerCase()) {
      try {
        employerResult = await enqueueInvitation(
          employerEmail,
          true,
          { ...baseData, recipient_name: employerName || companyName },
          `interview-employer-${idBase}`,
        );
      } catch (empErr) {
        console.error("Error enqueueing employer confirmation:", empErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, candidate: candidateResult, employer: employerResult }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-interview-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
