import { memo, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Activity, TrendingDown, Info, Hourglass } from 'lucide-react';
import { motion } from 'framer-motion';

/* ─── Types ─── */
interface AppPattern {
  day_of_week: number;
  hour_of_day: number;
  count: number;
}

interface RecruitmentTime {
  avg_seconds: number;
  min_seconds: number;
  max_seconds: number;
  sample_count: number;
}

interface DropoffJob {
  job_id: string;
  title: string;
  views: number;
  applications: number;
  is_active: boolean;
}

export interface AdvancedAnalyticsData {
  application_patterns: AppPattern[];
  recruitment_time: RecruitmentTime;
  dropoff_jobs: DropoffJob[];
}

const DAY_LABELS_SHORT = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
const HOUR_LABELS = ['00', '03', '06', '09', '12', '15', '18', '21'];

const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.round((seconds % 86400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
};

/* ─── Application Heatmap ─── */
const ApplicationHeatmap = memo(({ patterns }: { patterns: AppPattern[] }) => {
  const { grid, maxCount } = useMemo(() => {
    // Build 7 days × 24 hours grid
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    for (const p of patterns) {
      g[p.day_of_week][p.hour_of_day] = p.count;
      if (p.count > max) max = p.count;
    }
    return { grid: g, maxCount: max };
  }, [patterns]);

  // Aggregate totals for insights
  const { peakDay, peakHour, totalApps } = useMemo(() => {
    const dayTotals = grid.map(row => row.reduce((s, v) => s + v, 0));
    const hourTotals = Array(24).fill(0);
    grid.forEach(row => row.forEach((v, h) => { hourTotals[h] += v; }));
    
    const pDay = dayTotals.indexOf(Math.max(...dayTotals));
    const pHour = hourTotals.indexOf(Math.max(...hourTotals));
    const total = dayTotals.reduce((s, v) => s + v, 0);
    
    return { peakDay: pDay, peakHour: pHour, totalApps: total };
  }, [grid]);

  if (totalApps === 0) return null;

  const getOpacity = (count: number) => {
    if (count === 0 || maxCount === 0) return 0.04;
    return 0.15 + (count / maxCount) * 0.85;
  };

  return (
    <Card className="bg-white/5 border-white/10 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center gap-1.5 mb-4">
          <Activity className="h-3.5 w-3.5 text-white shrink-0" />
          <h3 className="text-sm font-medium text-white">Ansökningsmönster</h3>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="shrink-0 text-white hover:text-white/80 transition-colors">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px]">
                <p className="text-xs leading-relaxed">
                  Visar vilka veckodagar och klockslag som flest ansökningar kommer in. 
                  Starkare färg = fler ansökningar. Hjälper dig förstå när kandidater är mest aktiva.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Insight pills */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-center">
            <p className="text-[10px] text-white mb-0.5">Bästa dag</p>
            <p className="text-sm font-bold text-white">{DAY_LABELS_SHORT[peakDay]}</p>
          </div>
          <div className="flex-1 rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-center">
            <p className="text-[10px] text-white mb-0.5">Bästa tid</p>
            <p className="text-sm font-bold text-white">{`${peakHour}:00`}</p>
          </div>
          <div className="flex-1 rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-center">
            <p className="text-[10px] text-white mb-0.5">Totalt</p>
            <p className="text-sm font-bold text-white">{totalApps}</p>
          </div>
        </div>

        {/* Heatmap grid */}
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="min-w-[300px]">
            {/* Hour labels */}
            <div className="flex ml-8 mb-1">
              {HOUR_LABELS.map(h => (
                <span key={h} className="text-[9px] text-white tabular-nums" style={{ width: `${100 / 8}%` }}>
                  {h}
                </span>
              ))}
            </div>
            
            {/* Grid rows — reorder to Mon-Sun */}
            {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => (
              <div key={dayIdx} className="flex items-center gap-1 mb-[2px]">
                <span className="text-[10px] text-white w-7 text-right shrink-0 tabular-nums">
                  {DAY_LABELS_SHORT[dayIdx]}
                </span>
                <div className="flex flex-1 gap-[1px]">
                  {grid[dayIdx].map((count, hourIdx) => (
                    <TooltipProvider key={hourIdx} delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="flex-1 h-[14px] rounded-[2px] transition-colors duration-200"
                            style={{
                              backgroundColor: count > 0
                                ? `hsla(var(--secondary), ${getOpacity(count)})`
                                : 'rgba(255,255,255,0.04)',
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs py-1 px-2">
                          {DAY_LABELS_SHORT[dayIdx]} kl {hourIdx}:00 — {count} ansökning{count !== 1 ? 'ar' : ''}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center justify-end gap-1.5 mt-2">
              <span className="text-[9px] text-white">Färre</span>
              {[0.04, 0.25, 0.5, 0.75, 1].map((op, i) => (
                <div
                  key={i}
                  className="h-2.5 w-2.5 rounded-[2px]"
                  style={{ backgroundColor: `hsla(var(--secondary), ${op})` }}
                />
              ))}
              <span className="text-[9px] text-white">Fler</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
ApplicationHeatmap.displayName = 'ApplicationHeatmap';

/* ─── Recruitment Time Card ─── */
const RecruitmentTimeCard = memo(({ data }: { data: RecruitmentTime }) => {
  if (data.sample_count === 0) return null;

  return (
    <Card className="bg-white/5 border-white/10 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center gap-1.5 mb-4">
          <Hourglass className="h-3.5 w-3.5 text-white shrink-0" />
          <h3 className="text-sm font-medium text-white">Genomsnittlig rekryteringstid</h3>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="shrink-0 text-white hover:text-white/80 transition-colors">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px]">
                <p className="text-xs leading-relaxed">
                  Mäter tiden från ansökan till intervjubokning. Kortare tid = snabbare rekryteringsprocess.
                  Baserat på {data.sample_count} genomförda intervjubokningar.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Main metric */}
        <div className="text-center mb-4">
          <p className="text-3xl font-bold text-white tracking-tight">{formatDuration(data.avg_seconds)}</p>
          <p className="text-[11px] text-white mt-1">genomsnitt från ansökan till intervjubokning</p>
        </div>

        {/* Min/Max range */}
        <div className="flex gap-2">
          <div className="flex-1 rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-center">
            <p className="text-[10px] text-white mb-0.5">Snabbast</p>
            <p className="text-sm font-bold text-emerald-400">{formatDuration(data.min_seconds)}</p>
          </div>
          <div className="flex-1 rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-center">
            <p className="text-[10px] text-white mb-0.5">Långsammast</p>
            <p className="text-sm font-bold text-amber-400">{formatDuration(data.max_seconds)}</p>
          </div>
          <div className="flex-1 rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-center">
            <p className="text-[10px] text-white mb-0.5">Datapunkter</p>
            <p className="text-sm font-bold text-white">{data.sample_count}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
RecruitmentTimeCard.displayName = 'RecruitmentTimeCard';

/* ─── Drop-off Analysis ─── */
const DropoffAnalysis = memo(({ jobs }: { jobs: DropoffJob[] }) => {
  const sortedJobs = useMemo(() => {
    return [...jobs]
      .map(j => ({
        ...j,
        dropoff_pct: j.views > 0 ? Math.round(((j.views - j.applications) / j.views) * 100) : 0,
        conversion_pct: j.views > 0 ? Math.round((j.applications / j.views) * 100) : 0,
      }))
      .sort((a, b) => b.dropoff_pct - a.dropoff_pct);
  }, [jobs]);

  const avgDropoff = useMemo(() => {
    if (!sortedJobs.length) return 0;
    return Math.round(sortedJobs.reduce((s, j) => s + j.dropoff_pct, 0) / sortedJobs.length);
  }, [sortedJobs]);

  if (!sortedJobs.length) return null;

  return (
    <Card className="bg-white/5 border-white/10 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center gap-1.5 mb-4">
          <TrendingDown className="h-3.5 w-3.5 text-white shrink-0" />
          <h3 className="text-sm font-medium text-white">Avhoppsanalys</h3>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="shrink-0 text-white hover:text-white/80 transition-colors">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px]">
                <p className="text-xs leading-relaxed">
                  Visar hur stor andel besökare som lämnar annonsen utan att söka. 
                  Högt avhopp kan tyda på att annonsen behöver förbättras.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Summary */}
        <div className="text-center mb-4">
          <p className="text-3xl font-bold text-white tracking-tight">{avgDropoff}%</p>
          <p className="text-[11px] text-white mt-1">genomsnittligt avhopp — {100 - avgDropoff}% söker</p>
        </div>

        {/* Per-job bars */}
        <div className="space-y-2">
          {sortedJobs.slice(0, 8).map((job, i) => (
            <motion.div
              key={job.job_id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 5) * 0.04 }}
              className={`space-y-1 ${!job.is_active ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-white truncate flex-1 min-w-0">{job.title}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-white tabular-nums">{job.views} vis.</span>
                  <span className="text-[10px] text-white tabular-nums">{job.applications} ans.</span>
                  <span className={`text-[11px] font-semibold tabular-nums ${
                    job.dropoff_pct > 90 ? 'text-red-400' : job.dropoff_pct > 75 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {job.conversion_pct}%
                  </span>
                </div>
              </div>
              {/* Stacked bar: applications (green) + dropoff (subtle) */}
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden flex">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-secondary/80 to-secondary/40 transition-all duration-700"
                  style={{ width: `${Math.max(job.conversion_pct, 1)}%` }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
DropoffAnalysis.displayName = 'DropoffAnalysis';

/* ─── Combined export ─── */
export const AdvancedAnalyticsSections = memo(({ data }: { data: AdvancedAnalyticsData | null }) => {
  if (!data) return null;

  return (
    <>
      {data.application_patterns?.length > 0 && (
        <ApplicationHeatmap patterns={data.application_patterns} />
      )}
      {data.recruitment_time?.sample_count > 0 && (
        <RecruitmentTimeCard data={data.recruitment_time} />
      )}
      {data.dropoff_jobs?.length > 0 && (
        <DropoffAnalysis jobs={data.dropoff_jobs} />
      )}
    </>
  );
});
AdvancedAnalyticsSections.displayName = 'AdvancedAnalyticsSections';
