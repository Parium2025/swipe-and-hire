import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { storage: { from: vi.fn() } },
}));

vi.mock('@/lib/uploadWithProgress', () => ({
  uploadWithRetry: vi.fn(),
  UploadAbortedError: class UploadAbortedError extends Error {},
}));

import { uploadMedia } from '@/lib/mediaManager';

describe('uploadMedia image security', () => {
  it('rejects SVG MIME before upload', async () => {
    const file = new File(['<svg/>'], 'avatar.svg', { type: 'image/svg+xml' });
    const result = await uploadMedia(file, 'profile-image', 'user-1');
    expect(result.storagePath).toBe('');
    expect(result.error?.message).toContain('SVG');
  });

  it('rejects a disguised SVG extension', async () => {
    const file = new File(['<svg/>'], 'avatar.svg', { type: 'image/png' });
    const result = await uploadMedia(file, 'company-logo', 'user-1');
    expect(result.storagePath).toBe('');
    expect(result.error?.message).toContain('SVG');
  });
});