// App Exception Watchdog — larmar när riktiga användare får fel i produktion.
// Läser app_exceptions (som klienten skriver via record_app_exception) och
// mejlar dig via send-admin-alert när något faktiskt smäller.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireServiceRoleOrCronSecret } from "../_shared/service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Hur långt bakåt vi tittar vid varje körning (cron kör var 15:e minut). */
const WINDOW_MINUTES = 20;
/** Ett enstaka fel hos en användare ska inte väcka dig mitt i natten. */
const MIN_OCCURRENCES = 3;
/** Samma fel hos flera olika användare är alltid allvarligt. */
const MIN_AFFECTED_USERS = 2;

interface Group {
  fingerprint: string;
  title: string;
  message: string;
  route: string;
  kind: string;
  severity: string;
  occurrences: number;
  users: Set<string>;
  httpStatus: number | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authResp = await requireServiceRoleOrCronSecret(req, corsHeaders);
  if (authResp) return authResp;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from("app_exceptions")
      .select(
        "fingerprint, title, message, route, kind, severity, http_status, occurrence_count, owner_user_id, last_seen_at, environment",
      )
      .gte("last_seen_at", since)
      .order("last_seen_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("Could not read app_exceptions:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groups = new Map<string, Group>();
    for (const row of rows || []) {
      // Utvecklings- och preview-brus ska aldrig larma.
      if (row.environment && row.environment !== "production") continue;
      const key = row.fingerprint || `${row.kind}:${row.title}`;
      const existing = groups.get(key);
      if (existing) {
        existing.occurrences += row.occurrence_count || 1;
        if (row.owner_user_id) existing.users.add(row.owner_user_id);
        continue;
      }
      groups.set(key, {
        fingerprint: key,
        title: row.title || "Appfel",
        message: row.message || "",
        route: row.route || "/",
        kind: row.kind || "runtime_error",
        severity: row.severity || "critical",
        occurrences: row.occurrence_count || 1,
        users: new Set(row.owner_user_id ? [row.owner_user_id] : []),
        httpStatus: row.http_status ?? null,
      });
    }

    const alerts = [...groups.values()].filter(
      (group) =>
        group.severity === "critical" &&
        (group.occurrences >= MIN_OCCURRENCES || group.users.size >= MIN_AFFECTED_USERS),
    );

    // Ta de värsta först så dygnstaket används på rätt saker.
    alerts.sort((a, b) => b.users.size - a.users.size || b.occurrences - a.occurrences);

    let sent = 0;
    for (const group of alerts.slice(0, 5)) {
      const { error: invokeError } = await supabase.functions.invoke("send-admin-alert", {
        body: {
          type: "app_exception",
          error_message: group.message.slice(0, 500),
          details: {
            message: group.title,
            summary: `${group.occurrences} fel på ${group.users.size || 1} användare de senaste ${WINDOW_MINUTES} minuterna.`,
            fingerprint: group.fingerprint,
            route: group.route,
            kind: group.kind,
            http_status: group.httpStatus,
            occurrences: group.occurrences,
            affected_users: group.users.size,
          },
        },
      });
      if (invokeError) console.error("Failed to send app exception alert", invokeError);
      else sent += 1;
    }

    return new Response(
      JSON.stringify({ success: true, groups: groups.size, alerts: alerts.length, sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("app-exception-watchdog failed:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
