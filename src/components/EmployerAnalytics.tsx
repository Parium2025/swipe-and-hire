import { memo, useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart3, Target, Filter, Smartphone, Monitor, Tablet, HelpCircle, TrendingUp, TrendingDown, Minus, Eye, Users, CalendarCheck, Clock, Calendar, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { differenceInDays } from 'date-fns';

interface JobAnalytics {
  id: string;
  title: string;
  views_count: number;
  applications_count: number;
  interviews_count: number;
  created_at: string;
  is_active: boolean;
}

interface DeviceBreakdown {
  device: string;
  count: number;
}

interface DailyView {
  date: string;
  count: number;
}

interface TrendData {
  current_views: number;
  prev_views: number;
  current_applications: number;
  prev_applications: number;
  current_interviews: number;
  prev_interviews: number;
}

interface BestDay {
  day_of_week: number;
  views: number;
}

interface TimeToFirstApp {
  job_id: string;
  title: string;
  published_at: string;
  first_application_at: string;
  seconds_to_first: number;
}

interface AnalyticsData {
  jobs: JobAnalytics[];
  device_breakdown: DeviceBreakdown[];
  daily_views: DailyView[];
  trends: TrendData | null;
  best_day: BestDay | null;
  time_to_first_application: TimeToFirstApp[];
}

const TIME_FILTERS = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: 'Allt', days: null },
] as const;

const DEVICE_CONFIG: Record<string, { icon: typeof Smartphone; label: string; color: string }> = {
  mobile: { icon: Smartphone, label: 'Mobil', color: 'hsl(var(--secondary))' },
  desktop: { icon: Monitor, label: 'Dator', color: 'hsl(210 80% 60%)' },
  tablet: { icon: Tablet, label: 'Surfplatta', color: 'hsl(150 60% 50%)' },
  unknown: { icon: HelpCircle, label: 'Okänd', color: 'hsl(0 0% 50%)' },
};

const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

/* ─── Trend pill ─── */
const TrendPill = memo(({ current, previous, label, icon: Icon, daysLabel }: {
  current: number; previous: number; label: string; icon: React.ElementType; daysLabel: string;
}) => {
  const diff = previous > 0
    ? Math.round(((current - previous) / previous) * 100)
    : (current > 0 ? current * 100 : 0);
  const isUp = diff > 0;
  const isDown = diff < 0;
  const isFlat = diff === 0;

  return (
    <div className="flex-1 min-w-0 rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-white shrink-0" />
        <span className="text-[11px] font-medium text-white truncate">{label}</span>
      </div>
      <div className="flex items-baseline justify-center gap-1 flex-nowrap min-w-0">
        <span className="text-lg font-bold text-white tabular-nums">{current}</span>
        <span className="text-[9px] text-white">vs</span>
        <span className="text-lg font-bold text-white tabular-nums">{previous}</span>
      </div>
      <p className="text-[9px] text-white mt-0.5">{daysLabel}</p>
      {(previous > 0 || current > 0) && (
        <span className={`text-[10px] font-medium inline-flex items-center gap-0.5 mt-1 ${
          isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-white'
        }`}>
          {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : isDown ? <TrendingDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
          {isFlat ? '0%' : `${isUp ? '+' : ''}${diff}%`}
        </span>
      )}
    </div>
  );
});
TrendPill.displayName = 'TrendPill';

/* ─── Circular gauge ─── */
const ConversionGauge = memo(({ label, subtitle, value, total, icon: Icon }: {
  label: string; subtitle: string; value: number; total: number; icon: React.ElementType;
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
          <circle cx="48" cy="48" r="40" fill="none" stroke={`url(#gaugeGrad-${label.replace(/\s/g, '')})`} strokeWidth="6"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out" />
          <defs>
            <linearGradient id={`gaugeGrad-${label.replace(/\s/g, '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="0.9" />
              <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
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

/* ─── Device donut ─── */
const DeviceDonut = memo(({ data }: { data: DeviceBreakdown[] }) => {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;

  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 44;
  const strokeWidth = 16;

  let currentAngle = -90;
  const segments = data
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .map(d => {
      const pct = d.count / total;
      const angle = pct * 360;
      const config = DEVICE_CONFIG[d.device] || DEVICE_CONFIG.unknown;
      const startAngle = currentAngle;
      currentAngle += angle;
      return { ...d, pct, startAngle, angle, config };
    });

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg, i) => {
          const largeArc = seg.angle > 180 ? 1 : 0;
          const x1 = cx + radius * Math.cos(toRad(seg.startAngle));
          const y1 = cy + radius * Math.sin(toRad(seg.startAngle));
          const x2 = cx + radius * Math.cos(toRad(seg.startAngle + seg.angle - 0.5));
          const y2 = cy + radius * Math.sin(toRad(seg.startAngle + seg.angle - 0.5));
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
              fill="none"
              stroke={seg.config.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          );
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-white text-lg font-bold">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-white text-[10px]">besök</text>
      </svg>
      <div className="space-y-2.5">
        {segments.map((seg, i) => {
          const Icon = seg.config.icon;
          return (
            <div key={i} className="flex items-center gap-2.5">
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.config.color }} />
              <Icon className="h-3.5 w-3.5 text-white" />
              <span className="text-[12px] text-white font-medium">{Math.round(seg.pct * 100)}% {seg.config.label}</span>
              <span className="text-[11px] text-white tabular-nums">({seg.count})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
DeviceDonut.displayName = 'DeviceDonut';

/* ─── Daily sparkline ─── */
const DailySparkline = memo(({ data }: { data: DailyView[] }) => {
  if (!data.length) return null;

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const totalViews = data.reduce((s, d) => s + d.count, 0);
  const width = 280;
  const height = 60;
  const padding = 4;

  const points = data.map((d, i) => ({
    x: padding + (i / Math.max(data.length - 1, 1)) * (width - padding * 2),
    y: height - padding - ((d.count / maxCount) * (height - padding * 2)),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = pathD + ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-2xl font-bold text-white tabular-nums">{totalViews}</span>
        <span className="text-[11px] text-white">totalt under perioden</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkFill)" />
        <path d={pathD} fill="none" stroke="hsl(var(--secondary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.length > 0 && (
          <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3"
            fill="hsl(var(--secondary))" stroke="white" strokeWidth="1.5" />
        )}
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-white">{data[0]?.date?.slice(5)}</span>
        <span className="text-[10px] text-white">{data[data.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
});
DailySparkline.displayName = 'DailySparkline';

/* ─── TTFA expandable list ─── */
const TtfaList = memo(({ ttfa, initialCount, step }: { ttfa: TimeToFirstApp[]; initialCount: number; step: number }) => {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const maxSec = Math.max(...ttfa.map(x => x.seconds_to_first), 1);
  const visible = ttfa.slice(0, visibleCount);
  const hasMore = visibleCount < ttfa.length;

  return (
    <Card className="bg-white/5 border-white/10 overflow-hidden">
      <CardContent className="p-5">
        <h3 className="text-sm font-medium text-white mb-3">Tid till första ansökan per annons</h3>
        <div className="space-y-2">
          {visible.map((t, i) => {
            const barPct = Math.min((t.seconds_to_first / maxSec) * 100, 100);
            return (
              <motion.div
                key={t.job_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i, 5) * 0.05 }}
                className="space-y-1"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-white truncate flex-1">{t.title}</span>
                  <span className="text-[12px] font-semibold text-white tabular-nums shrink-0">{formatDuration(t.seconds_to_first)}</span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-secondary/80 to-secondary/40 rounded-full transition-all duration-700"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
        {hasMore && (
          <button
            onClick={() => setVisibleCount(prev => Math.min(prev + step, ttfa.length))}
            className="mt-3 w-full py-2 rounded-lg bg-white/[0.06] text-[12px] font-medium text-white hover:bg-white/[0.10] transition-colors active:scale-[0.97]"
          >
            Visa fler ({ttfa.length - visibleCount} kvar)
          </button>
        )}
      </CardContent>
    </Card>
  );
});
TtfaList.displayName = 'TtfaList';

/* ─── Format time duration ─── */
const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.round((seconds % 86400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
};

/* ─── Per-job card ─── */
const JobAnalyticsCard = memo(({ job, rank }: { job: JobAnalytics; rank: number }) => {
  const v = job.views_count;
  const a = job.applications_count;
  const iv = job.interviews_count;
  const adConv = v > 0 ? Math.round((a / v) * 100) : null;
  const selConv = a > 0 ? Math.round((iv / a) * 100) : null;

  const getPerformance = () => {
    if (v === 0 && a === 0) return { label: 'Ingen data', icon: Minus, color: 'text-white' };
    if (v >= 3 && a === 0) return { label: 'Behöver justeras', icon: TrendingDown, color: 'text-amber-400' };
    if (a > 0 && adConv !== null && adConv >= 30) return { label: 'Stark konvertering', icon: TrendingUp, color: 'text-emerald-400' };
    if (a > 0) return { label: 'Aktiv', icon: TrendingUp, color: 'text-white' };
    return { label: 'Ny', icon: Minus, color: 'text-white' };
  };

  const perf = getPerformance();
  const PerfIcon = perf.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04, duration: 0.3 }}
      className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 hover:bg-white/[0.07] transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`h-2 w-2 rounded-full shrink-0 ${job.is_active ? 'bg-emerald-400' : 'bg-white/20'}`} />
            <h4 className="text-[14px] font-medium text-white truncate">{job.title}</h4>
          </div>
          <div className="flex items-center gap-1.5 ml-4">
            <PerfIcon className={`h-3 w-3 ${perf.color}`} />
            <span className={`text-[11px] ${perf.color}`}>{perf.label}</span>
          </div>
        </div>
        {adConv !== null && (
          <div className="shrink-0 text-right">
            <span className="text-lg font-bold text-white tabular-nums">{adConv}%</span>
            <p className="text-[10px] text-white -mt-0.5">konv.</p>
          </div>
        )}
      </div>

      <div className="flex gap-1">
        <div className="flex-1 rounded-lg bg-white/[0.04] px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Eye className="h-3 w-3 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-white tabular-nums">{v}</span>
          <p className="text-[10px] text-white">Visningar</p>
        </div>
        <div className="flex-1 rounded-lg bg-white/[0.04] px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Users className="h-3 w-3 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-white tabular-nums">{a}</span>
          <p className="text-[10px] text-white">Ansökningar</p>
        </div>
        <div className="flex-1 rounded-lg bg-white/[0.04] px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <CalendarCheck className="h-3 w-3 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-white tabular-nums">{iv}</span>
          <p className="text-[10px] text-white">Intervjuer</p>
        </div>
      </div>

      {v > 0 && (
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-white">Annonskonv. {adConv ?? 0}%</span>
            <span className="text-white">Urvalskonv. {selConv ?? 0}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-secondary/80 to-secondary/40 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(adConv ?? 0, 100)}%` }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
});
JobAnalyticsCard.displayName = 'JobAnalyticsCard';

/* ─── Main component ─── */
const EmployerAnalytics = memo(() => {
  const { user } = useAuth();
  const [selectedDays, setSelectedDays] = useState<number | null>(30);

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['employer-analytics-v2', user?.id, selectedDays],
    queryFn: async () => {
      if (!user) return null;
      const params: any = { p_user_id: user.id };
      if (selectedDays !== null) params.p_days_back = selectedDays;
      const { data, error } = await supabase.rpc('get_employer_analytics_v2', params);
      if (error) throw error;
      return data as unknown as AnalyticsData;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const analytics = useMemo(() => rawData?.jobs?.map((job: any, index: number) => {
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
    } as JobAnalytics;
  }) || [], [rawData]);

  const deviceBreakdown = (rawData?.device_breakdown || []) as DeviceBreakdown[];
  const dailyViews = (rawData?.daily_views || []) as DailyView[];
  const trends = rawData?.trends as TrendData | null;
  const bestDay = rawData?.best_day as BestDay | null;
  const ttfa = (rawData?.time_to_first_application || []) as TimeToFirstApp[];

  const totals = useMemo(() => {
    if (!analytics.length) return { views: 0, applications: 0, interviews: 0 };
    return {
      views: analytics.reduce((s: number, j: JobAnalytics) => s + j.views_count, 0),
      applications: analytics.reduce((s: number, j: JobAnalytics) => s + j.applications_count, 0),
      interviews: analytics.reduce((s: number, j: JobAnalytics) => s + j.interviews_count, 0),
    };
  }, [analytics]);

  const sortedJobs = useMemo(() => {
    return [...analytics]
      .filter((j: JobAnalytics) => j.is_active || j.views_count > 0 || j.applications_count > 0 || j.interviews_count > 0)
      .sort((a: JobAnalytics, b: JobAnalytics) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        const scoreA = a.applications_count * 10 + a.views_count + a.interviews_count * 20;
        const scoreB = b.applications_count * 10 + b.views_count + b.interviews_count * 20;
        return scoreB - scoreA;
      });
  }, [analytics]);

  const insights = useMemo(() => {
    const tips: { jobTitle: string; message: string; type: 'warning' | 'success' }[] = [];
    for (const job of sortedJobs) {
      if (job.views_count >= 5 && job.applications_count === 0)
        tips.push({ jobTitle: job.title, message: 'Många visningar men inga ansökningar — annonsen kanske behöver justeras', type: 'warning' });
      if (job.views_count >= 3 && job.applications_count > 0 && (job.applications_count / job.views_count) >= 0.5)
        tips.push({ jobTitle: job.title, message: 'Stark annonskonvertering — bra skriven annons!', type: 'success' });
    }
    return tips.slice(0, 2);
  }, [sortedJobs]);

  // Average time to first application
  const avgTtfa = useMemo(() => {
    if (!ttfa.length) return null;
    const total = ttfa.reduce((s, t) => s + t.seconds_to_first, 0);
    return Math.round(total / ttfa.length);
  }, [ttfa]);

  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!isLoading && !show) {
      const t = setTimeout(() => setShow(true), 80);
      return () => clearTimeout(t);
    }
  }, [isLoading, show]);

  if (isLoading && !show) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 bg-white/10 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white/5 rounded-2xl p-6 flex flex-col items-center">
              <div className="h-20 w-20 bg-white/10 rounded-full animate-pulse mb-3" />
              <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-5 transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}>
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

      {/* Time filter pills */}
      <div className="flex gap-1.5">
        {TIME_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setSelectedDays(f.days)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all active:scale-[0.97] ${
              selectedDays === f.days
                ? 'bg-white text-black shadow-lg shadow-white/10'
                : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ─── NEW: Trend comparison ─── */}
      {trends && (
        <div className="flex gap-2">
          {(() => {
            const dl = selectedDays === null
              ? 'hela perioden'
              : selectedDays === 1
                ? '1 dag sedan'
                : `${selectedDays} dagar sedan`;
            return (
              <>
                <TrendPill icon={Eye} label="Visningar" current={trends.current_views} previous={trends.prev_views} daysLabel={dl} />
                <TrendPill icon={Users} label="Ansökningar" current={trends.current_applications} previous={trends.prev_applications} daysLabel={dl} />
                <TrendPill icon={CalendarCheck} label="Intervjuer" current={trends.current_interviews} previous={trends.prev_interviews} daysLabel={dl} />
              </>
            );
          })()}
        </div>
      )}

      {/* ─── NEW: Best day + Time to first application ─── */}
      {(bestDay || avgTtfa !== null) && (
        <div className="grid grid-cols-2 gap-2">
          {bestDay && (
            <Card className="bg-white/5 border-white/10 overflow-hidden">
              <CardContent className="p-4 flex flex-col h-full">
                <div className="flex items-center gap-1.5 mb-2">
                  <Calendar className="h-3.5 w-3.5 text-white shrink-0" />
                  <span className="text-[11px] font-medium text-white truncate">Bästa publiceringsdag</span>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-white cursor-default shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs">
                        Veckodagen med flest annonsvisningar under vald tidsperiod. Hjälper dig tajma publiceringen av nya annonser.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xl font-bold text-white">{DAY_NAMES[bestDay.day_of_week] || 'Okänd'}</p>
                <p className="text-[11px] text-white mt-0.5">{bestDay.views} visningar på den dagen</p>
              </CardContent>
            </Card>
          )}
          {avgTtfa !== null && (
            <Card className="bg-white/5 border-white/10 overflow-hidden">
              <CardContent className="p-4 flex flex-col h-full">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="h-3.5 w-3.5 text-white shrink-0" />
                  <span className="text-[11px] font-medium text-white truncate">Tid till första ansökan</span>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-white cursor-default shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs">
                        Genomsnittlig tid från att en annons publiceras tills den får sin första ansökan. Baserat på annonser med minst en ansökan.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xl font-bold text-white">{formatDuration(avgTtfa)}</p>
                <p className="text-[11px] text-white mt-0.5">genomsnitt ({ttfa.length} annonser)</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── Per-job time to first application ─── */}
      {ttfa.length > 0 && (
        <TtfaList ttfa={ttfa} initialCount={5} step={10} />
      )}

      {/* Conversion gauges */}
      <Card className="bg-white/5 border-white/10 overflow-hidden">
        <CardContent className="p-5">
          <h3 className="text-sm font-medium text-white mb-5">Konverteringar</h3>
          <div className="flex gap-4">
            <ConversionGauge icon={Target} label="Annonskonvertering" subtitle="Besökare → Ansökan"
              value={totals.applications} total={totals.views} />
            <div className="w-px bg-white/10 self-stretch" />
            <ConversionGauge icon={Filter} label="Urvalskonvertering" subtitle="Ansökan → Intervju"
              value={totals.interviews} total={totals.applications} />
          </div>
        </CardContent>
      </Card>

      {/* Daily views sparkline */}
      {dailyViews.length > 1 && (
        <Card className="bg-white/5 border-white/10 overflow-hidden">
          <CardContent className="p-5">
            <h3 className="text-sm font-medium text-white mb-3">Visningar per dag</h3>
            <DailySparkline data={dailyViews} />
          </CardContent>
        </Card>
      )}

      {/* Device breakdown */}
      {deviceBreakdown.length > 0 && deviceBreakdown.some(d => d.count > 0) && (
        <Card className="bg-white/5 border-white/10 overflow-hidden">
          <CardContent className="p-5">
            <h3 className="text-sm font-medium text-white mb-4">Enheter</h3>
            <DeviceDonut data={deviceBreakdown} />
          </CardContent>
        </Card>
      )}

      {/* Smart insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((tip, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`flex items-start gap-3 rounded-xl px-4 py-3 ${
                tip.type === 'warning' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'
              }`}
            >
              <span className="text-sm mt-0.5">{tip.type === 'warning' ? '⚠️' : '✨'}</span>
              <div className="min-w-0">
                <p className="text-[13px] text-white font-medium truncate">{tip.jobTitle}</p>
                <p className="text-[12px] text-white">{tip.message}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Per-job cards */}
      {sortedJobs.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-white mb-3">Per annons</h3>
          <div className="space-y-2.5">
            <AnimatePresence mode="popLayout">
              {sortedJobs.map((job, i) => (
                <JobAnalyticsCard key={job.id} job={job} rank={i} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Empty state */}
      {analytics.length === 0 && !isLoading && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="h-12 w-12 text-white/20 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Inga data ännu</h3>
            <p className="text-sm text-white text-center max-w-sm">
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
