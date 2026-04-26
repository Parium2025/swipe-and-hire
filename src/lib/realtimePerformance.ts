export type PerformanceArea = 'search' | 'matching' | 'chat';

export type PerformanceSample = {
  area: PerformanceArea;
  latencyMs: number;
  ok: boolean;
  timestamp: number;
};

export type PerformanceSummary = {
  area: PerformanceArea;
  label: string;
  sampleCount: number;
  errorCount: number;
  errorRate: number;
  p95: number;
  p99: number;
  lastLatency: number | null;
  lastUpdated: number | null;
  status: 'ok' | 'warning' | 'critical' | 'idle';
  warnings: string[];
};

const STORAGE_KEY = 'parium_realtime_perf_v1';
const MAX_SAMPLES_PER_AREA = 120;
const WINDOW_MS = 15 * 60 * 1000;
const subscribers = new Set<() => void>();
const labels: Record<PerformanceArea, string> = {
  search: 'Search',
  matching: 'Matchning',
  chat: 'Chatt',
};

const thresholds = {
  p95Warning: 1500,
  p95Critical: 3000,
  p99Warning: 3000,
  p99Critical: 5000,
  errorWarning: 0.01,
  errorCritical: 0.02,
};

let samples: PerformanceSample[] = readStoredSamples();

function readStoredSamples(): PerformanceSample[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSample).slice(-(MAX_SAMPLES_PER_AREA * 3));
  } catch {
    return [];
  }
}

function isSample(value: unknown): value is PerformanceSample {
  const item = value as PerformanceSample;
  return Boolean(
    item &&
    ['search', 'matching', 'chat'].includes(item.area) &&
    typeof item.latencyMs === 'number' &&
    typeof item.ok === 'boolean' &&
    typeof item.timestamp === 'number'
  );
}

function persistSamples() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
  } catch {
    // Ignore storage pressure; memory samples still update the live view.
  }
}

function trimSamples() {
  const cutoff = Date.now() - WINDOW_MS;
  const fresh = samples.filter((sample) => sample.timestamp >= cutoff);
  samples = (['search', 'matching', 'chat'] as PerformanceArea[]).flatMap((area) =>
    fresh.filter((sample) => sample.area === area).slice(-MAX_SAMPLES_PER_AREA)
  );
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, Math.min(index, sorted.length - 1))]);
}

function summarize(area: PerformanceArea): PerformanceSummary {
  const areaSamples = samples.filter((sample) => sample.area === area && sample.timestamp >= Date.now() - WINDOW_MS);
  const latencies = areaSamples.map((sample) => sample.latencyMs);
  const errorCount = areaSamples.filter((sample) => !sample.ok).length;
  const errorRate = areaSamples.length ? errorCount / areaSamples.length : 0;
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const last = areaSamples.at(-1);
  const warnings: string[] = [];

  if (p95 >= thresholds.p95Critical) warnings.push('p95 över 3s');
  else if (p95 >= thresholds.p95Warning) warnings.push('p95 över 1,5s');
  if (p99 >= thresholds.p99Critical) warnings.push('p99 över 5s');
  else if (p99 >= thresholds.p99Warning) warnings.push('p99 över 3s');
  if (errorRate >= thresholds.errorCritical) warnings.push('error rate över 2%');
  else if (errorRate >= thresholds.errorWarning) warnings.push('error rate över 1%');

  const status = areaSamples.length === 0
    ? 'idle'
    : p95 >= thresholds.p95Critical || p99 >= thresholds.p99Critical || errorRate >= thresholds.errorCritical
      ? 'critical'
      : warnings.length > 0
        ? 'warning'
        : 'ok';

  return {
    area,
    label: labels[area],
    sampleCount: areaSamples.length,
    errorCount,
    errorRate,
    p95,
    p99,
    lastLatency: last?.latencyMs ?? null,
    lastUpdated: last?.timestamp ?? null,
    status,
    warnings,
  };
}

export function recordPerformanceSample(area: PerformanceArea, latencyMs: number, ok: boolean) {
  samples.push({ area, latencyMs: Math.max(0, Math.round(latencyMs)), ok, timestamp: Date.now() });
  trimSamples();
  persistSamples();
  subscribers.forEach((callback) => callback());
}

export async function measurePerformance<T>(area: PerformanceArea, task: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await task();
    recordPerformanceSample(area, performance.now() - startedAt, true);
    return result;
  } catch (error) {
    recordPerformanceSample(area, performance.now() - startedAt, false);
    throw error;
  }
}

export function getPerformanceSummaries(): PerformanceSummary[] {
  trimSamples();
  return (['search', 'matching', 'chat'] as PerformanceArea[]).map(summarize);
}

export function subscribeToPerformance(callback: () => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}
