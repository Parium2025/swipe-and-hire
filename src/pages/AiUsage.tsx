import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsPlatformAdmin } from '@/hooks/useIsPlatformAdmin';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Zap, DollarSign, TrendingUp, ShieldCheck } from 'lucide-react';
import { TruncatedText } from '@/components/ui/truncated-text';

/**
 * Owner-only AI usage dashboard.
 * Reads from ai_usage_log (RLS-protected: only is_platform_admin can read).
 * Shows: fresh vs cache calls, cache-hit ratio, top jobs by fresh calls,
 * per-day trend, per-model breakdown.
 */

type Row = {
  id: string;
  created_at: string;
  function_name: string;
  employer_id: string | null;
  organization_id: string | null;
  job_id: string | null;
  criteria_count: number;
  cache_hits: number;
  fresh_calls: number;
  duration_ms: number | null;
  model: string | null;
};

type Range = '24h' | '7d' | '30d';

const RANGE_HOURS: Record<Range, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };

function formatDuration(ms: number | null): string {
  if (!ms || ms < 0) return '–';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function pct(n: number, d: number): string {
  if (d === 0) return '0%';
  return `${Math.round((n / d) * 100)}%`;
}

export default function AiUsage() {
  const { isPlatformAdmin: isAdmin, loading: adminLoading } = useIsPlatformAdmin();
  const [range, setRange] = useState<Range>('7d');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const since = new Date(Date.now() - RANGE_HOURS[range] * 3600 * 1000).toISOString();
    supabase
      .from('ai_usage_log')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5000)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
          setRows([]);
        } else {
          setRows((data ?? []) as Row[]);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [range, isAdmin, adminLoading]);

  const stats = useMemo(() => {
    const r = rows ?? [];
    const fresh = r.reduce((s, x) => s + (x.fresh_calls || 0), 0);
    const cache = r.reduce((s, x) => s + (x.cache_hits || 0), 0);
    const total = fresh + cache;
    const evals = r.length;
    const avgMs = evals ? Math.round(r.reduce((s, x) => s + (x.duration_ms || 0), 0) / evals) : 0;

    // Per job
    const byJob = new Map<string, { fresh: number; cache: number; evals: number }>();
    for (const x of r) {
      const key = x.job_id || 'okänd';
      const cur = byJob.get(key) || { fresh: 0, cache: 0, evals: 0 };
      cur.fresh += x.fresh_calls || 0;
      cur.cache += x.cache_hits || 0;
      cur.evals += 1;
      byJob.set(key, cur);
    }
    const topJobs = [...byJob.entries()]
      .sort((a, b) => b[1].fresh - a[1].fresh)
      .slice(0, 8);

    // Per model
    const byModel = new Map<string, number>();
    for (const x of r) {
      if (!x.model) continue;
      byModel.set(x.model, (byModel.get(x.model) || 0) + (x.fresh_calls || 0));
    }
    const models = [...byModel.entries()].sort((a, b) => b[1] - a[1]);

    // Per day
    const byDay = new Map<string, { fresh: number; cache: number }>();
    for (const x of r) {
      const d = new Date(x.created_at).toISOString().slice(0, 10);
      const cur = byDay.get(d) || { fresh: 0, cache: 0 };
      cur.fresh += x.fresh_calls || 0;
      cur.cache += x.cache_hits || 0;
      byDay.set(d, cur);
    }
    const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    return { fresh, cache, total, evals, avgMs, topJobs, models, days };
  }, [rows]);

  if (adminLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-semibold text-white">Åtkomst nekad</h1>
          <p className="text-white/70 text-sm">Den här sidan är endast tillgänglig för plattformsadministratörer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white">AI-användning</h1>
          <p className="text-sm text-white/70 mt-1">Cache-hits, färska anrop och kostnader per annons och modell.</p>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as Range)}>
          <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Senaste 24h</SelectItem>
            <SelectItem value="7d">Senaste 7 dagar</SelectItem>
            <SelectItem value="30d">Senaste 30 dagar</SelectItem>
          </SelectContent>
        </Select>
      </header>

      {error && (
        <Card className="p-4 bg-red-500/10 border-red-500/30 text-red-100 text-sm">{error}</Card>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiCard icon={<Activity className="w-4 h-4" />} label="Utvärderingar" value={loading ? '…' : String(stats.evals)} />
        <KpiCard icon={<Zap className="w-4 h-4" />} label="Färska AI-anrop" value={loading ? '…' : String(stats.fresh)} accent="warn" />
        <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Cache-hits" value={loading ? '…' : String(stats.cache)} accent="good" />
        <KpiCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Cache-hit ratio"
          value={loading ? '…' : pct(stats.cache, stats.total)}
          accent="good"
        />
      </div>

      {/* Per-day trend */}
      <Card className="p-4 md:p-6 bg-white/5 border-white/10">
        <h2 className="text-white font-medium mb-4">Per dag</h2>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : stats.days.length === 0 ? (
          <p className="text-white/60 text-sm">Ingen data i valt intervall.</p>
        ) : (
          <div className="space-y-2">
            {stats.days.map(([day, v]) => {
              const total = v.fresh + v.cache;
              const freshPct = total ? (v.fresh / total) * 100 : 0;
              return (
                <div key={day} className="flex items-center gap-3 text-sm">
                  <div className="w-24 text-white/70 tabular-nums">{day}</div>
                  <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden flex">
                    <div className="bg-amber-500/80" style={{ width: `${freshPct}%` }} />
                    <div className="bg-emerald-500/80" style={{ width: `${100 - freshPct}%` }} />
                  </div>
                  <div className="w-32 text-right text-white/80 tabular-nums text-xs">
                    <span className="text-amber-300">{v.fresh}</span> / <span className="text-emerald-300">{v.cache}</span>
                  </div>
                </div>
              );
            })}
            <div className="flex gap-4 text-xs text-white/60 pt-2">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500/80" /> Färska anrop</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/80" /> Cache-hits</span>
            </div>
          </div>
        )}
      </Card>

      {/* Top jobs */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 md:p-6 bg-white/5 border-white/10">
          <h2 className="text-white font-medium mb-4">Dyraste annonser (topp 8)</h2>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : stats.topJobs.length === 0 ? (
            <p className="text-white/60 text-sm">Ingen data.</p>
          ) : (
            <div className="space-y-2">
              {stats.topJobs.map(([jobId, v]) => (
                <div key={jobId} className="flex items-center gap-3 text-sm">
                  <div className="flex-1 truncate text-white/80 font-mono text-xs">{jobId.slice(0, 8)}…</div>
                  <div className="text-amber-300 tabular-nums w-14 text-right">{v.fresh}</div>
                  <div className="text-white/40">/</div>
                  <div className="text-emerald-300 tabular-nums w-14 text-right">{v.cache}</div>
                  <div className="text-white/50 tabular-nums w-12 text-right text-xs">{pct(v.cache, v.fresh + v.cache)}</div>
                </div>
              ))}
              <p className="text-xs text-white/50 pt-2">Kolumner: färska anrop / cache-hits / cache-ratio</p>
            </div>
          )}
        </Card>

        <Card className="p-4 md:p-6 bg-white/5 border-white/10">
          <h2 className="text-white font-medium mb-4">Per modell</h2>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : stats.models.length === 0 ? (
            <p className="text-white/60 text-sm">Ingen data.</p>
          ) : (
            <div className="space-y-2">
              {stats.models.map(([model, count]) => (
                <div key={model} className="flex items-center gap-3 text-sm">
                  <TruncatedText text={model} className="min-w-0 flex-1 font-mono text-xs text-white/80" />
                  <div className="text-amber-300 tabular-nums">{count}</div>
                </div>
              ))}
              <div className="pt-3 mt-3 border-t border-white/10 text-xs text-white/60">
                Genomsnittlig utvärderingstid: <span className="text-white/90 tabular-nums">{formatDuration(stats.avgMs)}</span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: 'good' | 'warn';
}) {
  const color =
    accent === 'good' ? 'text-emerald-300' : accent === 'warn' ? 'text-amber-300' : 'text-white';
  return (
    <Card className="p-4 bg-white/5 border-white/10">
      <div className="flex items-center gap-2 text-white/60 text-xs uppercase tracking-wide">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-2 text-2xl md:text-3xl font-semibold tabular-nums ${color}`}>{value}</div>
    </Card>
  );
}
