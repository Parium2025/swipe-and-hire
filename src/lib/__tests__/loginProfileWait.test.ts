import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('inloggning väntar på profilen', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/hooks/useAuth.tsx'), 'utf8');

  it('släpper inte laddläget efter kort tid så att /auth blinkar tillbaka', () => {
    const match = src.match(/const maxWaitMs = (\d+);/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(8000);
  });
});
