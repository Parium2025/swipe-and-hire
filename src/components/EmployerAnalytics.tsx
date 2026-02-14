import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Users, Calendar, UserCheck, TrendingUp, Briefcase, BarChart3 } from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';

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

const EmployerAnalytics = memo(() => {
  const { user } = useAuth();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['employer-analytics', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Fetch jobs
      const { data: jobs, error } = await supabase
        .from('job_postings')
        .select('id, title, views_count, applications_count, created_at, is_active')
        .eq('employer_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!jobs || jobs.length === 0) return [];

      const jobIds = jobs.map(j => j.id);

      // Fetch interview counts per job
      const { data: interviews } = await supabase
        .from('interviews')
        .select('job_id')
        .eq('employer_id', user.id)
        .in('job_id', jobIds);

      // Fetch hired counts per job
      const { data: hired } = await supabase
        .from('job_applications')
        .select('job_id')
        .in('job_id', jobIds)
        .eq('status', 'hired');

      const interviewMap = new Map<string, number>();
      interviews?.forEach(i => {
        interviewMap.set(i.job_id!, (interviewMap.get(i.job_id!) || 0) + 1);
      });

      const hiredMap = new Map<string, number>();
      hired?.forEach(h => {
        hiredMap.set(h.job_id, (hiredMap.get(h.job_id) || 0) + 1);
      });

      return jobs.map(j => ({
        id: j.id,
        title: j.title,
        views_count: j.views_count || 0,
        applications_count: j.applications_count || 0,
        interviews_count: interviewMap.get(j.id) || 0,
        hired_count: hiredMap.get(j.id) || 0,
        created_at: j.created_at,
        is_active: j.is_active ?? false,
      })) as JobAnalytics[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const totals = useMemo(() => {
    if (!analytics) return { views: 0, applications: 0, interviews: 0, hired: 0, conversionRate: 0 };
    const views = analytics.reduce((s, j) => s + j.views_count, 0);
    const applications = analytics.reduce((s, j) => s + j.applications_count, 0);
    const interviews = analytics.reduce((s, j) => s + j.interviews_count, 0);
    const hired = analytics.reduce((s, j) => s + j.hired_count, 0);
    const conversionRate = views > 0 ? Math.round((applications / views) * 100) : 0;
    return { views, applications, interviews, hired, conversionRate };
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
    { icon: UserCheck, label: 'Anställda', value: totals.hired, color: 'text-purple-400' },
    { icon: TrendingUp, label: 'Konvertering', value: `${totals.conversionRate}%`, color: 'text-cyan-400' },
  ];

  if (isLoading && !show) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {statCards.map((stat) => (
          <Card key={stat.label} className="bg-white/5 border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-white/50">{stat.label}</span>
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">
                {typeof stat.value === 'number' ? stat.value.toLocaleString('sv-SE') : stat.value}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funnel visualization */}
      {totals.views > 0 && (
        <Card className="bg-white/5 border-white/20">
          <CardContent className="p-5">
            <h3 className="text-sm font-medium text-white mb-4">Rekryteringstratt</h3>
            <div className="space-y-3">
              {[
                { label: 'Visningar', value: totals.views, pct: 100 },
                { label: 'Ansökningar', value: totals.applications, pct: totals.views > 0 ? (totals.applications / totals.views) * 100 : 0 },
                { label: 'Intervjuer', value: totals.interviews, pct: totals.views > 0 ? (totals.interviews / totals.views) * 100 : 0 },
                { label: 'Anställda', value: totals.hired, pct: totals.views > 0 ? (totals.hired / totals.views) * 100 : 0 },
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

      {/* Per-job breakdown */}
      {analytics && analytics.length > 0 && (
        <Card className="bg-white/5 border-white/20">
          <CardContent className="p-5">
            <h3 className="text-sm font-medium text-white mb-4">Per annons</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-white/60 font-medium py-2 pr-4">Annons</th>
                    <th className="text-right text-white/60 font-medium py-2 px-3">Visn.</th>
                    <th className="text-right text-white/60 font-medium py-2 px-3">Ansök.</th>
                    <th className="text-right text-white/60 font-medium py-2 px-3">Interv.</th>
                    <th className="text-right text-white/60 font-medium py-2 px-3">Anst.</th>
                    <th className="text-right text-white/60 font-medium py-2 pl-3">Konv.</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.map(job => {
                    const conv = job.views_count > 0 ? Math.round((job.applications_count / job.views_count) * 100) : 0;
                    return (
                      <tr key={job.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${job.is_active ? 'bg-emerald-400' : 'bg-white/20'}`} />
                            <span className="text-white truncate max-w-[200px]">{job.title}</span>
                          </div>
                        </td>
                        <td className="text-right text-white/70 py-2.5 px-3">{job.views_count}</td>
                        <td className="text-right text-white/70 py-2.5 px-3">{job.applications_count}</td>
                        <td className="text-right text-white/70 py-2.5 px-3">{job.interviews_count}</td>
                        <td className="text-right text-white/70 py-2.5 px-3">{job.hired_count}</td>
                        <td className="text-right text-white/70 py-2.5 pl-3">{conv}%</td>
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
