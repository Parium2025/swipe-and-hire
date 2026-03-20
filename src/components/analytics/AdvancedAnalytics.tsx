import { memo, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity, TrendingDown, Info, Hourglass } from 'lucide-react';
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
  expires_at?: string | null;
}

export interface AdvancedAnalyticsData {
  application_patterns: AppPattern[];
  recruitment_time: RecruitmentTime;
  dropoff_jobs: DropoffJob[];
}

const DAY_LABELS = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
const DAY_LABELS_FULL = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

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

/* ─── Application Patterns (two bar charts) ─── */
const ApplicationPatterns = memo(({ patterns }: { patterns: AppPattern[] }) => {
  const { dayData, hourData, peakDay, peakHour, totalApps } = useMemo(() => {
    const days = Array(7).fill(0);
    const hours = Array(24).fill(0);
    
    for (const p of patterns) {
      days[p.day_of_week] += p.count;
      hours[p.hour_of_day] += p.count;
    }
    
    const total = days.reduce((s, v) => s + v, 0);
    const pDay = days.indexOf(Math.max(...days));
    const pHour = hours.indexOf(Math.max(...hours));
    
    // Reorder to Mon-Sun
    const orderedDays = [1, 2, 3, 4, 5, 6, 0].map(i => ({
      label: DAY_LABELS[i],
      fullLabel: DAY_LABELS_FULL[i],
      count: days[i],
      isPeak: i === pDay,
    }));
    
    // Group hours into 3-hour blocks for cleaner display
    const hourBlocks: { label: string; count: number; isPeak: boolean }[] = [];
    let maxBlockCount = 0;
    let peakBlockIndex = 0;
    for (let h = 0; h < 24; h += 3) {
      const blockCount = hours[h] + hours[h + 1] + hours[h + 2];
      const end = h + 3 > 23 ? '00' : String(h + 3).padStart(2, '0');
      const idx = h / 3;
      if (blockCount > maxBlockCount) {
        maxBlockCount = blockCount;
        peakBlockIndex = idx;
      }
      hourBlocks.push({
        label: `${String(h).padStart(2, '0')}–${end}`,
        count: blockCount,
        isPeak: false, // set below
      });
    }
    if (hourBlocks.length > 0) {
      hourBlocks[peakBlockIndex].isPeak = true;
    }
    
    // Update peakHour to reflect the start of the peak block for the pill display
    const actualPeakHour = peakBlockIndex * 3;
    
    return { dayData: orderedDays, hourData: hourBlocks, peakDay: pDay, peakHour: actualPeakHour, totalApps: total };
  }, [patterns]);

  if (totalApps === 0) return null;

  const maxDay = Math.max(...dayData.map(d => d.count));
  const maxHour = Math.max(...hourData.map(h => h.count));

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
                  Visar vilka veckodagar och tider som flest ansökningar kommer in. 
                  Hjälper dig tajma publicering för maximal räckvidd.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Insight pills */}
        <div className="flex gap-2 mb-5">
          <div className="flex-1 rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-center">
            <p className="text-[10px] text-white mb-0.5">Bästa dag</p>
            <p className="text-sm font-bold text-white">{DAY_LABELS[peakDay]}</p>
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

        {/* Per-day bars */}
        <p className="text-[10px] text-white uppercase tracking-wider mb-2">Per veckodag</p>
        <div className="space-y-1.5 mb-5">
          {dayData.map((day, i) => (
            <motion.div
              key={day.label}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-2"
            >
              <span className={`text-[11px] w-7 text-right shrink-0 tabular-nums ${day.isPeak ? 'text-white font-semibold' : 'text-white/70'}`}>
                {day.label}
              </span>
              <div className="flex-1 h-5 rounded bg-white/[0.04] overflow-hidden relative">
                <motion.div
                  className={`h-full rounded ${day.isPeak ? 'bg-secondary' : 'bg-secondary/60'}`}
                  initial={{ width: 0 }}
                  animate={{ width: maxDay > 0 ? `${Math.max((day.count / maxDay) * 100, day.count > 0 ? 4 : 0)}%` : '0%' }}
                  transition={{ duration: 0.5, delay: i * 0.04 }}
                />
                {day.count > 0 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white font-medium tabular-nums">
                    {day.count}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Per-time-block bars */}
        <p className="text-[10px] text-white uppercase tracking-wider mb-2">Per tidsblock</p>
        <div className="space-y-1.5">
          {hourData.map((block, i) => (
            <motion.div
              key={block.label}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-2"
            >
              <span className={`text-[10px] w-10 text-right shrink-0 tabular-nums ${block.isPeak ? 'text-white font-semibold' : 'text-white/70'}`}>
                {block.label}
              </span>
              <div className="flex-1 h-5 rounded bg-white/[0.04] overflow-hidden relative">
                <motion.div
                  className={`h-full rounded ${block.isPeak ? 'bg-secondary' : 'bg-secondary/60'}`}
                  initial={{ width: 0 }}
                  animate={{ width: maxHour > 0 ? `${Math.max((block.count / maxHour) * 100, block.count > 0 ? 4 : 0)}%` : '0%' }}
                  transition={{ duration: 0.5, delay: i * 0.04 }}
                />
                {block.count > 0 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white font-medium tabular-nums">
                    {block.count}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
ApplicationPatterns.displayName = 'ApplicationPatterns';

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

        <div className="text-center mb-4">
          <p className="text-3xl font-bold text-white tracking-tight">{formatDuration(data.avg_seconds)}</p>
          <p className="text-[11px] text-white mt-1">genomsnitt från ansökan till intervjubokning</p>
        </div>

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

const isExpiredDropoffJob = (job: DropoffJob & { conversion_pct: number; dropoff_pct: number }) => {
  if (!job.is_active) return true;
  if (job.expires_at && new Date(job.expires_at) < new Date()) return true;
  return false;
};

const DropoffAnalysis = memo(({ jobs }: { jobs: DropoffJob[] }) => {
  const initialCount = 5;
  const step = 5;
  const [visibleCount, setVisibleCount] = useState(initialCount);

  const sortedJobs = useMemo(() => {
    return [...jobs]
      .map(j => {
        const rawConversion = j.views > 0 ? (j.applications / j.views) * 100 : 0;
        const conversion_pct = Math.min(Math.round(rawConversion), 100);
        const dropoff_pct = Math.max(100 - conversion_pct, 0);
        return { ...j, dropoff_pct, conversion_pct };
      })
      .sort((a, b) => a.conversion_pct - b.conversion_pct);
  }, [jobs]);

  const avgConversion = useMemo(() => {
    if (!sortedJobs.length) return 0;
    return Math.round(sortedJobs.reduce((s, j) => s + j.conversion_pct, 0) / sortedJobs.length);
  }, [sortedJobs]);

  if (!sortedJobs.length) return null;

  const hasMore = visibleCount < sortedJobs.length;
  const canStepBack = visibleCount > initialCount + step;

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
                  Visar hur stor andel besökare som söker vs lämnar utan att söka.
                  Högre konvertering = bättre annons.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Summary */}
        <div className="text-center mb-4">
          <p className="text-3xl font-bold text-white tracking-tight">{avgConversion}%</p>
          <p className="text-[11px] text-white mt-1">genomsnittlig konvertering — {100 - avgConversion}% hoppar av</p>
        </div>

        {/* Per-job bars */}
        <div className="space-y-2">
          {sortedJobs.slice(0, visibleCount).map((job, i) => {
            const expired = isExpiredDropoffJob(job);
            return (
              <motion.div
                key={job.job_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i, 5) * 0.04 }}
                className={`space-y-1 ${expired ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-[12px] text-white truncate">{job.title}</span>
                    {expired ? (
                      <span className="shrink-0 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-white border border-red-500/30">
                        Utgången
                      </span>
                    ) : (
                      <span className="shrink-0 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                        Aktiv
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-white tabular-nums">{job.views} vis.</span>
                    <span className="text-[10px] text-white tabular-nums">{job.applications} ans.</span>
                    <span className={`text-[11px] font-semibold tabular-nums ${
                      job.conversion_pct < 10 ? 'text-red-400' : job.conversion_pct < 25 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {job.conversion_pct}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden flex">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      expired
                        ? 'bg-white/20'
                        : 'bg-gradient-to-r from-secondary/80 to-secondary/40'
                    }`}
                    style={{ width: `${Math.max(job.conversion_pct, 1)}%` }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Expandable controls */}
        {(hasMore || visibleCount > initialCount) && (
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            {hasMore && (
              <button
                onClick={() => setVisibleCount(prev => Math.min(prev + step, sortedJobs.length))}
                className="py-2 px-4 rounded-lg bg-white/[0.06] text-[12px] font-medium text-white hover:bg-white/[0.10] transition-colors active:scale-[0.97]"
              >
                Visa fler ({sortedJobs.length - visibleCount} kvar)
              </button>
            )}
            {canStepBack && (
              <button
                onClick={() => setVisibleCount(prev => Math.max(prev - step, initialCount))}
                className="py-2 px-4 rounded-lg bg-white/[0.06] text-[12px] font-medium text-white hover:bg-white/[0.10] transition-colors active:scale-[0.97]"
              >
                Visa färre
              </button>
            )}
            {visibleCount > initialCount && (
              <button
                onClick={() => setVisibleCount(initialCount)}
                className="py-2 px-4 rounded-lg bg-white/[0.06] text-[12px] font-medium text-white hover:bg-white/[0.10] transition-colors active:scale-[0.97]"
              >
                Stäng alla
              </button>
            )}
          </div>
        )}
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
        <ApplicationPatterns patterns={data.application_patterns} />
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
