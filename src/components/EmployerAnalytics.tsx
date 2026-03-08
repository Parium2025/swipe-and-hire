import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, Target, Filter, Smartphone, Monitor, Tablet, HelpCircle } from 'lucide-react';
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

interface DeviceBreakdown {
  device: string;
  count: number;
}

interface DailyView {
  date: string;
  count: number;
}

interface AnalyticsData {
  jobs: JobAnalytics[];
  device_breakdown: DeviceBreakdown[];
  daily_views: DailyView[];
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

/** Circular gauge */
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
          <circle cx="48" cy="48" r="40" fill="none" stroke="url(#gaugeGrad)" strokeWidth="6"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out" />
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
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

/** Mini donut chart for device breakdown */
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
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-white/60 text-[10px]">besök</text>
      </svg>
      <div className="space-y-2">
        {segments.map((seg, i) => {
          const Icon = seg.config.icon;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.config.color }} />
              <Icon className="h-3.5 w-3.5 text-white/60" />
              <span className="text-[12px] text-white">{Math.round(seg.pct * 100)}% {seg.config.label}</span>
              <span className="text-[11px] text-white/50 tabular-nums">{seg.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
DeviceDonut.displayName = 'DeviceDonut';

/** Mini sparkline for daily views */
const DailySparkline = memo(({ data }: { data: DailyView[] }) => {
  if (!data.length) return null;

  const maxCount = Math.max(...data.map(d => d.count), 1);
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
        <span className="text-[10px] text-white/40">{data[0]?.date?.slice(5)}</span>
        <span className="text-[10px] text-white/40">{data[data.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
});
DailySparkline.displayName = 'DailySparkline';

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

  const analytics = rawData?.jobs?.map((job: any, index: number) => {
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
  }) || [];

  const deviceBreakdown = (rawData?.device_breakdown || []) as DeviceBreakdown[];
  const dailyViews = (rawData?.daily_views || []) as DailyView[];

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

  const wasCached = useRef(false);
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
    <div className={`space-y-6 transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}>
      {/* Header + Time filter */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Rekryteringsanalys</h2>
            <p className="text-sm text-white">Insikter för alla dina annonser</p>
          </div>
        </div>
      </div>

      {/* Time filter pills */}
      <div className="flex gap-1.5">
        {TIME_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setSelectedDays(f.days)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
              selectedDays === f.days
                ? 'bg-white text-black'
                : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Dual conversion gauges */}
      <Card className="bg-white/5 border-white/10">
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
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5">
            <h3 className="text-sm font-medium text-white mb-3">Visningar per dag</h3>
            <DailySparkline data={dailyViews} />
          </CardContent>
        </Card>
      )}

      {/* Device breakdown donut */}
      {deviceBreakdown.length > 0 && deviceBreakdown.some(d => d.count > 0) && (
        <Card className="bg-white/5 border-white/10">
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
            <div key={idx} className={`flex items-start gap-3 rounded-xl px-4 py-3 ${
              tip.type === 'warning' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'
            }`}>
              <span className="text-sm mt-0.5">{tip.type === 'warning' ? '⚠️' : '✨'}</span>
              <div className="min-w-0">
                <p className="text-[13px] text-white font-medium truncate">{tip.jobTitle}</p>
                <p className="text-[12px] text-white/70">{tip.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Per-job breakdown */}
      {sortedJobs.length > 0 && (
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
                  {sortedJobs.map((job: JobAnalytics) => {
                    const v = job.views_count;
                    const a = job.applications_count;
                    const iv = job.interviews_count;
                    const adConv = v > 0 ? (a / v > 1 ? `${(a / v).toFixed(1)}x` : `${Math.round((a / v) * 100)}%`) : '—';
                    const selConv = a > 0 ? `${Math.round((iv / a) * 100)}%` : '—';
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
                        <td className="text-right text-white py-2.5 px-1 tabular-nums text-[13px] hidden sm:table-cell">{iv}</td>
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
      {analytics.length === 0 && !isLoading && (
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
