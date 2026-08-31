export type ServiceWorkerRequestPolicy =
  | 'navigation-network-first'
  | 'shell-cache-first'
  | 'retained-shell-network-fallback'
  | 'network-only';

const LEGACY_PRIVATE_CACHE_PREFIXES = [
  'parium-api-',
  'parium-images-',
] as const;

const RETAINED_SHELL_CACHE_PREFIX = 'parium-shell-build-';

export const SERVICE_WORKER_BUILD_PROTOCOL = 'parium-safe-shell-v1';
export const SERVICE_WORKER_BUILD_HANDSHAKE = 'PARIUM_SW_BUILD_HANDSHAKE';
export const SERVICE_WORKER_BUILD_ACK = 'PARIUM_SW_BUILD_ACK';
export const SERVICE_WORKER_ACTIVATION_PROBE = 'PARIUM_SW_ACTIVATION_PROBE';
export const SERVICE_WORKER_ACTIVATION_READY = 'PARIUM_SW_ACTIVATION_READY';
export const SERVICE_WORKER_ACTIVATION_RESULT = 'PARIUM_SW_ACTIVATION_RESULT';

/** A new shell worker may claim clients only when every open app tab opts in. */
export const shouldActivateShellWorker = (
  clientAcknowledgements: readonly boolean[],
): boolean => clientAcknowledgements.every(Boolean);

/** Historical API/image caches contain user-scoped responses and files. */
export const isLegacyPrivateCacheName = (cacheName: string): boolean =>
  LEGACY_PRIVATE_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix));

/** Shell generations are retained so an already-open tab keeps its chunks. */
export const isRetainedShellCacheName = (cacheName: string): boolean =>
  cacheName.startsWith(RETAINED_SHELL_CACHE_PREFIX);

/**
 * CacheStorage.keys() is ordered by cache creation. Keep the current shell and
 * the newest preceding generations; never include private or unrelated caches.
 */
export const selectExpiredShellCacheNames = (
  cacheNames: readonly string[],
  currentCacheName: string,
  retainedPreviousGenerations = 2,
): string[] => {
  const retainedCount = Math.max(0, Math.floor(retainedPreviousGenerations));
  const previousShells = cacheNames.filter(
    (cacheName) => isRetainedShellCacheName(cacheName)
      && cacheName !== currentCacheName,
  );
  return previousShells.slice(0, Math.max(0, previousShells.length - retainedCount));
};

type PrecacheManifestEntry = string | {
  url: string;
  revision?: string | null;
};

/** Stable per-manifest cache identity; ordering does not affect the result. */
export const createShellBuildSuffix = (
  manifest: ReadonlyArray<PrecacheManifestEntry>,
): string => {
  const identity = manifest
    .map((entry) => typeof entry === 'string'
      ? entry
      : `${entry.url}:${entry.revision ?? ''}`)
    .sort()
    .join('|');

  // 64-bit FNV-1a is synchronous (required before Workbox precache setup) and
  // gives materially safer generation separation than a short timestamp.
  let hash = 14_695_981_039_346_656_037n;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= BigInt(identity.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 1_099_511_628_211n);
  }
  return `build-${hash.toString(36)}`;
};

export const shouldUseOfflineNavigationFallback = (status: number): boolean =>
  Number.isInteger(status) && status >= 500 && status <= 599;

interface ServiceWorkerPolicyInput {
  request: {
    url: string;
    method: string;
    mode: string;
  };
  appOrigin: string;
  shellUrls: readonly string[];
}

const normalizeShellUrl = (value: string, appOrigin: string): string | null => {
  try {
    const url = new URL(value, appOrigin);
    if (url.origin !== appOrigin) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
};

const isAlwaysNetworkPath = (url: URL): boolean => {
  const path = url.pathname;
  return (
    path === '/sw.js' ||
    path === '/version.json' ||
    path.startsWith('/api/') ||
    path === '/api' ||
    path.startsWith('/rest/') ||
    path.startsWith('/auth/') ||
    path.startsWith('/functions/') ||
    path.startsWith('/storage/') ||
    /^\/favicon(?:-|\.|\/)/.test(path)
  );
};

/**
 * Pure allow-list policy shared by the browser tests and the service worker.
 * Only files emitted in the immutable build manifest may come from Cache
 * Storage. API, auth, user data and arbitrary runtime URLs are always network.
 */
export const classifyServiceWorkerRequest = ({
  request,
  appOrigin,
  shellUrls,
}: ServiceWorkerPolicyInput): ServiceWorkerRequestPolicy => {
  if (request.method.toUpperCase() !== 'GET') return 'network-only';

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return 'network-only';
  }

  if (url.origin !== appOrigin || isAlwaysNetworkPath(url)) return 'network-only';

  if (request.mode === 'navigate') return 'navigation-network-first';

  const requestPath = `${url.pathname}${url.search}`;
  const allowed = shellUrls.some(
    (shellUrl) => normalizeShellUrl(shellUrl, appOrigin) === requestPath,
  );
  if (allowed) return 'shell-cache-first';

  // A tab from the preceding build can request a not-yet-loaded hashed chunk
  // after a new worker takes control. Network remains first; the exact URL may
  // fall back only to a retained, immutable shell cache.
  if (/^\/assets\/.+\.(?:js|mjs|css)$/.test(url.pathname)) {
    return 'retained-shell-network-fallback';
  }

  return 'network-only';
};
