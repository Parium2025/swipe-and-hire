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
  feed: "hr" | "career" | "cron";
  severity: Severity;
  message: string;
  summary: string;
  details: Record<string, unknown>;
}

const EXPECTED_JOBS = [
  "fetch-hr-news-morning",
  "fetch-hr-news-midday",
  "fetch-hr-news-evening",
  "fetch-hr-news-night",
  "fetch-career-tips-morning",
  "fetch-career-tips-midday",
  "fetch-career-tips-evening",
  "fetch-career-tips-night",
];

const STALE_SOURCE_HOURS = 9;
const STALE_CARD_HOURS = 36;
const MIN_HEALTHY_SOURCES_PER_FEED = 2;
const TARGET_VISIBLE_ITEMS = 4;

function hoursSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return (Date.now() - time) / (1000 * 60 * 60);
}

function severityForHours(hours: number | null, warningAfter: number): Severity {
  if (hours === null) return "critical";
  return hours > warningAfter * 2 ? "critical" : "warning";
}

async function sendAlert(supabase: any, issue: Issue) {
  const { error } = await supabase.functions.invoke("send-admin-alert", {
    body: {
      type: "news_watchdog",
      error_message: issue.details.error_message || "",
      details: {
        code: issue.code,
        feed: issue.feed,
        severity: issue.severity,
        message: issue.message,
        summary: issue.summary,
        ...issue.details,
      },
    },
  });

  if (error) console.error("Failed to send watchdog alert", error);
}

async function getFeedStats(supabase: any, table: string) {
  const { data, error } = await supabase
    .from(table)
    .select("id, source, source_url, created_at, published_at")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (error) throw new Error(`${table}: ${error.message}`);

  const rows = data || [];
  const visible = rows.slice(0, TARGET_VISIBLE_ITEMS);
  const rssVisible = visible.filter((item: any) => item.source_url !== null).length;
  const aiVisible = visible.filter((item: any) => item.source_url === null).length;
  const newestCreated = rows.reduce<string | null>((latest, item: any) => {
    if (!item.created_at) return latest;
    if (!latest || new Date(item.created_at) > new Date(latest)) return item.created_at;
    return latest;
  }, null);
  const newestPublished = rows.reduce<string | null>((latest, item: any) => {
    if (!item.published_at) return latest;
    if (!latest || new Date(item.published_at) > new Date(latest)) return item.published_at;
    return latest;
  }, null);

  return {
    total: rows.length,
    visible: visible.length,
    rssVisible,
    aiVisible,
    newestCreated,
    newestPublished,
    createdAgeHours: hoursSince(newestCreated),
    publishedAgeHours: hoursSince(newestPublished),
  };
}

async function getSourceHealth(supabase: any, sourceType: "hr_news" | "career_tips") {
  const { data, error } = await supabase
    .from("rss_source_health")
    .select("source_name, source_type, is_healthy, last_success_at, last_check_at, consecutive_failures, last_error_message, last_error, is_active")
    .eq("source_type", sourceType)
    .eq("is_active", true);

  if (error) throw new Error(`rss_source_health/${sourceType}: ${error.message}`);

  const rows = data || [];
  const healthyRecent = rows.filter((source: any) => {
    const latest = source.last_check_at || source.last_success_at;
    const age = hoursSince(latest);
    return source.is_healthy === true && age !== null && age <= STALE_SOURCE_HOURS;
  });

  const newestCheck = rows.reduce<string | null>((latest: string | null, source: any) => {
    const candidate = source.last_check_at || source.last_success_at;
    if (!candidate) return latest;
    if (!latest || new Date(candidate) > new Date(latest)) return candidate;
    return latest;
  }, null);

  return {
    totalSources: rows.length,
    healthyRecent: healthyRecent.length,
    newestCheck,
    newestCheckAgeHours: hoursSince(newestCheck),
    failingSources: rows
      .filter((source: any) => (source.consecutive_failures || 0) > 0)
      .map((source: any) => `${source.source_name} (${source.consecutive_failures})`),
  };
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

    const { data: cronJobs, error: cronError } = await supabase.rpc("get_news_cron_health");
    if (cronError) {
      issues.push({
        code: "cron_health_unreadable",
        feed: "cron",
        severity: "critical",
        message: "Nyhets-watchdoggen kan inte läsa cron-status",
        summary: "Kontrollen kunde inte verifiera att schemaläggningen är korrekt.",
        details: { error_message: cronError.message },
      });
    } else {
      const jobs = cronJobs || [];
      const activeNames = new Set(jobs.filter((job: any) => job.active).map((job: any) => job.jobname));
      const missing = EXPECTED_JOBS.filter((job) => !activeNames.has(job));
      const legacy = jobs.filter((job: any) => job.jobname === "refresh-hr-news-midnight" || String(job.command || "").includes("Bearer ey"));

      if (missing.length > 0) {
        issues.push({
          code: "missing_cron_jobs",
          feed: "cron",
          severity: "critical",
          message: "Nyhetsflödets schemaläggning saknar aktiva körningar",
          summary: "Ett eller flera förväntade cron-jobb är inte aktiva.",
          details: { missing_jobs: missing },
        });
      }

      if (legacy.length > 0) {
        issues.push({
          code: "legacy_cron_job",
          feed: "cron",
          severity: "warning",
          message: "Gammal nyhets-cron ligger kvar",
          summary: "Det finns en äldre schemaläggning som inte går via den säkrade triggern.",
          details: { legacy_jobs: legacy.map((job: any) => job.jobname) },
        });
      }
    }

    const [hrStats, careerStats, hrHealth, careerHealth] = await Promise.all([
      getFeedStats(supabase, "daily_hr_news"),
      getFeedStats(supabase, "daily_career_tips"),
      getSourceHealth(supabase, "hr_news"),
      getSourceHealth(supabase, "career_tips"),
    ]);

    const checks = [
      { feed: "hr" as const, label: "arbetsgivarsidan", stats: hrStats, health: hrHealth },
      { feed: "career" as const, label: "jobbsökarsidan", stats: careerStats, health: careerHealth },
    ];

    for (const check of checks) {
      if (check.stats.visible < TARGET_VISIBLE_ITEMS) {
        issues.push({
          code: "too_few_visible_items",
          feed: check.feed,
          severity: "critical",
          message: `För få artiklar visas på ${check.label}`,
          summary: "Feeden ska alltid hålla fyra kort, med AI-fallback om RSS saknas.",
          details: { visible_items: check.stats.visible, expected: TARGET_VISIBLE_ITEMS },
        });
      }

      if (check.stats.publishedAgeHours !== null && check.stats.publishedAgeHours > STALE_CARD_HOURS) {
        issues.push({
          code: "stale_visible_articles",
          feed: check.feed,
          severity: severityForHours(check.stats.publishedAgeHours, STALE_CARD_HOURS),
          message: `Artiklarna på ${check.label} är för gamla`,
          summary: "Senaste synliga artikel är äldre än förväntat trots flera dagliga hämtningar.",
          details: {
            newest_published_at: check.stats.newestPublished,
            age_hours: Math.round(check.stats.publishedAgeHours),
            rss_visible: check.stats.rssVisible,
            ai_visible: check.stats.aiVisible,
          },
        });
      }

      if (check.health.healthyRecent < MIN_HEALTHY_SOURCES_PER_FEED) {
        issues.push({
          code: "too_few_recent_sources",
          feed: check.feed,
          severity: severityForHours(check.health.newestCheckAgeHours, STALE_SOURCE_HOURS),
          message: `För få RSS-källor har hämtats nyligen på ${check.label}`,
          summary: "Det här fångar felet som cron-status ensam missar: att själva källhämtningen inte faktiskt gått igenom.",
          details: {
            healthy_recent_sources: check.health.healthyRecent,
            minimum_expected: MIN_HEALTHY_SOURCES_PER_FEED,
            newest_source_check: check.health.newestCheck,
            age_hours: check.health.newestCheckAgeHours === null ? null : Math.round(check.health.newestCheckAgeHours),
            failing_sources: check.health.failingSources,
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
        stats: { hr: hrStats, career: careerStats },
        source_health: { hr: hrHealth, career: careerHealth },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("news-health-watchdog fatal error", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});