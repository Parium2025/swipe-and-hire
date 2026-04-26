import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, BellRing, CheckCircle2, Clock, RefreshCw, ServerCrash } from 'lucide-react';
import { getPerformanceSummaries, subscribeToPerformance, type PerformanceSummary } from '@/lib/realtimePerformance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { getStatusAlertHistory, processStatusAlerts, type StatusAlert } from '@/lib/statusAlerts';

const formatMs = (value: number | null) => value === null ? '—' : `${value.toLocaleString('sv-SE')} ms`;
const formatRate = (value: number) => `${(value * 100).toLocaleString('sv-SE', { maximumFractionDigits: 2 })}%`;

const statusCopy: Record<PerformanceSummary['status'], { label: string; className: string; icon: typeof CheckCircle2 }> = {
  ok: { label: 'OK', className: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', icon: CheckCircle2 },
  warning: { label: 'Varning', className: 'text-amber-300 border-amber-500/30 bg-amber-500/10', icon: AlertTriangle },
  critical: { label: 'Kritiskt', className: 'text-red-300 border-red-500/30 bg-red-500/10', icon: ServerCrash },
  idle: { label: 'Väntar på data', className: 'text-muted-foreground border-border bg-muted/20', icon: Clock },
};

export default function RealtimeStatusPage() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState(() => getPerformanceSummaries());
  const [now, setNow] = useState(Date.now());
  const [alerts, setAlerts] = useState<StatusAlert[]>(() => getStatusAlertHistory());
  const alertingRef = useRef(false);

  useEffect(() => {
    const update = () => {
      const nextSummaries = getPerformanceSummaries();
      setSummaries(nextSummaries);
      setNow(Date.now());

      if (user?.id && !alertingRef.current) {
        alertingRef.current = true;
        processStatusAlerts(nextSummaries, user.id)
          .then((sent) => {
            if (sent.length > 0) setAlerts(getStatusAlertHistory());
          })
          .catch((error) => console.warn('Status alert processing failed:', error))
          .finally(() => {
            alertingRef.current = false;
          });
      }
    };

    const unsubscribe = subscribeToPerformance(update);
    const interval = window.setInterval(update, 5000);
    update();

    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [user?.id]);

  const overallStatus = useMemo(() => {
    if (summaries.some((item) => item.status === 'critical')) return 'critical';
    if (summaries.some((item) => item.status === 'warning')) return 'warning';
    if (summaries.every((item) => item.status === 'idle')) return 'idle';
    return 'ok';
  }, [summaries]);

  const overall = statusCopy[overallStatus];
  const OverallIcon = overall.icon;

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground md:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> Live performance
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Realtidsstatus</h1>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              Mäter de senaste 15 minuterna av faktiska klientanrop för search, matchning och chatt.
            </p>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold ${overall.className}`}>
            <OverallIcon className="h-4 w-4" /> {overall.label}
          </div>
        </section>

        {overallStatus !== 'ok' && overallStatus !== 'idle' && (
          <Alert variant={overallStatus === 'critical' ? 'destructive' : 'default'} className="border-amber-500/30 bg-amber-500/10 text-foreground">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Tröskel överskriden</AlertTitle>
            <AlertDescription>
              Kontrollera kortet som varnar. Vid kritiskt läge: avgör om det är en enskild funktion eller hela backend innan uppgradering.
            </AlertDescription>
          </Alert>
        )}

        <section className="grid gap-4 lg:grid-cols-3">
          {summaries.map((item) => {
            const copy = statusCopy[item.status];
            const Icon = copy.icon;
            const ageSeconds = item.lastUpdated ? Math.max(0, Math.round((now - item.lastUpdated) / 1000)) : null;

            return (
              <Card key={item.area} className="border border-border bg-card/80 shadow-none">
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-xl">{item.label}</CardTitle>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${copy.className}`}>
                      <Icon className="h-3.5 w-3.5" /> {copy.label}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {ageSeconds === null ? 'Inga anrop mätta ännu' : `Senaste anrop för ${ageSeconds}s sedan`}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Metric label="p95" value={formatMs(item.p95)} />
                    <Metric label="p99" value={formatMs(item.p99)} />
                    <Metric label="Error rate" value={formatRate(item.errorRate)} />
                    <Metric label="Senaste" value={formatMs(item.lastLatency)} />
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <span>{item.sampleCount} samples</span>
                    <span>{item.errorCount} fel</span>
                  </div>

                  {item.warnings.length > 0 ? (
                    <div className="space-y-2">
                      {item.warnings.map((warning) => (
                        <div key={warning} className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {warning}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Inga flaskhalsvarningar i nuvarande fönster.
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-lg border border-border bg-card/70 p-4 text-sm text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
              <RefreshCw className="h-4 w-4" /> Trösklar
            </div>
            <p>Varning: p95 &gt; 1,5s, p99 &gt; 3s eller error rate &gt; 1%. Kritiskt: p95 &gt; 3s, p99 &gt; 5s eller error rate &gt; 2%.</p>
            <p className="mt-3">Larm skickas som ägarnotis med 15 minuters cooldown per område och varningstyp.</p>
          </div>

          <div className="rounded-lg border border-border bg-card/70 p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold text-foreground">
              <BellRing className="h-4 w-4" /> Senaste larm
            </div>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga larm har skickats i den här webbläsaren ännu.</p>
            ) : (
              <div className="space-y-2">
                {alerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-border bg-background/50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-foreground">{alert.title}</span>
                      <span className={alert.status === 'critical' ? 'text-xs text-red-300' : 'text-xs text-amber-300'}>
                        {new Date(alert.createdAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{alert.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}
