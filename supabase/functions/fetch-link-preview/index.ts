import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
  favicon_url: string | null;
}

function extractMetaTags(html: string, baseUrl: string): Partial<LinkPreview> {
  const getMetaContent = (name: string): string | null => {
    // Try og: tags first
    const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${name}["'][^>]*content=["']([^"']+)["']`, 'i'))
      || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${name}["']`, 'i'));
    if (ogMatch) return ogMatch[1];

    // Try twitter: tags
    const twitterMatch = html.match(new RegExp(`<meta[^>]*name=["']twitter:${name}["'][^>]*content=["']([^"']+)["']`, 'i'))
      || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:${name}["']`, 'i'));
    if (twitterMatch) return twitterMatch[1];

    // Try standard meta tags
    const metaMatch = html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'))
      || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`, 'i'));
    if (metaMatch) return metaMatch[1];

    return null;
  };

  // Extract title
  let title = getMetaContent('title');
  if (!title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    title = titleMatch ? titleMatch[1].trim() : null;
  }

  // Extract description
  const description = getMetaContent('description');

  // Extract image
  let imageUrl = getMetaContent('image');
  if (imageUrl && !imageUrl.startsWith('http')) {
    try {
      imageUrl = new URL(imageUrl, baseUrl).href;
    } catch {
      imageUrl = null;
    }
  }

  // Extract site name
  const siteName = getMetaContent('site_name');

  // Extract favicon
  let faviconUrl: string | null = null;
  const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i)
    || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i);
  if (faviconMatch) {
    faviconUrl = faviconMatch[1];
    if (!faviconUrl.startsWith('http')) {
      try {
        faviconUrl = new URL(faviconUrl, baseUrl).href;
      } catch {
        faviconUrl = null;
      }
    }
  }
  if (!faviconUrl) {
    try {
      faviconUrl = new URL('/favicon.ico', baseUrl).href;
    } catch {
      faviconUrl = null;
    }
  }

  return {
    title,
    description,
    image_url: imageUrl,
    site_name: siteName,
    favicon_url: faviconUrl,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check cache first
    const { data: cached } = await supabase
      .from('link_previews')
      .select('*')
      .eq('url', url)
      .single();

    if (cached) {
      // Return cached preview if less than 7 days old
      const fetchedAt = new Date(cached.fetched_at);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (fetchedAt > weekAgo) {
        console.log('Returning cached preview for:', url);
        return new Response(
          JSON.stringify({ success: true, data: cached }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Fetching preview for:', url);

    // Fetch the URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    let html: string;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      html = await response.text();
    } catch (fetchError) {
      console.error('Failed to fetch URL:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch URL' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract metadata
    const metadata = extractMetaTags(html, parsedUrl.origin);
    const preview: LinkPreview = {
      url,
      title: metadata.title || null,
      description: metadata.description || null,
      image_url: metadata.image_url || null,
      site_name: metadata.site_name || parsedUrl.hostname,
      favicon_url: metadata.favicon_url || null,
    };

    // Save to cache
    const { error: upsertError } = await supabase
      .from('link_previews')
      .upsert({
        url,
        ...preview,
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'url' });

    if (upsertError) {
      console.error('Failed to cache preview:', upsertError);
    }

    console.log('Preview fetched successfully:', preview.title);
    return new Response(
      JSON.stringify({ success: true, data: preview }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching link preview:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch preview' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
