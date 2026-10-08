import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('applied status survives a document restart', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });

  it('serializes a Set and restores it synchronously for its owner', async () => {
    const persistence = await import('../queryPersistence');
    const source = new QueryClient();
    persistence.startQueryPersistence(source);
    persistence.restoreQuerySnapshot(source, 'owner');
    source.setQueryData(['applied-job-ids', 'owner'], new Set(['job-1', 'job-2']));
    window.dispatchEvent(new Event('pagehide'));
    const saved = JSON.parse(localStorage.getItem('parium-rq-snapshot:v2:owner') ?? '{}');
    expect(saved.state.queries[0].state.data).toEqual(['job-1', 'job-2']);
    const restored = new QueryClient();
    persistence.restoreQuerySnapshot(restored, 'owner', true);
    expect(restored.getQueryData(['applied-job-ids', 'owner'])).toEqual(new Set(['job-1', 'job-2']));
    const other = new QueryClient();
    persistence.restoreQuerySnapshot(other, 'other');
    expect(other.getQueryData(['applied-job-ids', 'owner'])).toBeUndefined();
    persistence.clearQuerySnapshots();
  });

  it('rejects wrong-account and malformed applied arrays', async () => {
    const persistence = await import('../queryPersistence');
    const client = new QueryClient();
    const query = (id: string, data: unknown) => ({ queryKey: ['applied-job-ids', id], queryHash: JSON.stringify(['applied-job-ids', id]), state: { data, status: 'success', dataUpdatedAt: Date.now() } });
    localStorage.setItem('parium-rq-snapshot:v2:owner', JSON.stringify({ t: Date.now(), state: { queries: [query('other', ['job-1']), query('owner', {})] } }));
    persistence.restoreQuerySnapshot(client, 'owner');
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    persistence.clearQuerySnapshots();
  });

  it('removes corrupt snapshot envelopes without crashing', async () => {
    const persistence = await import('../queryPersistence');
    localStorage.setItem('parium-rq-snapshot:v2:owner', JSON.stringify({ t: Date.now(), state: { queries: {} } }));
    expect(() => persistence.restoreQuerySnapshot(new QueryClient(), 'owner')).not.toThrow();
    expect(localStorage.getItem('parium-rq-snapshot:v2:owner')).toBeNull();
  });
});