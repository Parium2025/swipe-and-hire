import { supabase } from '@/integrations/supabase/client';
import { COMPANY_LOGO_TRANSFORM } from '@/lib/imageTransforms';

export function resolveCompanyLogoUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const version = parsed.searchParams.get('t') || parsed.searchParams.get('v') || undefined;
    const match = parsed.pathname.match(/\/storage\/v1\/(?:object|render\/image)\/public\/company-logos\/(.+)$/);

    if (match?.[1]) {
      const path = decodeURIComponent(match[1]);
      const { data } = supabase.storage
        .from('company-logos')
        .getPublicUrl(path, { transform: COMPANY_LOGO_TRANSFORM });

      if (!data?.publicUrl) return trimmed;
      if (!version) return data.publicUrl;

      const transformed = new URL(data.publicUrl);
      transformed.searchParams.set('v', version);
      return transformed.toString();
    }
  } catch {
    // Fall through to storage-path handling below.
  }

  if (trimmed.startsWith('http')) return trimmed;

  const { data } = supabase.storage
    .from('company-logos')
    .getPublicUrl(trimmed, { transform: COMPANY_LOGO_TRANSFORM });
  return data?.publicUrl || trimmed;
}