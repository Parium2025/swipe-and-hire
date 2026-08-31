import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepoFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const unregisterAll = /\.unregister\s*\(/;
const deleteCachesDirectly = /caches\s*\.\s*delete\s*\(/;

const automaticLifecycleFiles = [
  ['HTML bootstrap', 'index.html', [unregisterAll, deleteCachesDirectly]],
  ['React bootstrap', 'src/main.tsx', [
    /\bforceServiceWorkerReset\s*\(\s*\)\s*;/,
    /\bnukeStaleCaches\s*\(\s*\)\s*;/,
  ]],
  ['legacy reset hook', 'src/lib/swForceReset.ts', [unregisterAll, deleteCachesDirectly]],
  ['version watcher', 'src/lib/versionWatcher.ts', [/purgeCaches\s*:/]],
  ['reload coordinator', 'src/lib/appReloader.ts', [unregisterAll, deleteCachesDirectly]],
  ['error recovery', 'src/components/GlobalErrorBoundary.tsx', [unregisterAll, deleteCachesDirectly]],
] as const;

describe('automatic service-worker lifecycle safety contract', () => {
  it.each(automaticLifecycleFiles)(
    '%s never globally unregisters workers or purges caches',
    (_label, path, forbiddenPatterns) => {
      const source = readRepoFile(path);
      const violations = forbiddenPatterns
        .filter((pattern) => pattern.test(source))
        .map(String);

      expect(violations, `${path} contains destructive automatic lifecycle code`).toEqual([]);
    },
  );

  it('registers the Home shell only from jobseeker Home and only in production', () => {
    const mainSource = readRepoFile('src/main.tsx');
    const homeSource = readRepoFile('src/components/JobSeekerHome.tsx');

    expect(mainSource).not.toContain('registerServiceWorker');
    expect(homeSource).toContain('if (!import.meta.env.PROD) return;');
    expect(homeSource).toMatch(/const registerShell = \(\)(?:: boolean)? => \{[\s\S]+registerServiceWorkerForHome\(\)/);
    expect(homeSource).toContain("requestAppReload('service-worker-upgrade')");
  });

  it('gates Workbox installation before creating a shell cache or claiming clients', () => {
    const workerSource = readRepoFile('src/sw.ts');
    const managerSource = readRepoFile('src/lib/serviceWorkerManager.ts');
    const reloadSource = readRepoFile('src/lib/appReloader.ts');
    const homeSource = readRepoFile('src/components/JobSeekerHome.tsx');

    expect(workerSource).toContain('createShellBuildSuffix(manifest)');
    expect(workerSource).toContain('PrecacheController');
    expect(workerSource).toContain('precacheController.addToCacheList(manifest)');
    expect(workerSource).toContain("self.addEventListener('install'");
    expect(workerSource).toContain('await precacheController.install(event)');
    expect(workerSource).toContain('await precacheController.activate(event)');
    expect(workerSource).toContain('precacheController.matchPrecache');
    expect(workerSource).not.toMatch(/\bprecache\(manifest\)/);
    expect(workerSource).not.toContain('cleanupOutdatedCaches');
    expect(workerSource).toMatch(/caches\.keys\(\)/);
    expect(workerSource).toContain('isLegacyPrivateCacheName');
    expect(workerSource).toContain('isRetainedShellCacheName');
    expect(workerSource).toContain('matchRetainedShellAsset');
    expect(workerSource).not.toContain('self.clients.claim()');
    expect(workerSource).toContain('selectExpiredShellCacheNames');
    expect(workerSource).toContain('allOpenWindowClientsAcknowledgeSafeBuild');
    expect(workerSource).toContain('shouldActivateShellWorker');
    expect(workerSource).toContain('SERVICE_WORKER_ACTIVATION_RESULT');
    expect(workerSource).toContain("clientUrl.origin !== self.location.origin");
    expect(workerSource).toContain('includeUncontrolled: true');
    expect(workerSource).toContain("throw new Error('unsafe-open-client')");
    expect(workerSource).not.toContain('caches.delete(workboxCacheNames.precache)');
    expect(workerSource).not.toContain('self.registration.unregister()');
    expect(workerSource).not.toContain('client.navigate(');
    expect(workerSource).not.toContain('LEGACY_CLIENT_MIGRATION_MARKER_CACHE');
    expect(managerSource).not.toContain('ACTIVATION_PREFLIGHT_TIMEOUT_MS');
    expect(workerSource.indexOf('allOpenWindowClientsAcknowledgeSafeBuild()'))
      .toBeLessThan(workerSource.indexOf('precacheController.install(event)'));
    expect(workerSource.match(/allOpenWindowClientsAcknowledgeSafeBuild\(\)/g))
      .toHaveLength(3);
    expect(workerSource).toMatch(
      /if \(!await allOpenWindowClientsAcknowledgeSafeBuild\(\)\)[\s\S]+await self\.skipWaiting\(\)/,
    );
    expect(workerSource).toMatch(
      /precacheController\.activate\(event\)[\s\S]+allOpenWindowClientsAcknowledgeSafeBuild\(\)[\s\S]+cacheNames\.filter\(isLegacyPrivateCacheName\)/,
    );
    expect(homeSource).toContain("requestAppReload('service-worker-upgrade')");
    expect(homeSource).toContain('installLimitedHomeServiceWorkerRetry');
    expect(reloadSource).toContain("reason !== 'user-action'");
  });

  it('installs the non-destructive build handshake before React bootstrap', () => {
    const mainSource = readRepoFile('src/main.tsx');

    expect(mainSource).toContain('installServiceWorkerBuildHandshake');
    expect(mainSource).toMatch(/installServiceWorkerBuildHandshake\(\);[\s\S]+void bootstrap\(\);/);
  });

  it('uses one canonical offline-capable manifest URL and install identity', () => {
    const html = readRepoFile('index.html');
    const manifest = JSON.parse(readRepoFile('public/manifest.json')) as {
      id?: string;
      orientation?: string;
    };

    expect(html).toContain('<link rel="manifest" href="/manifest.json">');
    expect(html).not.toMatch(/manifest\.json\?/);
    expect(manifest.id).toBe('/');
    expect(manifest.orientation).toBe('any');
  });

  it('does not let the legacy portrait warning hide Home in touch landscape', () => {
    const html = readRepoFile('index.html');

    expect(html).toContain("classList.toggle('parium-home-route', path === '/home')");
    expect(html).toMatch(
      /body\[data-jobseeker-home-active="true"\]\s+#root\s*\{\s*visibility:\s*visible/,
    );
  });

  it('fails the production build when Home static imports are missing from precache', () => {
    const packageJson = JSON.parse(readRepoFile('package.json')) as {
      scripts?: Record<string, string>;
    };
    const verifier = readRepoFile('scripts/verify-offline-precache.mjs');

    expect(packageJson.scripts?.postbuild).toBe('node scripts/verify-offline-precache.mjs');
    expect(verifier).toContain('missingFromPrecache');
    expect(verifier).toContain('MAX_PRECACHE_BYTES');
  });
});
