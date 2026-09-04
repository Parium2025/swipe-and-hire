import { describe, it, expect } from 'vitest';
import { boundedCacheSnapshot } from '@/hooks/useJobsData';

const mk = (id: string, kind: 'active' | 'expired' | 'draft') => {
  const past = new Date(Date.now() - 86400000).toISOString();
  const future = new Date(Date.now() + 86400000).toISOString();
  if (kind === 'expired') return { id, is_active: true, published_at: past, expires_at: past } as any;
  if (kind === 'draft') return { id, is_active: false, published_at: null, expires_at: null } as any;
  return { id, is_active: true, published_at: past, expires_at: future } as any;
};

describe('boundedCacheSnapshot', () => {
  it('behåller ett begränsat antal rader per status så localStorage aldrig sprängs', () => {
    const jobs = [
      ...Array.from({ length: 300 }, (_, i) => mk(`a${i}`, 'active')),
      ...Array.from({ length: 5000 }, (_, i) => mk(`e${i}`, 'expired')),
      ...Array.from({ length: 400 }, (_, i) => mk(`d${i}`, 'draft')),
    ];
    const snapshot = boundedCacheSnapshot(jobs);
    expect(snapshot.length).toBe(54 * 3);
    expect(snapshot.filter(j => j.id.startsWith('e')).length).toBe(54);
    expect(snapshot[0].id).toBe('a0');
  });

  it('lämnar små listor orörda', () => {
    const jobs = [mk('a', 'active'), mk('d', 'draft')];
    expect(boundedCacheSnapshot(jobs)).toHaveLength(2);
  });
});
