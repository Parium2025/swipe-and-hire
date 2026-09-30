import { describe, it, expect, vi, beforeEach } from 'vitest';

// Regression: trycker man på en ny notis innan den hunnit synkas till kontot
// ska serverkopian skapas som läst — annars kom den röda pricken tillbaka.
const inserted: any[] = [];

vi.mock('@/integrations/supabase/client', () => {
  const selectChain: any = {
    select: () => selectChain,
    eq: () => selectChain,
    gte: () => selectChain,
    limit: () => Promise.resolve({ data: [], error: null }),
  };
  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
      from: () => ({
        ...selectChain,
        insert: (row: any) => {
          inserted.push(row);
          const result = { data: { id: `srv-${inserted.length}` }, error: null };
          return { select: () => ({ single: () => Promise.resolve(result) }) };
        },
      }),
    },
  };
});

describe('toastArchive', () => {
  beforeEach(() => {
    inserted.length = 0;
    localStorage.clear();
    vi.useFakeTimers();
  });

  it('skapar serverkopian som läst när notisen redan trycktes på', async () => {
    const { toastArchive, setToastArchiveUser } = await import('@/lib/toastArchive');
    setToastArchiveUser('u1');
    toastArchive.add('error', 'Fel', 'Adressen tillhör redan ett annat företag.');
    const id = toastArchive.getSnapshot()[0].id;
    toastArchive.markAsRead(id);

    await vi.advanceTimersByTimeAsync(2000);
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 0));

    expect(inserted).toHaveLength(1);
    expect(inserted[0].is_read).toBe(true);
  });

  // Regression: den lokala kopian togs bort direkt efter synk, så klockan var
  // tom tills omhämtningen var klar — siffran "1" försvann och studsade in igen.
  it('behåller lokala kopian tills klockan laddat serverkopian', async () => {
    const { toastArchive, setToastArchiveUser } = await import('@/lib/toastArchive');
    setToastArchiveUser('u1');
    toastArchive.clear();
    toastArchive.add('error', 'Fel igen', 'Något gick snett.');

    await vi.advanceTimersByTimeAsync(2000);
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 0));

    const [local] = toastArchive.getSnapshot();
    expect(local).toBeDefined();
    expect(local.is_read).toBe(false);
    expect(local.syncedId).toBe(`srv-${inserted.length}`);

    toastArchive.pruneSynced(new Set([local.syncedId!]));
    expect(toastArchive.getSnapshot()).toHaveLength(0);
  });
});
