import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('shared notification entrance', () => {
  it('keeps toast entrance visible above the auth cover for either role', () => {
    const toaster = readFileSync('src/components/ui/sonner.tsx', 'utf8');
    expect(toaster).toContain('style={{ zIndex: 2147483647 }}');
    expect(toaster).toContain('if (!mounted) return null;');
    expect(toaster).not.toContain("role === 'employer'");
  });
});