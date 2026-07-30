import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireServiceRoleOrCronSecret } from "../_shared/service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Severity = "warning" | "critical";

interface Issue {
  code: string;
  severity: Severity;
  message: string;
  summary: string;
  details: Record<string, unknown>;
}

/**
 * GDPR- och driftkritiska schemalagda jobb.
 * maxAgeHours = hur länge det får gå mellan körningar innan vi larmar.
 * Nyhetsjobben bevakas separat av news-health-watchdog.
 */
const CRITICAL_JOBS: Array<{ name: string; maxAgeHours: number; why: string }> = [
  {
    name: "data-retention-nightly",
    maxAgeHours: 36,
    why: "Automatisk radering av gammal persondata (gallringsfristerna i integritetspolicyn).",
  },
  {
    name: "inactive-account-retention-daily",
    maxAgeHours: 36,
    why: "Varningar och radering av inaktiva konton efter 365 dagar.",
  },
  {
    name: "purge-deleted-jobs-nightly",
    maxAgeHours: 36,
    why: "Slutlig radering av borttagna annonser och tillhörande ansökningar.",
  },
  {
    name: "purge-orphaned-media-weekly",
    maxAgeHours: 24 * 9,
    why: "Städning av föräldralösa filer (CV, bilder, video) i lagringen.",
  },
  {
    name: "cleanup-expired-email-confirmations",
    maxAgeHours: 36,
    why: "Rensning av utgångna bekräftelse-tokens.",
  },
  {
    name: "job-expiration-notifications-daily",
    maxAgeHours: 36,
    why: "Aviseringar till arbetsgivare om annonser som går ut.",
  },
  {
    name: "process-cv-queue-every-minute",
    maxAgeHours: 2,
    why: "Bearbetning av uppladdade CV:n.",
  },
  {
    name: "interview-reminders-every-minute",
    maxAgeHours: 2,
    why: "Påminnelser om bokade intervjuer.",
  },
];

/** Bevisad körning, inte bara "cron skickade iväg anropet". */
const RETENTION_EVIDENCE_MAX_AGE_HOURS = 36;

function hoursSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return (Date.now() - time) / (1000 * 60 * 60);
}

async function sendAlert(supabase: any, issue: Issue) {
  const { error } = await supabase.functions.invoke("send-admin-alert", {
    body: {
      type: "cron_watchdog",
      error_message: String(issue.details.error_message ?? ""),
      details: {
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        summary: issue.summary,
        ...issue.details,
      },
    },
  });
  if (error) console.error("Failed to send cron watchdog alert", error);
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

    const issues: Issue[] = [];

    // 1) Schemaläggningens status
    const { data: jobs, error: jobsError } = await supabase.rpc("get_cron_job_health");

    if (jobsError) {
      issues.push({
        code: "cron_health_unreadable",
        severity: "critical",
        message: "Watchdoggen kan inte läsa status för schemalagda jobb",
        summary:
          "Vi kan inte verifiera att den automatiska raderingen av persondata faktiskt körs.",
        details: { error_message: jobsError.message },
      });
    } else {
      const byName = new Map<string, any>((jobs || []).map((j: any) => [j.jobname, j]));

      for (const expected of CRITICAL_JOBS) {
        const job = byName.get(expected.name);

        if (!job) {
          issues.push({
            code: "critical_cron_missing",
            severity: "critical",
            message: `Det schemalagda jobbet "${expected.name}" saknas helt`,
            summary: expected.why,
            details: { jobname: expected.name },
          });
          continue;
        }

        if (!job.active) {
          issues.push({
            code: "critical_cron_inactive",
            severity: "critical",
            message: `Det schemalagda jobbet "${expected.name}" är avstängt`,
            summary: expected.why,
            details: { jobname: expected.name, schedule: job.schedule },
          });
          continue;
        }

        const age = hoursSince(job.last_success_at);
        if (age === null || age > expected.maxAgeHours) {
          issues.push({
            code: "critical_cron_stale",
            severity: "critical",
            message: `Det schemalagda jobbet "${expected.name}" har inte lyckats på för länge`,
            summary: expected.why,
            details: {
              jobname: expected.name,
              schedule: job.schedule,
              last_success_at: job.last_success_at,
              last_run_at: job.last_run_at,
              last_status: job.last_status,
              age_hours: age === null ? null : Math.round(age),
              max_age_hours: expected.maxAgeHours,
            },
          });
        } else if (job.last_status === "failed") {
          issues.push({
            code: "critical_cron_last_run_failed",
            severity: "warning",
            message: `Senaste körningen av "${expected.name}" misslyckades`,
            summary: expected.why,
            details: {
              jobname: expected.name,
              last_run_at: job.last_run_at,
              last_success_at: job.last_success_at,
            },
          });
        }
      }
    }

    // 2) Bevis på att gallringen faktiskt utförde arbete (inte bara startade)
    const { data: retentionRuns, error: retentionError } = await supabase
      .from("data_retention_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (retentionError) {
      issues.push({
        code: "retention_evidence_unreadable",
        severity: "warning",
        message: "Kan inte läsa loggen över genomförda gallringar",
        summary: "Vi saknar bevis på att den automatiska raderingen genomförts.",
        details: { error_message: retentionError.message },
      });
    } else {
      const lastRun = retentionRuns?.[0];
      const age = hoursSince(lastRun?.created_at);
      if (!lastRun || age === null || age > RETENTION_EVIDENCE_MAX_AGE_HOURS) {
        issues.push({
          code: "retention_evidence_stale",
          severity: "critical",
          message: "Ingen genomförd gallring har loggats på över ett dygn",
          summary:
            "Cron kan rapportera att anropet skickats även om själva raderingen aldrig utfördes. Det här fångar den skillnaden.",
          details: {
            last_run_at: lastRun?.created_at ?? null,
            age_hours: age === null ? null : Math.round(age),
            max_age_hours: RETENTION_EVIDENCE_MAX_AGE_HOURS,
          },
        });
      }
    }

    await Promise.all(issues.map((issue) => sendAlert(supabase, issue)));

    return new Response(
      JSON.stringify({
        ok: issues.length === 0,
        issues,
        checked_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("cron-health-watchdog fatal error", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
