// Supabase Edge Function: migrate-profile-images
// Purpose: Move profile and cover images from public bucket (profile-media) to private bucket (job-applications)
// and fix database fields to store permanent storage paths (never signed URLs).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// CORS headers for web calls
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MigrationSummary {
  success: boolean;
  dryRun: boolean;
  profilesChecked: number;
  imagesMoved: number;
  imagesFixedInDb: number;
  skipped: number;
  errors: { user_id: string; field: string; message: string }[];
  details: Array<{
    user_id: string;
    action: string;
    field: 'profile_image_url' | 'cover_image_url';
    fromBucket?: string;
    toBucket?: string;
    path: string;
  }>;
}

function extractStoragePath(input: string | null): string | null {
  if (!input) return null;
  if (!input.startsWith('http')) return input; // already a path

  // Handle both public and signed URLs
  const match = input.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:\?|$)/);
  if (match) return match[1];

  // Fallback: return as-is
  try { return new URL(input).pathname.split('/').slice(5).join('/'); } catch { return input; }
}

async function objectExists(supabase: any, bucket: string, path: string) {
  try {
    const { data, error } = await supabase.storage.from(bucket).list(path.split('/').slice(0, -1).join('/') || '', {
      search: path.split('/').pop(),
      limit: 1,
    });
    if (error) return false;
    return Array.isArray(data) && data.some((o) => o.name === path.split('/').pop());
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dryRun = false } = await req.json().catch(() => ({ dryRun: false }));

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const summary: MigrationSummary = {
      success: true,
      dryRun,
      profilesChecked: 0,
      imagesMoved: 0,
      imagesFixedInDb: 0,
      skipped: 0,
      errors: [],
      details: [],
    };

    // Fetch profiles that might have profile/cover images (limit batch size for safety)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, profile_image_url, cover_image_url')
      .limit(2000);

    if (profilesError) throw profilesError;

    for (const p of profiles || []) {
      summary.profilesChecked++;

      for (const field of ['profile_image_url', 'cover_image_url'] as const) {
        const raw = p[field] as string | null;
        const path = extractStoragePath(raw);
        if (!path || !p.user_id) { summary.skipped++; continue; }

        // Determine where the object currently is
        const inPrivate = await objectExists(supabase, 'job-applications', path);
        if (inPrivate) {
          // If in private and DB already stores a plain path, nothing to do
          continue;
        }

        // Check public bucket (legacy)
        const inPublic = await objectExists(supabase, 'profile-media', path);
        if (!inPublic) {
          // Nothing we can do; log and continue
          summary.skipped++;
          continue;
        }

        // Download from public
        const { data: fileData, error: dlErr } = await supabase.storage.from('profile-media').download(path);
        if (dlErr || !fileData) {
          summary.errors.push({ user_id: p.user_id, field, message: `Download failed: ${dlErr?.message}` });
          summary.success = false;
          continue;
        }

        if (!dryRun) {
          // Upload to private with same path
          const { error: upErr } = await supabase.storage.from('job-applications').upload(path, fileData, { upsert: true });
          if (upErr) {
            summary.errors.push({ user_id: p.user_id, field, message: `Upload failed: ${upErr.message}` });
            summary.success = false;
            continue;
          }

          // Update DB to store the plain path (never a full URL)
          const { error: updErr } = await supabase
            .from('profiles')
            .update({ [field]: path })
            .eq('user_id', p.user_id);
          if (updErr) {
            summary.errors.push({ user_id: p.user_id, field, message: `DB update failed: ${updErr.message}` });
            summary.success = false;
            continue;
          }

          // Attempt to delete from public bucket to avoid duplicates
          await supabase.storage.from('profile-media').remove([path]);

          summary.imagesMoved++;
          summary.imagesFixedInDb++;
          summary.details.push({ user_id: p.user_id, action: 'moved_and_updated', field, fromBucket: 'profile-media', toBucket: 'job-applications', path });
        } else {
          summary.details.push({ user_id: p.user_id, action: 'would_move', field, fromBucket: 'profile-media', toBucket: 'job-applications', path });
        }
      }
    }

    return new Response(JSON.stringify(summary), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});