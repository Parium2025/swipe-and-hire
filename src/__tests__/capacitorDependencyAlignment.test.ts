import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Capacitor native dependency contract', () => {
  it('keeps all official Capacitor packages on the same major as core', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    const dependencies = packageJson.dependencies ?? {};
    const officialPackages = Object.entries(dependencies)
      .filter(([name]) => name.startsWith('@capacitor/'));
    const coreMajor = dependencies['@capacitor/core']?.match(/\d+/)?.[0];

    expect(coreMajor).toBeDefined();
    expect(
      officialPackages.map(([name, range]) => [name, range.match(/\d+/)?.[0]]),
    ).toEqual(officialPackages.map(([name]) => [name, coreMajor]));
  });
});

describe('repository Node script contract', () => {
  it('uses a Node version that can execute TypeScript entrypoints without flags', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { engines?: { node?: string }; scripts?: Record<string, string> };

    expect(packageJson.engines?.node).toBe('>=22.18.0 <25');
    expect(packageJson.scripts?.prebuild).toMatch(/^node\s+/);
    expect(packageJson.scripts?.['load:test']).toBe('node scripts/load-test.ts');
  });

  it('uses an explicit TypeScript extension for the native Node ESM import', () => {
    const loadTest = readFileSync(
      resolve(process.cwd(), 'scripts/load-test.ts'),
      'utf8',
    );
    expect(loadTest).toContain("from './load-test-safety.ts'");
  });

  it('bounds the build-time sitemap request so an unavailable backend cannot hang CI', () => {
    const sitemapScript = readFileSync(
      resolve(process.cwd(), 'scripts/generate-job-sitemap.ts'),
      'utf8',
    );
    expect(sitemapScript).toMatch(/signal:\s*AbortSignal\.timeout\(\d[\d_]*\)/);
  });
});
