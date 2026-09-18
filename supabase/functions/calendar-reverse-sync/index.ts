// Omvänd kalendersynk: om bokaren (arbetsgivaren) flyttar intervjuevented
// direkt i sin Google- eller Outlook-kalender uppdateras intervjun i appen.
// Befintliga databastriggers tar då över: aktivitetsloggen får en
// "interview_rescheduled"-post, kandidaten notifieras och utskick/kalender-
// synk för kandidaten köas om. Körs som cron var femte minut.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { requireServiceRoleOrCronSecret } from "../_shared/service-auth.ts";
import { getConnectionForUser } from "../_shared/appUserConnections.ts";
import { callAsAppUser } from "../_shared/appUserConnector.ts";
import { GATEWAY_BASE_URL, scopesForConnector, type SupportedConnector } from "../_shared/appUserScopes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEOUT_MS = 10_000;
// Max antal intervjuer per körning — håller körningen kort och snäll mot API:erna.
const MAX_INTERVIEWS_PER_RUN = 25;
// Minsta skillnad för att räknas som flyttad tid (skyddar mot avrundningsbrus).
const MIN_DIFF_MS = 60_000;

interface UpcomingInterview {
  id: string;
  employer_id: string;
  scheduled_at: string;
  duration_minutes: number | null;
}

const icalUid = (interviewId: string) => `parium-interview-${interviewId}-employer@parium.se`;
const transactionId = (interviewId: string) => `parium-interview-${interviewId}-employer`;

async function connectorRequest(
  connectionAPIKey: string,
  connectorId: SupportedConnector,
  path: string,
) {
  return callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId,
    path,
    init: { method: "GET", signal: AbortSignal.timeout(TIMEOUT_MS) },
    requiredScopes: scopesForConnector(connectorId),
  });
}

/** Hämtar eventets starttid (epoch ms) ur bokarens kalender, eller null. */
async function fetchCalendarStart(
  connectionAPIKey: string,
  connectorId: SupportedConnector,
  interviewId: string,
): Promise<number | null> {
  if (connectorId === "google_calendar") {
    const query = new URLSearchParams({
      iCalUID: icalUid(interviewId),
      maxResults: "5",
      showDeleted: "false",
    });
    const res = await connectorRequest(
      connectionAPIKey,
      connectorId,
      `/calendar/v3/calendars/primary/events?${query}`,
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => null) as {
      items?: Array<{ status?: string; start?: { dateTime?: string; date?: string } }>;
    } | null;
    const item = (data?.items ?? []).find((i) => i.status !== "cancelled");
    const startIso = item?.start?.dateTime ?? null;
    if (!startIso) return null;
    const ms = new Date(startIso).getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  const filter = `transactionId eq '${transactionId(interviewId)}'`;
  const res = await connectorRequest(
    connectionAPIKey,
    connectorId,
    `/v1.0/me/events?$filter=${encodeURIComponent(filter)}&$top=5&$select=start`,
  );
  if (!res.ok) return null;
  const data = await res.json().catch(() => null) as {
    value?: Array<{ start?: { dateTime?: string; timeZone?: string } }>;
  } | null;
  const start = data?.value?.[0]?.start;
  if (!start?.dateTime) return null;
  // Graph returnerar tider utan offset i angiven timeZone (UTC om inget annat begärts).
  const raw = start.dateTime;
  const iso = /Z|[+-]\d{2}:?\d{2}$/.test(raw)
    ? raw
    : `${raw}${(start.timeZone ?? "UTC").toUpperCase() === "UTC" ? "Z" : ""}`;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const authResp = await requireServiceRoleOrCronSecret(req, corsHeaders);
  if (authResp) return authResp;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Single-flight-lås så körningar aldrig staplas på varandra.
  const { data: gotLock } = await supabase.rpc("try_claim_job_lock", {
    _key: "calendar-reverse-sync",
    _ttl_seconds: 280,
  });
  if (gotLock !== true) {
    return new Response(JSON.stringify({ skipped: true, reason: "run_in_progress" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: interviews, error } = await supabase
      .from("interviews")
      .select("id, employer_id, scheduled_at, duration_minutes")
      .eq("status", "pending")
      .gt("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(MAX_INTERVIEWS_PER_RUN);
    if (error) throw error;

    const upcoming = (interviews ?? []) as UpcomingInterview[];
    if (upcoming.length === 0) {
      return new Response(JSON.stringify({ checked: 0, updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Slå upp kalenderkoppling en gång per arbetsgivare.
    const connectionCache = new Map<
      string,
      { connectorId: SupportedConnector; connectionAPIKey: string } | null
    >();
    async function connectionFor(employerId: string) {
      if (connectionCache.has(employerId)) return connectionCache.get(employerId)!;
      let found: { connectorId: SupportedConnector; connectionAPIKey: string } | null = null;
      for (const connectorId of ["google_calendar", "microsoft_outlook"] as const) {
        try {
          const conn = await getConnectionForUser(employerId, connectorId);
          if (conn) {
            found = { connectorId, connectionAPIKey: conn.connectionAPIKey };
            break;
          }
        } catch (e) {
          console.error("Omvänd synk: kunde inte läsa koppling", employerId, e);
        }
      }
      connectionCache.set(employerId, found);
      return found;
    }

    let checked = 0;
    let updated = 0;

    for (const interview of upcoming) {
      const connection = await connectionFor(interview.employer_id);
      if (!connection) continue;
      checked++;

      let calendarStartMs: number | null = null;
      try {
        calendarStartMs = await fetchCalendarStart(
          connection.connectionAPIKey,
          connection.connectorId,
          interview.id,
        );
      } catch (e) {
        console.error("Omvänd synk: kunde inte läsa event", interview.id, e);
        continue;
      }
      if (calendarStartMs === null) continue; // inget event / borttaget → rör inte bokningen

      const appStartMs = new Date(interview.scheduled_at).getTime();
      if (!Number.isFinite(appStartMs)) continue;
      if (Math.abs(calendarStartMs - appStartMs) < MIN_DIFF_MS) continue;
      if (calendarStartMs <= Date.now()) continue; // flyttad bakåt i tiden — hoppa över

      const newScheduledAt = new Date(calendarStartMs).toISOString();
      const { error: updateError } = await supabase
        .from("interviews")
        .update({ scheduled_at: newScheduledAt })
        .eq("id", interview.id)
        .eq("scheduled_at", interview.scheduled_at); // optimistiskt: rör inte rader som hunnit ändras
      if (updateError) {
        console.error("Omvänd synk: kunde inte uppdatera intervju", interview.id, updateError);
        continue;
      }
      updated++;
      console.log(
        `Omvänd synk: intervju ${interview.id} flyttad i ${connection.connectorId} → ${newScheduledAt}`,
      );
    }

    return new Response(JSON.stringify({ checked, updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Omvänd kalendersynk misslyckades", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
