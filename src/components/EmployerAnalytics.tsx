import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Users, Calendar, TrendingUp, BarChart3, Target, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface JobAnalytics {
  id: string;
  title: string;
  views_count: number;
  applications_count: number;
  interviews_count: number;
  created_at: string;
  is_active: boolean;
}

const CACHE_KEY = 'employer-analytics-cache-v2';

function loadCache(userId: string): JobAnalytics[] | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (parsed?.userId !== userId) return undefined;
    return parsed.data as JobAnalytics[];
  } catch { return undefined; }
}

function saveCache(userId: string, data: JobAnalytics[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, data, ts: Date.now() }));
  } catch { /* quota exceeded */ }
}

/** Circular gauge component for conversion metrics */
const ConversionGauge = memo(({ 
  label, 
  subtitle,
  value, 
  total, 
  icon: Icon 
}: { 
  label: string; 
  subtitle: string;
  value: number; 
  total: number; 
  icon: React.ElementType;
}) => {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (pct / 100) * circumference;
  const displayPct = total > 0 
    ? (value / total > 1 ? `${(value / total).toFixed(1)}x` : `${Math.round(pct)}%`)
    : '—';

  return (
    <div className="flex flex-col items-center gap-3 flex-1">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="40" fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="6" />
          <circle 
            cx="48" cy="48" r="40" 
            fill="none" 
            stroke="url(#gaugeGradient)" 
            strokeWidth="6" 
            strokeLinecap="round"
            strokeDasharray={circumference} 
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="0.9" />
              <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-white tracking-tight">{displayPct}</span>
        </div>
      </div>
      <div className="text-center space-y-0.5">
        <div className="flex items-center justify-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-white" />
          <span className="text-xs font-medium text-white">{label}</span>
        </div>
        <p className="text-[10px] text-white leading-tight max-w-[120px]">{subtitle}</p>
        <p className="text-[11px] text-white tabular-nums">{value} av {total}</p>
      </div>
    </div>
  );
});
ConversionGauge.displayName = 'ConversionGauge';

const EmployerAnalytics = memo(() => {
  const { user } = useAuth();
  const cached = useMemo(() => user ? loadCache(user.id) : undefined, [user?.id]);

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['employer-analytics', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc('get_employer_analytics', { p_user_id: user.id });
      if (error) throw error;

      const rawJobs = ((data as any)?.jobs || []) as Array<Partial<JobAnalytics>>;
      const jobs: JobAnalytics[] = rawJobs.map((job, index) => {
        const views = Number(job.views_count);
        const applications = Number(job.applications_count);
        const interviews = Number(job.interviews_count);
        const title = typeof job.title === 'string' ? job.title.trim() : '';
        return {
          id: typeof job.id === 'string' && job.id.length > 0 ? job.id : `job-${index}`,
          title: title && /[A-Za-z0-9ÅÄÖåäö]/.test(title) ? title : 'Okänd annons',
          views_count: Number.isFinite(views) && views > 0 ? Math.floor(views) : 0,
          applications_count: Number.isFinite(applications) && applications > 0 ? Math.floor(applications) : 0,
          interviews_count: Number.isFinite(interviews) && interviews > 0 ? Math.floor(interviews) : 0,
          created_at: typeof job.created_at === 'string' ? job.created_at : new Date(0).toISOString(),
          is_active: Boolean(job.is_active),
        };
      });
      saveCache(user.id, jobs);
      return jobs;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: cached,
    refetchOnMount: true,
  });

  const totals = useMemo(() => {
    if (!analytics || analytics.length === 0) return { views: 0, applications: 0, interviews: 0 };
    return {
      views: analytics.reduce((s, j) => s + j.views_count, 0),
      applications: analytics.reduce((s, j) => s + j.applications_count, 0),
      interviews: analytics.reduce((s, j) => s + j.interviews_count, 0),
    };
  }, [analytics]);

  const wasCached = useRef(!isLoading);
  const [show, setShow] = useState(() => !isLoading);
  useEffect(() => {
    if (!isLoading && !show) {
      if (wasCached.current) setShow(true);
      else { const t = setTimeout(() => setShow(true), 100); return () => clearTimeout(t); }
    }
  }, [isLoading, show]);

  if (isLoading && !show) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-white/5 border-white/10">
              <CardContent className="p-4">
                <div className="h-4 w-16 bg-white/10 rounded animate-pulse mb-2" />
                <div className="h-8 w-12 bg-white/10 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { icon: Eye, label: 'Visningar', value: totals.views },
    { icon: Users, label: 'Ansökningar', value: totals.applications },
    { icon: Calendar, label: 'Intervjuer', value: totals.interviews },
  ];

  return (
    <div className={`space-y-6 transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">Rekryteringsanalys</h2>
          <p className="text-sm text-white">Insikter för alla dina annonser</p>
        </div>
      </div>

      {/* Summary cards — 3 cols */}
      <div className="grid grid-cols-3 gap-2">
        {statCards.map((stat) => (
          <Card key={stat.label} className="bg-white/5 border-white/10">
            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-1.5 mb-1">
                <stat.icon className="h-3.5 w-3.5 text-white" />
                <span className="text-[11px] text-white">{stat.label}</span>
              </div>
              <span className="text-2xl font-bold text-white tracking-tight tabular-nums">
                {stat.value.toLocaleString('sv-SE')}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dual conversion gauges */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-5">
          <h3 className="text-sm font-medium text-white mb-5">Konverteringar</h3>
          <div className="flex gap-4">
            <ConversionGauge
              icon={Target}
              label="Annonskonvertering"
              subtitle="Besökare → Ansökan"
              value={totals.applications}
              total={totals.views}
            />
            <div className="w-px bg-white/10 self-stretch" />
            <ConversionGauge
              icon={Filter}
              label="Urvalskonvertering"
              subtitle="Ansökan → Intervju"
              value={totals.interviews}
              total={totals.applications}
            />
          </div>
        </CardContent>
      </Card>

      {/* Per-job breakdown */}
      {analytics && analytics.length > 0 && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5">
            <h3 className="text-sm font-medium text-white mb-4">Per annons</h3>
            <div className="overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[38%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%] hidden sm:table-column" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-white font-medium text-[11px] py-2 pr-2">Annons</th>
                    <th className="text-right text-white font-medium text-[11px] py-2 px-1">Visn.</th>
                    <th className="text-right text-white font-medium text-[11px] py-2 px-1">Ansök.</th>
                    <th className="text-right text-white font-medium text-[11px] py-2 px-1 hidden sm:table-cell">Interv.</th>
                    <th className="text-right text-white font-medium text-[11px] py-2 px-1 whitespace-nowrap">
                      <span className="hidden sm:inline">Annons</span>konv.
                    </th>
                    <th className="text-right text-white font-medium text-[11px] py-2 pl-1 whitespace-nowrap">Urval</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.map(job => {
                    const v = job.views_count;
                    const a = job.applications_count;
                    const i = job.interviews_count;
                    const adConv = v > 0 ? (a / v > 1 ? `${(a / v).toFixed(1)}x` : `${Math.round((a / v) * 100)}%`) : '—';
                    const selConv = a > 0 ? `${Math.round((i / a) * 100)}%` : '—';

                    return (
                      <tr key={job.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${job.is_active ? 'bg-emerald-400' : 'bg-white/20'}`} />
                            <span className="text-white truncate text-[13px]">{job.title}</span>
                          </div>
                        </td>
                        <td className="text-right text-white py-2.5 px-1 tabular-nums text-[13px]">{v}</td>
                        <td className="text-right text-white py-2.5 px-1 tabular-nums text-[13px]">{a}</td>
                        <td className="text-right text-white py-2.5 px-1 tabular-nums text-[13px] hidden sm:table-cell">{i}</td>
                        <td className="text-right text-white py-2.5 px-1 tabular-nums text-[13px]">{adConv}</td>
                        <td className="text-right text-white py-2.5 pl-1 tabular-nums text-[13px]">{selConv}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {(!analytics || analytics.length === 0) && !isLoading && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="h-12 w-12 text-white/20 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Inga data ännu</h3>
            <p className="text-sm text-white/50 text-center max-w-sm">
              Skapa din första jobbannons för att börja se statistik här.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
});

EmployerAnalytics.displayName = 'EmployerAnalytics';
export default EmployerAnalytics;
