import { describe, it, expect, vi } from 'vitest';

// Regression: trycket kom MEDAN notisen sparades på kontot. Serverkopian
// skapades oläst och ettan på klockan kom tillbaka efter ett par sekunder.
const updates: Array<{ row: any; id?: string }> = [];
let releaseInsert: () => void = () => {};

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
        insert: () => ({
          select: () => ({
            single: () =>
              new Promise((resolve) => {
                releaseInsert = () => resolve({ data: { id: 'srv-1' }, error: null });
              }),
          }),
        }),
        update: (row: any) => {
          const entry: { row: any; id?: string } = { row };
          updates.push(entry);
          const chain: any = {
            eq: (col: string, val: string) => {
              if (col === 'id') entry.id = val;
              return chain;
            },
            then: (r: any) => Promise.resolve({ error: null }).then(r),
          };
          return chain;
        },
      }),
    },
  };
});

describe('toastArchive: tryck under pågående synk', () => {
  it('markerar kontots kopia som läst när trycket kom under inserten', async () => {
    vi.useFakeTimers();
    localStorage.clear();
    const { toastArchive, setToastArchiveUser } = await import('@/lib/toastArchive');
    setToastArchiveUser('u1');
    toastArchive.add('info', 'Ny notis', 'Testar.');
    const id = toastArchive.getSnapshot()[0].id;

    await vi.advanceTimersByTimeAsync(1500); // synken startar, inserten hänger
    toastArchive.markAsRead(id); // användaren trycker nu
    vi.useRealTimers();
    releaseInsert();
    await new Promise((r) => setTimeout(r, 10));

    expect(updates.some((u) => u.row.is_read === true && u.id === 'srv-1')).toBe(true);
    expect(toastArchive.getSnapshot()[0].syncedId).toBe('srv-1');
  });
});
