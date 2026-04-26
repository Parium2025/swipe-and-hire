import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

type ScenarioName = 'search' | 'match' | 'chat';
type Outcome = 'ok' | 'error' | 'skipped';

type LoadUser = { email: string; password: string };

type Sample = {
  scenario: ScenarioName;
  outcome: Outcome;
  ms: number;
  label?: string;
  error?: string;
};

type ScenarioConfig = {
  weight: number;
  run: (ctx: VirtualUserContext) => Promise<void>;
};

type VirtualUserContext = {
  id: number;
  client: SupabaseClient;
  authenticated: boolean;
  record: (sample: Omit<Sample, 'scenario'> & { scenario: ScenarioName }) => void;
  pick: <T>(items: T[]) => T;
};

const envFile = readEnvFile('.env');
const env = (name: string, fallback = '') => process.env[name] || envFile[name] || fallback;

const SUPABASE_URL = env('VITE_SUPABASE_URL') || env('SUPABASE_URL');
const SUPABASE_ANON_KEY = env('VITE_SUPABASE_PUBLISHABLE_KEY') || env('VITE_SUPABASE_ANON_KEY') || env('SUPABASE_ANON_KEY');
const TARGET_URL = env('PARIUM_LOAD_TEST_TARGET', 'https://parium.se');
const ALLOW_PRODUCTION = env('PARIUM_LOAD_TEST_ALLOW_PRODUCTION') === 'true';
const ENABLE_WRITES = env('PARIUM_LOAD_TEST_ENABLE_WRITES') === 'true';
const VIRTUAL_USERS = toInt(env('PARIUM_LOAD_TEST_USERS_COUNT', '100'), 100);
const DURATION_SECONDS = toInt(env('PARIUM_LOAD_TEST_DURATION_SECONDS', '120'), 120);
const RAMP_SECONDS = toInt(env('PARIUM_LOAD_TEST_RAMP_SECONDS', '20'), 20);
const THINK_MS_MIN = toInt(env('PARIUM_LOAD_TEST_THINK_MS_MIN', '250'), 250);
const THINK_MS_MAX = toInt(env('PARIUM_LOAD_TEST_THINK_MS_MAX', '1500'), 1500);
const REPORT_DIR = env('PARIUM_LOAD_TEST_REPORT_DIR', '/mnt/documents/load-tests');
const AUTH_USERS = parseUsers(env('PARIUM_LOAD_TEST_AUTH_USERS', ''));

const searchQueries = ['säljare', 'utvecklare', 'lager', 'kundtjänst', 'ekonomi', 'projektledare', 'chaufför', ''];
const cities = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', ''];
const categories = ['Försäljning', 'IT', 'Administration', 'Transport', ''];

const samples: Sample[] = [];
const startedAt = new Date();

main().catch((error) => {
  console.error('\nLoad test failed before completion:');
  console.error(error);
  process.exit(1);
});

async function main() {
  validateConfig();

  console.log('Parium load test');
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Virtual users: ${VIRTUAL_USERS}`);
  console.log(`Duration: ${DURATION_SECONDS}s, ramp: ${RAMP_SECONDS}s`);
  console.log(`Authenticated users configured: ${AUTH_USERS.length}`);
  console.log(`Writes enabled: ${ENABLE_WRITES ? 'yes' : 'no (safe read-only mode)'}`);
  console.log('Scenarios: search, match, chat\n');

  const baseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-parium-load-test': 'true' } },
  });

  const authenticatedClients = await signInUsers(AUTH_USERS);
  const deadline = Date.now() + DURATION_SECONDS * 1000;
  const scenarios = createScenarios();

  const workers = Array.from({ length: VIRTUAL_USERS }, async (_, index) => {
    if (RAMP_SECONDS > 0) {
      await sleep((index / Math.max(VIRTUAL_USERS, 1)) * RAMP_SECONDS * 1000);
    }

    const authedClient = authenticatedClients[index % Math.max(authenticatedClients.length, 1)];
    const ctx: VirtualUserContext = {
      id: index + 1,
      client: authedClient || baseClient,
      authenticated: Boolean(authedClient),
      record: (sample) => samples.push(sample),
      pick: (items) => items[Math.floor(Math.random() * items.length)],
    };

    while (Date.now() < deadline) {
      const scenario = pickWeighted(scenarios);
      await scenario.run(ctx);
      await sleep(randomInt(THINK_MS_MIN, THINK_MS_MAX));
    }
  });

  await Promise.all(workers);
  const report = buildReport();
  printReport(report);
  writeReport(report);
}

function createScenarios(): Record<ScenarioName, ScenarioConfig> {
  return {
    search: { weight: 50, run: timed('search', runSearchScenario) },
    match: { weight: 30, run: timed('match', runMatchScenario) },
    chat: { weight: 20, run: timed('chat', runChatScenario) },
  };
}

function timed(scenario: ScenarioName, fn: (ctx: VirtualUserContext) => Promise<string | undefined>) {
  return async (ctx: VirtualUserContext) => {
    const start = performance.now();
    try {
      const label = await fn(ctx);
      ctx.record({ scenario, outcome: label === 'skipped' ? 'skipped' : 'ok', ms: performance.now() - start, label });
    } catch (error) {
      ctx.record({ scenario, outcome: 'error', ms: performance.now() - start, error: normalizeError(error) });
    }
  };
}

async function runSearchScenario(ctx: VirtualUserContext): Promise<string> {
  const query = ctx.pick(searchQueries);
  const city = ctx.pick(cities);
  const category = ctx.pick(categories);
  const { error } = await ctx.client.rpc('search_jobs', {
    p_search_query: query || null,
    p_city: city || null,
    p_county: null,
    p_employment_types: null,
    p_category: category || null,
    p_salary_min: null,
    p_salary_max: null,
    p_limit: 20,
    p_offset: 0,
    p_cursor_created_at: null,
    p_employer_ids: null,
    p_created_after: null,
  } as any);
  if (error) throw error;
  return `q=${query || '*'} city=${city || '*'}`;
}

async function runMatchScenario(ctx: VirtualUserContext): Promise<string> {
  const { data: jobs, error: jobsError } = await ctx.client
    .from('job_postings')
    .select('id,title,created_at,employer_id,applications_count,views_count')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(25);

  if (jobsError) throw jobsError;
  const job = jobs?.[Math.floor(Math.random() * Math.max(jobs.length, 1))];
  if (!job) return 'no-jobs';

  const detail = await ctx.client
    .from('job_postings')
    .select('id,title,description,requirements,workplace_city,employment_type,work_schedule')
    .eq('id', job.id)
    .single();
  if (detail.error) throw detail.error;

  if (ENABLE_WRITES && ctx.authenticated) {
    const applicantId = (await ctx.client.auth.getUser()).data.user?.id;
    if (applicantId) {
      const { error } = await ctx.client
        .from('job_views')
        .insert({ job_id: job.id, user_id: applicantId, device_type: 'load-test', os_type: 'load-test' });
      if (error && error.code !== '23505') throw error;
      return 'read+view-write';
    }
  }

  return 'read-only';
}

async function runChatScenario(ctx: VirtualUserContext): Promise<string> {
  if (!ctx.authenticated) return 'skipped';

  const userId = (await ctx.client.auth.getUser()).data.user?.id;
  if (!userId) return 'skipped';

  const summaries = await ctx.client.rpc('get_conversation_summaries', { p_user_id: userId } as any);
  if (summaries.error) throw summaries.error;

  const conversation = Array.isArray(summaries.data) ? summaries.data[0] : null;
  if (!conversation?.conversation_id) return 'no-conversations';

  const messages = await ctx.client
    .from('conversation_messages')
    .select('id,conversation_id,sender_id,content,created_at')
    .eq('conversation_id', conversation.conversation_id)
    .order('created_at', { ascending: false })
    .limit(30);
  if (messages.error) throw messages.error;

  if (ENABLE_WRITES) {
    const { error } = await ctx.client.from('conversation_messages').insert({
      conversation_id: conversation.conversation_id,
      sender_id: userId,
      content: `[load-test] ping ${new Date().toISOString()}`,
    });
    if (error) throw error;
    return 'read+message-write';
  }

  return 'read-only';
}

async function signInUsers(users: LoadUser[]): Promise<SupabaseClient[]> {
  const clients: SupabaseClient[] = [];
  for (const user of users) {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-parium-load-test': 'true' } },
    });
    const { error } = await client.auth.signInWithPassword(user);
    if (error) {
      console.warn(`Could not sign in load-test user ${user.email}: ${error.message}`);
      continue;
    }
    clients.push(client);
  }
  return clients;
}

function buildReport() {
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const byScenario = Object.fromEntries(
    (['search', 'match', 'chat'] as ScenarioName[]).map((scenario) => [scenario, summarize(samples.filter((s) => s.scenario === scenario))])
  );

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationSeconds: Math.round(durationMs / 1000),
    targetUrl: TARGET_URL,
    virtualUsers: VIRTUAL_USERS,
    authenticatedUsers: AUTH_USERS.length,
    writesEnabled: ENABLE_WRITES,
    totalRequests: samples.length,
    requestsPerSecond: round(samples.length / Math.max(durationMs / 1000, 1), 2),
    byScenario,
    bottlenecks: detectBottlenecks(byScenario as Record<ScenarioName, ReturnType<typeof summarize>>),
    errors: topErrors(),
  };
}

function summarize(items: Sample[]) {
  const completed = items.filter((s) => s.outcome !== 'skipped');
  const ok = items.filter((s) => s.outcome === 'ok').length;
  const errors = items.filter((s) => s.outcome === 'error').length;
  const skipped = items.filter((s) => s.outcome === 'skipped').length;
  const latencies = completed.map((s) => s.ms).sort((a, b) => a - b);
  return {
    requests: items.length,
    ok,
    errors,
    skipped,
    errorRate: round(errors / Math.max(completed.length, 1), 4),
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    maxMs: round(latencies.at(-1) || 0, 1),
  };
}

function detectBottlenecks(byScenario: Record<ScenarioName, ReturnType<typeof summarize>>) {
  const findings: string[] = [];
  for (const [scenario, stats] of Object.entries(byScenario) as [ScenarioName, ReturnType<typeof summarize>][]) {
    if (stats.requests === 0 || stats.requests === stats.skipped) {
      findings.push(`${scenario}: not enough executed requests to evaluate`);
      continue;
    }
    if (stats.errorRate > 0.02) findings.push(`${scenario}: high error rate (${round(stats.errorRate * 100, 2)}%)`);
    if (stats.p95Ms > 3000) findings.push(`${scenario}: severe latency bottleneck, p95 ${stats.p95Ms}ms`);
    else if (stats.p95Ms > 1500) findings.push(`${scenario}: moderate latency bottleneck, p95 ${stats.p95Ms}ms`);
  }
  if (findings.length === 0) findings.push('No obvious bottleneck detected at this load profile');
  return findings;
}

function topErrors() {
  const counts = new Map<string, number>();
  for (const sample of samples) {
    if (sample.outcome === 'error') counts.set(sample.error || 'unknown', (counts.get(sample.error || 'unknown') || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([message, count]) => ({ count, message }));
}

function printReport(report: ReturnType<typeof buildReport>) {
  console.log('\nLoad test report');
  console.table(report.byScenario);
  console.log('\nBottlenecks:');
  for (const finding of report.bottlenecks) console.log(`- ${finding}`);
  if (report.errors.length) {
    console.log('\nTop errors:');
    for (const error of report.errors) console.log(`- ${error.count}x ${error.message}`);
  }
}

function writeReport(report: ReturnType<typeof buildReport>) {
  mkdirSync(REPORT_DIR, { recursive: true });
  const file = resolve(REPORT_DIR, `parium-load-test-${startedAt.toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`\nJSON report written to ${file}`);
}

function validateConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing VITE_SUPABASE_URL/SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY/SUPABASE_ANON_KEY');
  }
  if (VIRTUAL_USERS > 50 && TARGET_URL.includes('parium.se') && !ALLOW_PRODUCTION) {
    throw new Error('Refusing to run high-load production test. Set PARIUM_LOAD_TEST_ALLOW_PRODUCTION=true when you intentionally want to test parium.se.');
  }
  if (ENABLE_WRITES && AUTH_USERS.length === 0) {
    throw new Error('PARIUM_LOAD_TEST_ENABLE_WRITES=true requires PARIUM_LOAD_TEST_AUTH_USERS.');
  }
}

function parseUsers(raw: string): LoadUser[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((u) => u?.email && u?.password);
  } catch {
    return raw
      .split(',')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const [email, password] = pair.split(':');
        return { email, password };
      })
      .filter((u) => u.email && u.password);
  }
  return [];
}

function readEnvFile(path: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const index = line.indexOf('=');
          const key = line.slice(0, index).trim();
          const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
          return [key, value];
        })
    );
  } catch {
    return {};
  }
}

function pickWeighted<T extends string>(scenarios: Record<T, ScenarioConfig>) {
  const entries = Object.entries(scenarios) as [T, ScenarioConfig][];
  const total = entries.reduce((sum, [, config]) => sum + config.weight, 0);
  let n = Math.random() * total;
  for (const [, config] of entries) {
    n -= config.weight;
    if (n <= 0) return config;
  }
  return entries[0][1];
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const index = Math.ceil((p / 100) * values.length) - 1;
  return round(values[Math.min(Math.max(index, 0), values.length - 1)], 1);
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeError(error: unknown) {
  if (!error) return 'unknown error';
  if (typeof error === 'string') return error;
  const anyError = error as any;
  return anyError.message || anyError.error_description || anyError.details || JSON.stringify(error).slice(0, 300);
}
