import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('shared notification entrance', () => {
  it('starts toast entrance only after the auth cover releases for either role', () => {
    const toaster = readFileSync('src/components/ui/sonner.tsx', 'utf8');
    expect(toaster).toContain('authSplashEvents.subscribe');
    expect(toaster).toContain('if (!mounted || authCoverVisible) return null;');
    expect(toaster).not.toContain("role === 'employer'");
  });
});