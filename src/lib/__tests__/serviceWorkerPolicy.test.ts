import { describe, expect, it, vi } from 'vitest';

type RequestPolicy =
  | 'navigation-network-first'
  | 'shell-cache-first'
  | 'retained-shell-network-fallback'
  | 'network-only';

interface PolicyInput {
  request: {
    url: string;
    method: string;
    mode: string;
  };
  appOrigin: string;
  shellUrls: readonly string[];
}

interface ServiceWorkerPolicyModule {
  classifyServiceWorkerRequest: (input: PolicyInput) => RequestPolicy;
  shouldUseOfflineNavigationFallback: (status: number) => boolean;
  isLegacyPrivateCacheName: (cacheName: string) => boolean;
  isRetainedShellCacheName: (cacheName: string) => boolean;
  createShellBuildSuffix: (
    manifest: ReadonlyArray<string | { url: string; revision?: string | null }>,
  ) => string;
  selectExpiredShellCacheNames: (
    cacheNames: readonly string[],
    currentCacheName: string,
    retainedPreviousGenerations?: number,
  ) => string[];
  shouldActivateShellWorker: (clientAcknowledgements: readonly boolean[]) => boolean;
}

const APP_ORIGIN = 'https://www.parium.se';
const SHELL_URLS = [
  '/index.html',
  '/assets/index-a1b2c3.js',
  '/assets/index-d4e5f6.css',
  '/manifest.json',
] as const;

const classify = async (
  url: string,
  options: { method?: string; mode?: string } = {},
): Promise<RequestPolicy> => {
  const policy = await vi.importActual<ServiceWorkerPolicyModule>(
    '@/lib/serviceWorkerPolicy',
  );
  return policy.classifyServiceWorkerRequest({
    request: {
      url,
      method: options.method ?? 'GET',
      mode: options.mode ?? 'cors',
    },
    appOrigin: APP_ORIGIN,
    shellUrls: SHELL_URLS,
  });
};

describe('service-worker request policy', () => {
  it('uses network-first with cached index fallback for same-origin navigation', async () => {
    await expect(
      classify(`${APP_ORIGIN}/home`, { mode: 'navigate' }),
    ).resolves.toBe('navigation-network-first');
  });

  it('uses cache-first only for an exact same-origin shell-manifest resource', async () => {
    await expect(classify(`${APP_ORIGIN}/assets/index-a1b2c3.js`)).resolves.toBe(
      'shell-cache-first',
    );
    await expect(classify(`${APP_ORIGIN}/assets/index-old-build.js`)).resolves.toBe(
      'retained-shell-network-fallback',
    );
  });

  it.each([
    `${APP_ORIGIN}/assets/old-route-a1b2c3.js`,
    `${APP_ORIGIN}/assets/old-theme-a1b2c3.css`,
  ])('allows an exact retained-shell fallback for an old hashed tab asset: %s', async (url) => {
    await expect(classify(url)).resolves.toBe('retained-shell-network-fallback');
  });

  it.each([
    ['POST requests', `${APP_ORIGIN}/assets/index-a1b2c3.js`, { method: 'POST' }],
    ['same-origin API', `${APP_ORIGIN}/api/health`, {}],
    ['version metadata', `${APP_ORIGIN}/version.json`, {}],
    ['worker script', `${APP_ORIGIN}/sw.js`, {}],
    ['connectivity image ping', `${APP_ORIGIN}/favicon-parium.png?_cb=123`, {}],
    ['connectivity HEAD ping', `${APP_ORIGIN}/favicon-parium.png?_cb=123_f`, { method: 'HEAD' }],
    ['Supabase REST', 'https://project.supabase.co/rest/v1/profiles', {}],
    ['Supabase auth', 'https://project.supabase.co/auth/v1/user', {}],
    ['Supabase functions', 'https://project.supabase.co/functions/v1/weather', {}],
    ['Supabase storage', 'https://project.supabase.co/storage/v1/object/sign/avatar', {}],
  ])('keeps %s network-only', async (_label, url, options) => {
    await expect(classify(url, options)).resolves.toBe('network-only');
  });

  it.each([500, 502, 503, 504, 599])(
    'uses the cached navigation shell for HTTP %s',
    async (status) => {
      const policy = await vi.importActual<ServiceWorkerPolicyModule>(
        '@/lib/serviceWorkerPolicy',
      );
      expect(policy.shouldUseOfflineNavigationFallback(status)).toBe(true);
    },
  );

  it.each([0, 200, 301, 404, 499, 600])(
    'does not hide HTTP %s behind the offline shell',
    async (status) => {
      const policy = await vi.importActual<ServiceWorkerPolicyModule>(
        '@/lib/serviceWorkerPolicy',
      );
      expect(policy.shouldUseOfflineNavigationFallback(status)).toBe(false);
    },
  );

  it('migrates every historical private API/image cache without touching shell or unrelated caches', async () => {
    const policy = await vi.importActual<ServiceWorkerPolicyModule>(
      '@/lib/serviceWorkerPolicy',
    );
    const seededV12UpgradeCaches = [
      'parium-api-v1',
      'parium-api-v12',
      'parium-api-legacy-build',
      'parium-images-v2',
      'parium-images-v12',
      'parium-shell-build-v1',
      'parium-static-v12',
      'unrelated-cache',
      'other-parium-api-v12',
      'parium-image-v12',
    ];

    expect(seededV12UpgradeCaches.filter(policy.isLegacyPrivateCacheName)).toEqual([
      'parium-api-v1',
      'parium-api-v12',
      'parium-api-legacy-build',
      'parium-images-v2',
      'parium-images-v12',
    ]);
  });

  it('gives each manifest generation its own retained shell cache identity', async () => {
    const policy = await vi.importActual<ServiceWorkerPolicyModule>(
      '@/lib/serviceWorkerPolicy',
    );
    const buildA = [
      { url: '/index.html', revision: 'a' },
      '/assets/index-aaa.js',
    ];
    const buildAReordered = [...buildA].reverse();
    const buildB = [
      { url: '/index.html', revision: 'b' },
      '/assets/index-bbb.js',
    ];

    const suffixA = policy.createShellBuildSuffix(buildA);
    expect(suffixA).toMatch(/^build-[a-z0-9]+$/);
    expect(policy.createShellBuildSuffix(buildAReordered)).toBe(suffixA);
    expect(policy.createShellBuildSuffix(buildB)).not.toBe(suffixA);
    expect(policy.isRetainedShellCacheName(`parium-shell-${suffixA}`)).toBe(true);
    expect(policy.isRetainedShellCacheName('parium-shell-build-v1')).toBe(true);
    expect(policy.isRetainedShellCacheName('parium-api-v12')).toBe(false);
    expect(policy.isRetainedShellCacheName('unrelated-cache')).toBe(false);
  });

  it('bounds retained shells to current plus two previous generations only', async () => {
    const policy = await vi.importActual<ServiceWorkerPolicyModule>(
      '@/lib/serviceWorkerPolicy',
    );
    const current = 'parium-shell-build-current';
    const seededCaches = [
      'unrelated-cache',
      'parium-shell-build-oldest',
      'parium-api-v12',
      'parium-shell-build-previous-2',
      'parium-shell-build-previous-1',
      current,
    ];

    expect(policy.selectExpiredShellCacheNames(seededCaches, current)).toEqual([
      'parium-shell-build-oldest',
    ]);
    expect(policy.selectExpiredShellCacheNames(
      [...seededCaches, 'parium-shell-build-next'],
      'parium-shell-build-next',
    )).toEqual([
      'parium-shell-build-oldest',
      'parium-shell-build-previous-2',
    ]);
  });

  it.each([
    ['legacy tab', [true, false], false],
    ['frozen current tab', [false], false],
    ['normal first install', [true], true],
    ['future safe multi-tab update', [true, true, true], true],
  ] as const)('%s produces the safe activation decision', async (
    _label,
    acknowledgements,
    expected,
  ) => {
    const policy = await vi.importActual<ServiceWorkerPolicyModule>(
      '@/lib/serviceWorkerPolicy',
    );

    expect(policy.shouldActivateShellWorker(acknowledgements)).toBe(expected);
  });
});
