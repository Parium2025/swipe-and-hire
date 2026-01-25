import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
  favicon_url: string | null;
}

// URL detection regex
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches ? [...new Set(matches)] : [];
}

export function useLinkPreview(url: string | null) {
  return useQuery({
    queryKey: ['link-preview', url],
    queryFn: async (): Promise<LinkPreview | null> => {
      if (!url) return null;

      // First check local cache in database
      const { data: cached } = await supabase
        .from('link_previews')
        .select('*')
        .eq('url', url)
        .single();

      if (cached) {
        return cached as LinkPreview;
      }

      // Fetch via edge function
      const { data, error } = await supabase.functions.invoke('fetch-link-preview', {
        body: { url },
      });

      if (error) {
        console.error('Failed to fetch link preview:', error);
        return null;
      }

      if (!data?.success) {
        console.error('Link preview error:', data?.error);
        return null;
      }

      return data.data as LinkPreview;
    },
    enabled: !!url,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
  });
}
