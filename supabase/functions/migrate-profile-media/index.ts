import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { dryRun = true } = await req.json();

    console.log(`Starting profile media security migration (dry run: ${dryRun})`);
    console.log('Moving videos from profile-media (public) to job-applications (private) for security');

    // Get all profiles with video URLs in profile-media bucket (OLD insecure location)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, user_id, video_url, cover_image_url')
      .not('video_url', 'is', null)
      .ilike('video_url', '%/profile-media/%');

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    console.log(`Found ${profiles?.length || 0} profiles with videos in profile-media bucket (need to move to private bucket)`);

    const results = {
      profilesProcessed: 0,
      videosMovedOrPlanned: 0,
      errors: [] as string[],
      details: [] as any[],
    };

    for (const profile of profiles || []) {
      // Handle video - move from public profile-media to private job-applications
      if (profile.video_url?.includes('/profile-media/')) {
        try {
          // Extract storage path from URL or use as-is if it's already a path
          let oldPath = profile.video_url;
          if (oldPath.includes('/storage/v1/object/')) {
            const match = oldPath.match(/\/profile-media\/(.+?)(\?|$)/);
            if (match) oldPath = match[1];
          } else if (oldPath.startsWith('http')) {
            // Full URL without /storage/ - try to extract path
            const parts = oldPath.split('/profile-media/');
            if (parts.length > 1) {
              oldPath = parts[1].split('?')[0];
            }
          }

          const fileExt = oldPath.split('.').pop()?.split('?')[0];
          const newPath = `${profile.user_id}/${Date.now()}-video.${fileExt}`;

          if (!dryRun) {
            // Download from old PUBLIC bucket
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('profile-media')
              .download(oldPath);

            if (downloadError) {
              console.error(`Failed to download video: ${downloadError.message}`);
              results.errors.push(`Profile ${profile.id} video download: ${downloadError.message}`);
              continue;
            }

            // Upload to new PRIVATE bucket
            const { error: uploadError } = await supabase.storage
              .from('job-applications')
              .upload(newPath, fileData, {
                contentType: fileData.type,
                upsert: false,
              });

            if (uploadError) {
              console.error(`Failed to upload video to private bucket: ${uploadError.message}`);
              results.errors.push(`Profile ${profile.id} video upload: ${uploadError.message}`);
              continue;
            }

            // Update profile with STORAGE PATH (not URL) - critical for security
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ video_url: newPath }) // Store path only, not URL
              .eq('id', profile.id);

            if (updateError) {
              console.error(`Failed to update profile: ${updateError.message}`);
              results.errors.push(`Profile ${profile.id} update: ${updateError.message}`);
              continue;
            }

            // Delete old video from public bucket
            const { error: deleteError } = await supabase.storage
              .from('profile-media')
              .remove([oldPath]);

            if (deleteError) {
              console.warn(`Could not delete old video (non-critical): ${deleteError.message}`);
            }

            results.videosMovedOrPlanned++;
            results.profilesProcessed++;
            
            console.log(`✓ Moved video for profile ${profile.id}: ${oldPath} -> ${newPath} (now PRIVATE)`);
          } else {
            console.log(`[DRY RUN] Would move video to PRIVATE bucket: ${oldPath} -> job-applications/${newPath}`);
            results.details.push({
              profile_id: profile.id,
              user_id: profile.user_id,
              type: 'video',
              old_bucket: 'profile-media (PUBLIC)',
              new_bucket: 'job-applications (PRIVATE)',
              old_path: oldPath,
              new_path: newPath,
            });
            results.videosMovedOrPlanned++;
          }
        } catch (error) {
          console.error('Error processing video:', error);
          results.errors.push(`Profile ${profile.id} video: ${error.message}`);
        }
      }
    }

    console.log('Security migration completed:', results);
    console.log(`Videos are now stored in PRIVATE bucket and require permissions to view`);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});