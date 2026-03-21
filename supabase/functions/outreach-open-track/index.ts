import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(supabaseUrl, serviceRoleKey);

const pixelBytes = Uint8Array.from(
  atob('R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='),
  (char) => char.charCodeAt(0),
);

const pixelResponse = () => new Response(pixelBytes, {
  headers: {
    ...corsHeaders,
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const logId = url.searchParams.get('logId');

    if (logId) {
      const { data: log } = await admin
        .from('outreach_dispatch_logs')
        .select('id, status, channel, payload')
        .eq('id', logId)
        .maybeSingle();

      if (log && log.channel === 'email' && log.status !== 'failed') {
        const nowIso = new Date().toISOString();
        const payload = log.payload && typeof log.payload === 'object' && !Array.isArray(log.payload)
          ? log.payload as Record<string, unknown>
          : {};

        await admin
          .from('outreach_dispatch_logs')
          .update({
            status: 'opened',
            payload: {
              ...payload,
              opened_at: typeof payload.opened_at === 'string' ? payload.opened_at : nowIso,
              last_opened_at: nowIso,
            },
          })
          .eq('id', logId);
      }
    }
  } catch (error) {
    console.error('outreach-open-track error', error);
  }

  return pixelResponse();
});