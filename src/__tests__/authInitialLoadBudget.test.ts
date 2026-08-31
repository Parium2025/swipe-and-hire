import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Auth initial-load budget', () => {
  it('does not pull the no-op global system health panel into the App chunk', () => {
    const app = read('src/App.tsx');

    expect(app).not.toContain('import { SystemHealthPanel }');
    expect(app).not.toContain('<SystemHealthPanel />');
    expect(app).not.toContain('animReady');
  });

  it('uses one canonical auth-logo URL instead of emitting duplicate assets', () => {
    const canonicalLogo = read('src/assets/authLogo.ts');
    const consumers = [
      read('src/main.tsx'),
      read('src/assets/authLogoInline.tsx'),
      read('src/components/AuthSplashScreen.tsx'),
      read('src/components/CriticalAssetPreloads.tsx'),
    ].join('\n');

    expect(canonicalLogo).toContain("'/parium-auth-logo.png'");
    expect(consumers).not.toContain('parium-auth-logo.png?inline');
  });

  it('does not globally high-priority preload the second identical Lovable logo', () => {
    const html = read('index.html');

    expect(html).not.toMatch(
      /<link rel="preload" as="image" href="\/lovable-uploads\/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57\.png"/,
    );
  });
});
