import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('shared notification entrance', () => {
  it('keeps toast entrance visible above the auth cover for either role', () => {
    const toaster = readFileSync('src/components/ui/sonner.tsx', 'utf8');
    expect(toaster).toContain('style={{ zIndex: 2147483647 }}');
    expect(toaster).toContain('if (!mounted) return null;');
    expect(toaster).not.toContain("role === 'employer'");
    const splash = readFileSync('src/components/AuthSplashScreen.tsx', 'utf8');
    expect(splash).toContain('zIndex: 2147483646');
    const nav = readFileSync('src/components/JobSeekerTopNav.tsx', 'utf8');
    expect(nav).toContain('<CountBadge count={totalNewMatches}');
  });

  it('uses a single non-forward-filled transform entrance without overriding removed toasts', () => {
    const css = readFileSync('src/index.css', 'utf8');
    const entrance = css.slice(css.indexOf('@keyframes parium-toast-in'), css.indexOf('/* Klockans räknare'));
    expect(entrance).toContain('transform: var(--y)');
    expect(entrance).toContain('480ms cubic-bezier(0.4, 0, 0.2, 1) backwards');
    expect(entrance).toContain(':not([data-removed="true"])');
    expect(entrance).toContain(':not([data-swiping="true"])');
    expect(entrance).toContain('@media (prefers-reduced-motion: reduce)');
    expect(entrance).not.toContain('translate:');
    expect(entrance).not.toContain(' both');
    expect(css).toContain('[data-sonner-toast].parium-toast-repeat [data-title]');
  });
});