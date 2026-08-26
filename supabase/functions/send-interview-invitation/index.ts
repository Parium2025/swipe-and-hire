import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendLoggedTemplateEmail } from '../_shared/transactional-email-templates/send-logged-email.ts'

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
  interviewId: z.string().uuid(),
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

// Mejlet renderas serverside och kan inte veta mottagarens tidszon, därför
// märks klockslaget alltid ut som svensk tid. Kalenderfilen (.ics) och
// Google Calendar-länken bär UTC och konverteras automatiskt av mottagarens
// kalender, så den som sitter utomlands får rätt lokal tid där.
const formatTime = (dateString: string): string => {
  const time = new Date(dateString).toLocaleTimeString('sv-SE', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm'
  });
  return `${time} (svensk tid)`;
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
  return await sendLoggedTemplateEmail('interview-invitation', recipientEmail, {
    idempotencyKey,
    templateData: { ...payload, is_employer: isEmployer },
  });
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === AUTH: require valid employer JWT ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    const callerId = claimsData.claims.sub as string;

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

    // Ombokning måste kunna skicka en ny kallelse – nyckeln versioneras.
    let interviewRevision = 0;

    // === AUTHORIZATION: caller MUST own the interview (or its job/org) ===
    // interviewId is required — no anonymous "send email to anyone" path.
    {
      const { data: interview } = await supabaseAdmin
        .from('interviews')
        .select('employer_id, job_id, revision')
        .eq('id', interviewId)
        .maybeSingle();
      if (!interview) {
        return new Response(
          JSON.stringify({ error: 'Interview not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      interviewRevision = (interview as { revision?: number }).revision ?? 0;
      let allowed = interview.employer_id === callerId;
      if (!allowed && interview.job_id) {
        const { data: job } = await supabaseAdmin
          .from('job_postings')
          .select('employer_id, organization_id')
          .eq('id', interview.job_id)
          .maybeSingle();
        if (job?.employer_id === callerId) allowed = true;
        else if (job?.organization_id) {
          const { data: sameOrg } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .eq('user_id', callerId)
            .eq('organization_id', job.organization_id)
            .maybeSingle();
          if (sameOrg) allowed = true;
        }
      }
      if (!allowed) {
        console.warn(`Unauthorized send-interview-invitation: caller=${callerId} interview=${interviewId}`);
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }




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

    
    const icsUrl = interviewId
      ? `${supabaseUrl}/functions/v1/download-interview-ics?id=${interviewId}`
      : '';

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
      ics_url: icsUrl,
      maps_url: mapsUrl,
    };

    const idBase = `${interviewId || `${candidateEmail}-${scheduledAt}`}-r${interviewRevision}`;

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
