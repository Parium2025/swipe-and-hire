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

    console.log(`Starting profile media migration (dry run: ${dryRun})`);

    // Get all profiles with media URLs in job-applications bucket
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, user_id, profile_image_url, video_url')
      .or('profile_image_url.ilike.%/job-applications/%,video_url.ilike.%/job-applications/%');

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    console.log(`Found ${profiles?.length || 0} profiles with media in job-applications bucket`);

    const results = {
      profilesProcessed: 0,
      filesMovedOrPlanned: 0,
      errors: [] as string[],
      details: [] as any[],
    };

    for (const profile of profiles || []) {
      const updates: any = {};
      let moved = false;

      // Handle profile image
      if (profile.profile_image_url?.includes('/job-applications/')) {
        try {
          // Extract path from URL or use as-is if it's a path
          let oldPath = profile.profile_image_url;
          if (oldPath.includes('/storage/v1/object/')) {
            const match = oldPath.match(/\/job-applications\/(.+?)(\?|$)/);
            if (match) oldPath = match[1];
          }

          const fileExt = oldPath.split('.').pop();
          const newPath = `${profile.user_id}/${Date.now()}-profile-image.${fileExt}`;

          if (!dryRun) {
            // Download from old bucket
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('job-applications')
              .download(oldPath);

            if (downloadError) {
              console.error(`Failed to download profile image: ${downloadError.message}`);
              results.errors.push(`Profile ${profile.id}: ${downloadError.message}`);
              continue;
            }

            // Upload to new bucket
            const { error: uploadError } = await supabase.storage
              .from('profile-media')
              .upload(newPath, fileData, {
                contentType: fileData.type,
                upsert: false,
              });

            if (uploadError) {
              console.error(`Failed to upload profile image: ${uploadError.message}`);
              results.errors.push(`Profile ${profile.id}: ${uploadError.message}`);
              continue;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('profile-media')
              .getPublicUrl(newPath);

            updates.profile_image_url = publicUrl;
            moved = true;
          } else {
            console.log(`[DRY RUN] Would move profile image: ${oldPath} -> ${newPath}`);
            results.details.push({
              profile_id: profile.id,
              type: 'profile_image',
              old_path: oldPath,
              new_path: newPath,
            });
            moved = true;
          }
        } catch (error) {
          console.error('Error processing profile image:', error);
          results.errors.push(`Profile ${profile.id} image: ${error.message}`);
        }
      }

      // Handle video
      if (profile.video_url?.includes('/job-applications/')) {
        try {
          let oldPath = profile.video_url;
          if (oldPath.includes('/storage/v1/object/')) {
            const match = oldPath.match(/\/job-applications\/(.+?)(\?|$)/);
            if (match) oldPath = match[1];
          }

          const fileExt = oldPath.split('.').pop()?.split('?')[0];
          const newPath = `${profile.user_id}/${Date.now()}-profile-video.${fileExt}`;

          if (!dryRun) {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('job-applications')
              .download(oldPath);

            if (downloadError) {
              console.error(`Failed to download video: ${downloadError.message}`);
              results.errors.push(`Profile ${profile.id} video: ${downloadError.message}`);
              continue;
            }

            const { error: uploadError } = await supabase.storage
              .from('profile-media')
              .upload(newPath, fileData, {
                contentType: fileData.type,
                upsert: false,
              });

            if (uploadError) {
              console.error(`Failed to upload video: ${uploadError.message}`);
              results.errors.push(`Profile ${profile.id} video: ${uploadError.message}`);
              continue;
            }

            const { data: { publicUrl } } = supabase.storage
              .from('profile-media')
              .getPublicUrl(newPath);

            updates.video_url = publicUrl;
            moved = true;
          } else {
            console.log(`[DRY RUN] Would move video: ${oldPath} -> ${newPath}`);
            results.details.push({
              profile_id: profile.id,
              type: 'video',
              old_path: oldPath,
              new_path: newPath,
            });
            moved = true;
          }
        } catch (error) {
          console.error('Error processing video:', error);
          results.errors.push(`Profile ${profile.id} video: ${error.message}`);
        }
      }

      // Update profile if we have changes
      if (!dryRun && Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', profile.id);

        if (updateError) {
          console.error(`Failed to update profile: ${updateError.message}`);
          results.errors.push(`Profile ${profile.id} update: ${updateError.message}`);
        }
      }

      if (moved) {
        results.filesMovedOrPlanned++;
        results.profilesProcessed++;
      }
    }

    console.log('Migration completed:', results);

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