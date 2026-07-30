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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function rawHostname(input: string): string | null {
  const match = input.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i);
  if (!match) return null;
  let host = match[1].split('@').pop() ?? '';
  if (host.startsWith('[')) return host.slice(1, host.indexOf(']'));
  return host.split(':')[0] || null;
}

function cleanHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function parseDottedIPv4(hostname: string): number[] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((part) => part.length === 0)) return null;
  const nums = parts.map((part) => {
    if (!/^\d+$/.test(part)) return NaN;
    const n = Number(part);
    return Number.isInteger(n) && n >= 0 && n <= 255 ? n : NaN;
  });
  return nums.every(Number.isFinite) ? nums : null;
}

function isPrivateIPv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIPv6(hostname: string): boolean {
  const h = cleanHostname(hostname);
  if (h === '::1') return true;
  if (h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true;
  const mapped = h.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) {
    const parts = parseDottedIPv4(mapped[1]);
    return !parts || isPrivateIPv4(parts);
  }
  return false;
}

function isSuspiciousNumericHost(hostname: string): boolean {
  const h = cleanHostname(hostname);
  if (/^\d+$/.test(h)) return true;
  if (/^0x[0-9a-f]+$/i.test(h)) return true;
  if (/^[0-9a-fx.]+$/i.test(h) && h.includes('x')) return true;
  if (/^0\d+/.test(h) || h.split('.').some((part) => /^0\d+/.test(part))) return true;
  return false;
}

async function isBlockedHostname(hostname: string): Promise<boolean> {
  const h = cleanHostname(hostname);
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (isSuspiciousNumericHost(h)) return true;

  const directIPv4 = parseDottedIPv4(h);
  if (directIPv4) return isPrivateIPv4(directIPv4);
  if (h.includes(':')) return isPrivateIPv6(h);

  try {
    const [aRecords, aaaaRecords] = await Promise.all([
      Deno.resolveDns(h, 'A').catch(() => [] as string[]),
      Deno.resolveDns(h, 'AAAA').catch(() => [] as string[]),
    ]);
    const resolved = [...aRecords, ...aaaaRecords];
    if (resolved.length === 0) return true;
    return resolved.some((address) => {
      const v4 = parseDottedIPv4(address);
      if (v4) return isPrivateIPv4(v4);
      return isPrivateIPv6(address);
    });
  } catch {
    return true;
  }
}

async function validatePublicHttpUrl(input: string): Promise<URL | Response> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input);
  } catch {
    return jsonResponse({ success: false, error: 'Invalid URL' }, 400);
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return jsonResponse({ success: false, error: 'Only http/https URLs allowed' }, 400);
  }
  const rawHost = rawHostname(input);
  if (!rawHost || await isBlockedHostname(rawHost) || await isBlockedHostname(parsedUrl.hostname)) {
    return jsonResponse({ success: false, error: 'Private/internal addresses not allowed' }, 400);
  }
  return parsedUrl;
}

async function fetchHtmlWithSafeRedirects(startUrl: URL): Promise<{ html: string; finalUrl: URL }> {
  let currentUrl = startUrl;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const validation = await validatePublicHttpUrl(currentUrl.href);
    if (validation instanceof Response) throw new Error('Blocked URL');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(currentUrl.href, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        redirect: 'manual',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error(`HTTP ${response.status}`);
        currentUrl = new URL(location, currentUrl.href);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { html: await response.text(), finalUrl: currentUrl };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  throw new Error('Too many redirects');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === AUTH: require valid JWT ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims?.sub) {
      return jsonResponse({ success: false, error: 'Invalid authentication' }, 401);
    }

    const { url } = await req.json();

    if (!url) {
      return jsonResponse({ success: false, error: 'URL is required' }, 400);
    }

    // Validate URL — only http/https, block private/internal hosts, odd numeric encodings and unsafe redirects.
    const validation = await validatePublicHttpUrl(url);
    if (validation instanceof Response) return validation;
    const parsedUrl = validation;


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
        console.log('Returning cached preview');
        return new Response(
          JSON.stringify({ success: true, data: cached }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Fetching preview');

    let html: string;
    let finalUrl = parsedUrl;
    try {
      const fetched = await fetchHtmlWithSafeRedirects(parsedUrl);
      html = fetched.html;
      finalUrl = fetched.finalUrl;
    } catch (fetchError) {
      console.error('Failed to fetch URL:', fetchError);
      return jsonResponse({ success: false, error: 'Failed to fetch URL' }, 502);
    }

    // Extract metadata
    const metadata = extractMetaTags(html, finalUrl.origin);
    const preview: LinkPreview = {
      url,
      title: metadata.title || null,
      description: metadata.description || null,
      image_url: metadata.image_url || null,
      site_name: metadata.site_name || finalUrl.hostname,
      favicon_url: metadata.favicon_url || null,
    };

    // Save to cache
    const { error: upsertError } = await supabase
      .from('link_previews')
      .upsert({
        ...preview,
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'url' });

    if (upsertError) {
      console.error('Failed to cache preview:', upsertError);
    }

    console.log('Preview fetched successfully', { hasTitle: !!preview.title });
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
