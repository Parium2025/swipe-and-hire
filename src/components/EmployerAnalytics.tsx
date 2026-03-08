import { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Users, Calendar, UserCheck, TrendingUp, BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface JobAnalytics {
  id: string;
  title: string;
  views_count: number;
  applications_count: number;
  interviews_count: number;
  hired_count: number;
  created_at: string;
  is_active: boolean;
}

const CACHE_KEY = 'employer-analytics-cache-v1';

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

const EmployerAnalytics = memo(() => {
  const { user } = useAuth();

  const cached = useMemo(() => user ? loadCache(user.id) : undefined, [user?.id]);

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['employer-analytics', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase.rpc('get_employer_analytics', {
        p_user_id: user.id,
      });

      if (error) throw error;

      const jobs = ((data as any)?.jobs || []) as JobAnalytics[];
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
    if (!analytics || analytics.length === 0) return { views: 0, applications: 0, interviews: 0, conversionRate: 0 };
    const views = analytics.reduce((s, j) => s + j.views_count, 0);
    const applications = analytics.reduce((s, j) => s + j.applications_count, 0);
    const interviews = analytics.reduce((s, j) => s + j.interviews_count, 0);
    const conversionRate = views > 0 ? Math.round((applications / views) * 100) : 0;
    return { views, applications, interviews, conversionRate };
  }, [analytics]);

  // Skip fade-in when cached
  const wasCached = useRef(!isLoading);
  const [show, setShow] = useState(() => !isLoading);
  useEffect(() => {
    if (!isLoading && !show) {
      if (wasCached.current) setShow(true);
      else { const t = setTimeout(() => setShow(true), 100); return () => clearTimeout(t); }
    }
  }, [isLoading, show]);

  const statCards = [
    { icon: Eye, label: 'Visningar', value: totals.views, color: 'text-blue-400' },
    { icon: Users, label: 'Ansökningar', value: totals.applications, color: 'text-emerald-400' },
    { icon: Calendar, label: 'Intervjuer', value: totals.interviews, color: 'text-amber-400' },
  ];

  const conversionLabel = totals.conversionRate > 100
    ? `${(totals.applications / Math.max(totals.views, 1)).toFixed(1)}x`
    : `${totals.conversionRate}%`;

  if (isLoading && !show) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="bg-white/5 border-white/20">
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

  return (
    <div className={`space-y-6 transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">Rekryteringsanalys</h2>
          <p className="text-sm text-white/50">Konverteringsstatistik för alla dina annonser</p>
        </div>
      </div>

      {/* Summary cards — 2 cols mobile, auto-fit desktop */}
      <div className="grid grid-cols-2 gap-2">
        {statCards.map((stat) => (
          <Card key={stat.label} className="bg-white/5 border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-white/50">{stat.label}</span>
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">
                {stat.value.toLocaleString('sv-SE')}
              </span>
            </CardContent>
          </Card>
        ))}
        {/* Conversion card — spans full width on odd count */}
        <Card className="bg-white/5 border-white/20 col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <span className="text-xs text-white/50">Konvertering</span>
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">
              {conversionLabel}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Funnel visualization */}
      {totals.views > 0 && (
        <Card className="bg-white/5 border-white/20">
          <CardContent className="p-5">
            <h3 className="text-sm font-medium text-white mb-4">Rekryteringstratt</h3>
            <div className="space-y-3">
              {[
                { label: 'Visningar', value: totals.views, pct: 100 },
                { label: 'Ansökningar', value: totals.applications, pct: totals.views > 0 ? Math.min((totals.applications / totals.views) * 100, 100) : 0 },
                { label: 'Intervjuer', value: totals.interviews, pct: totals.views > 0 ? Math.min((totals.interviews / totals.views) * 100, 100) : 0 },
              ].map((step) => (
                <div key={step.label} className="flex items-center gap-3">
                  <span className="text-xs text-white/60 w-24 shrink-0">{step.label}</span>
                  <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-secondary/60 to-secondary/30 rounded-full transition-all duration-700"
                      style={{ width: `${Math.max(step.pct, 2)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white">
                      {step.value.toLocaleString('sv-SE')} ({step.pct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-job breakdown — mobile-optimized */}
      {analytics && analytics.length > 0 && (
        <Card className="bg-white/5 border-white/20">
          <CardContent className="p-5">
            <h3 className="text-sm font-medium text-white mb-4">Per annons</h3>
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-white/60 font-medium py-2 pr-4">Annons</th>
                    <th className="text-right text-white/60 font-medium py-2 px-2">Visn.</th>
                    <th className="text-right text-white/60 font-medium py-2 px-2">Ansök.</th>
                    <th className="text-right text-white/60 font-medium py-2 px-2 hidden sm:table-cell">Interv.</th>
                    <th className="text-right text-white/60 font-medium py-2 px-2 hidden sm:table-cell">Interv.</th>
                    <th className="text-right text-white/60 font-medium py-2 pl-2">Konv.</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.map(job => {
                    const conv = job.views_count > 0
                      ? job.applications_count / job.views_count > 1
                        ? `${(job.applications_count / job.views_count).toFixed(1)}x`
                        : `${Math.round((job.applications_count / job.views_count) * 100)}%`
                      : '0%';
                    return (
                      <tr key={job.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${job.is_active ? 'bg-emerald-400' : 'bg-white/20'}`} />
                            <span className="text-white truncate max-w-[180px] sm:max-w-[240px]">{job.title}</span>
                          </div>
                        </td>
                        <td className="text-right text-white/70 py-2.5 px-2">{job.views_count}</td>
                        <td className="text-right text-white/70 py-2.5 px-2">{job.applications_count}</td>
                        <td className="text-right text-white/70 py-2.5 px-2 hidden sm:table-cell">{job.interviews_count}</td>
                        
                        <td className="text-right text-white/70 py-2.5 pl-2">{conv}</td>
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
        <Card className="bg-white/5 border-white/20">
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
