import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(process.cwd(), 'src/components/WelcomeTunnel.tsx'), 'utf8');

describe('jobbsökarens välkomstguide — ta bort/ångra', () => {
  it('använder synkrona spärrar mot snabba tryck', () => {
    expect(src).toContain('if (!mediaStateRef.current?.profileImageUrl) return;');
    expect(src).toContain('const deletedProfileMedia = deletedProfileMediaRef.current;');
    expect(src).toContain('if (!currentCover) return;');
    expect(src).toContain('if (!deletedCoverImage || mediaStateRef.current?.coverImageUrl) return;');
  });
  it('visar inga lyckade notiser vid ta bort/ångra', () => {
    expect(src).not.toContain('"Media borttagen"');
    expect(src).not.toContain('"Återställd!"');
  });
});
