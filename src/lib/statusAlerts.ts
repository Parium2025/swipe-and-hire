import { supabase } from '@/integrations/supabase/client';
import type { PerformanceSummary } from '@/lib/realtimePerformance';
import type { AppFailure } from '@/lib/appFailureMonitor';

export type StatusAlert = {
  id: string;
  area: string;
  label: string;
  status: 'warning' | 'critical';
  title: string;
  body: string;
  createdAt: number;
  p95: number;
  p99: number;
  errorRate: number;
  warnings: string[];
};

const ALERT_HISTORY_KEY = 'parium_status_alert_history_v1';
const ALERT_DEDUPE_KEY = 'parium_status_alert_dedupe_v1';
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best effort only.
  }
}

export function getStatusAlertHistory(): StatusAlert[] {
  const alerts = readJson<StatusAlert[]>(ALERT_HISTORY_KEY, []);
  return Array.isArray(alerts) ? alerts.slice(0, 25) : [];
}

function storeStatusAlert(alert: StatusAlert) {
  const existing = getStatusAlertHistory();
  writeJson(ALERT_HISTORY_KEY, [alert, ...existing].slice(0, 25));
}

function shouldAlert(summary: PerformanceSummary): summary is PerformanceSummary & { status: 'warning' | 'critical' } {
  if (summary.status !== 'warning' && summary.status !== 'critical') return false;
  return summary.sampleCount >= 5 || summary.errorCount > 0;
}

function alertFingerprint(summary: PerformanceSummary) {
  return `${summary.area}:${summary.status}:${summary.warnings.join('|')}`;
}

function buildAlert(summary: PerformanceSummary): StatusAlert {
  const statusLabel = summary.status === 'critical' ? 'Kritiskt larm' : 'Varning';
  return {
    id: `${summary.area}-${Date.now()}`,
    area: summary.area,
    label: summary.label,
    status: summary.status as 'warning' | 'critical',
    title: `${statusLabel}: ${summary.label}`,
    body: `${summary.warnings.join(', ')}. p95 ${summary.p95} ms, p99 ${summary.p99} ms, error rate ${(summary.errorRate * 100).toFixed(2)}%.`,
    createdAt: Date.now(),
    p95: summary.p95,
    p99: summary.p99,
    errorRate: summary.errorRate,
    warnings: summary.warnings,
  };
}

export async function processStatusAlerts(summaries: PerformanceSummary[], ownerUserId: string): Promise<StatusAlert[]> {
  const dedupe = readJson<Record<string, number>>(ALERT_DEDUPE_KEY, {});
  const sentAlerts: StatusAlert[] = [];
  const now = Date.now();

  for (const summary of summaries) {
    if (!shouldAlert(summary)) continue;

    const fingerprint = alertFingerprint(summary);
    const lastSentAt = dedupe[fingerprint] ?? 0;
    if (now - lastSentAt < ALERT_COOLDOWN_MS) continue;

    const alert = buildAlert(summary);
    dedupe[fingerprint] = now;
    storeStatusAlert(alert);
    sentAlerts.push(alert);

    const metadata = {
      route: '/status',
      area: alert.area,
      status: alert.status,
      p95: alert.p95,
      p99: alert.p99,
      errorRate: alert.errorRate,
      warnings: alert.warnings,
    };

    await supabase.from('notifications').insert({
      user_id: ownerUserId,
      type: 'system_performance_alert',
      title: alert.title,
      body: alert.body,
      metadata,
    });

    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          recipient_id: ownerUserId,
          title: alert.title,
          body: alert.body,
          data: Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, String(value)])),
        },
      });
    } catch (error) {
      console.warn('Performance push alert failed:', error);
    }
  }

  writeJson(ALERT_DEDUPE_KEY, dedupe);
  return sentAlerts;
}


export async function notifyAppFailure(failure: AppFailure, ownerUserId: string): Promise<void> {
  const dedupe = readJson<Record<string, number>>(ALERT_DEDUPE_KEY, {});
  const fingerprint = failure.fingerprint;
  const now = Date.now();
  if (now - (dedupe[fingerprint] ?? 0) < ALERT_COOLDOWN_MS) return;
  dedupe[fingerprint] = now;
  writeJson(ALERT_DEDUPE_KEY, dedupe);

  const alert: StatusAlert = {
    id: failure.id,
    area: failure.kind,
    label: 'Appfel',
    status: failure.severity,
    title: failure.title,
    body: `${failure.message} (${failure.route})`,
    createdAt: failure.createdAt,
    p95: 0,
    p99: 0,
    errorRate: 0,
    warnings: [failure.kind],
  };
  storeStatusAlert(alert);

  const metadata = {
    route: failure.route || '/status',
    area: failure.kind,
    status: failure.severity,
    source: failure.source || '',
    httpStatus: failure.status || '',
  };

  await supabase.from('notifications').insert({
    user_id: ownerUserId,
    type: 'system_app_failure',
    title: failure.title,
    body: alert.body,
    metadata,
  });

  try {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        recipient_id: ownerUserId,
        title: failure.title,
        body: alert.body,
        data: Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, String(value)])),
      },
    });
  } catch (error) {
    console.warn('App failure push alert failed:', error);
  }
}

export async function reportAppException(failure: AppFailure, ownerUserId: string): Promise<void> {
  const payload = {
    owner_user_id: ownerUserId,
    environment: import.meta.env.MODE || 'production',
    kind: failure.kind,
    severity: failure.severity,
    title: failure.title,
    message: failure.message.slice(0, 2000),
    route: failure.route || '/',
    source: failure.source || null,
    stacktrace: failure.stacktrace || null,
    http_status: failure.status || null,
    fingerprint: failure.fingerprint,
    last_seen_at: new Date(failure.lastSeenAt || failure.createdAt).toISOString(),
    metadata: {
      browser: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      url: typeof window !== 'undefined' ? window.location.href : '',
    },
  };

  await supabase.rpc('record_app_exception' as never, {
    _owner_user_id: ownerUserId,
    _environment: payload.environment,
    _kind: payload.kind,
    _severity: payload.severity,
    _title: payload.title,
    _message: payload.message,
    _route: payload.route,
    _source: payload.source,
    _stacktrace: payload.stacktrace,
    _http_status: payload.http_status,
    _fingerprint: payload.fingerprint,
    _metadata: payload.metadata,
  } as never);
}
