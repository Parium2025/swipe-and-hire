import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MigrationResult {
  success: boolean;
  migratedProfiles: number;
  migratedCVs: number;
  errors: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Starting media migration...');
    
    const result: MigrationResult = {
      success: true,
      migratedProfiles: 0,
      migratedCVs: 0,
      errors: []
    };

    // All profilmedia ska vara i job-applications (PRIVATE) för säkerhet
    console.log('Fetching profiles with media...');
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('user_id, video_url, profile_image_url, cover_image_url')
      .or('video_url.not.is.null,profile_image_url.not.is.null,cover_image_url.not.is.null');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      result.errors.push(`Profile fetch error: ${profilesError.message}`);
    } else {
      console.log(`Found ${profiles?.length || 0} profiles with media`);
      
      for (const profile of profiles || []) {
        try {
          const updates: any = {};
          
          // Video - move from public profile-media to private job-applications and store storage path
          if (profile.video_url) {
            const original = profile.video_url as string;
            if (original.startsWith('http') && original.includes('/storage/v1/object/public/profile-media/')) {
              const path = extractStoragePath(original);
              try {
                const { data: fileData, error: dlErr } = await supabaseClient.storage
                  .from('profile-media')
                  .download(path!);
                if (dlErr) throw dlErr;
                const ext = path!.split('.').pop() || 'mp4';
                const newPath = `${profile.user_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                const { error: upErr } = await supabaseClient.storage
                  .from('job-applications')
                  .upload(newPath, fileData);
                if (upErr) throw upErr;
                updates.video_url = newPath;
                // best-effort delete old
                await supabaseClient.storage.from('profile-media').remove([path!]);
                console.log(`Moved video for ${profile.user_id} to private: ${newPath}`);
              } catch (e) {
                console.error('Video move error:', e);
                result.errors.push(`Video move error for ${profile.user_id}: ${e.message || e}`);
              }
            } else if (original.startsWith('http')) {
              const path = extractStoragePath(original);
              if (path && path.includes('/')) updates.video_url = path;
            }
          }
          
          // Profile image - move to private and store path
          if (profile.profile_image_url) {
            const original = profile.profile_image_url as string;
            if (original.startsWith('http') && original.includes('/storage/v1/object/public/profile-media/')) {
              const path = extractStoragePath(original);
              try {
                const { data: fileData, error: dlErr } = await supabaseClient.storage
                  .from('profile-media')
                  .download(path!);
                if (dlErr) throw dlErr;
                const ext = path!.split('.').pop() || 'jpg';
                const newPath = `${profile.user_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                const { error: upErr } = await supabaseClient.storage
                  .from('job-applications')
                  .upload(newPath, fileData);
                if (upErr) throw upErr;
                updates.profile_image_url = newPath;
                await supabaseClient.storage.from('profile-media').remove([path!]);
                console.log(`Moved profile image for ${profile.user_id} to private: ${newPath}`);
              } catch (e) {
                console.error('Profile image move error:', e);
                result.errors.push(`Profile image move error for ${profile.user_id}: ${e.message || e}`);
              }
            } else if (original.startsWith('http')) {
              const path = extractStoragePath(original);
              if (path && path.includes('/')) updates.profile_image_url = path;
            }
          }

          // Cover image - move to private and store path
          if (profile.cover_image_url) {
            const original = profile.cover_image_url as string;
            if (original.startsWith('http') && original.includes('/storage/v1/object/public/profile-media/')) {
              const path = extractStoragePath(original);
              try {
                const { data: fileData, error: dlErr } = await supabaseClient.storage
                  .from('profile-media')
                  .download(path!);
                if (dlErr) throw dlErr;
                const ext = path!.split('.').pop() || 'jpg';
                const newPath = `${profile.user_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                const { error: upErr } = await supabaseClient.storage
                  .from('job-applications')
                  .upload(newPath, fileData);
                if (upErr) throw upErr;
                updates.cover_image_url = newPath;
                await supabaseClient.storage.from('profile-media').remove([path!]);
                console.log(`Moved cover image for ${profile.user_id} to private: ${newPath}`);
              } catch (e) {
                console.error('Cover image move error:', e);
                result.errors.push(`Cover image move error for ${profile.user_id}: ${e.message || e}`);
              }
            } else if (original.startsWith('http')) {
              const path = extractStoragePath(original);
              if (path && path.includes('/')) updates.cover_image_url = path;
            }
          }
          
          // Uppdatera om vi har ändringar
          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabaseClient
              .from('profiles')
              .update(updates)
              .eq('user_id', profile.user_id);
            
            if (updateError) {
              console.error(`Error updating profile ${profile.user_id}:`, updateError);
              result.errors.push(`Profile update error for ${profile.user_id}: ${updateError.message}`);
            } else {
              result.migratedProfiles++;
              console.log(`Successfully migrated profile ${profile.user_id}`);
            }
          }
        } catch (error) {
          console.error(`Error processing profile ${profile.user_id}:`, error);
          result.errors.push(`Profile processing error for ${profile.user_id}: ${error.message}`);
        }
      }
    }

    // Migrera CV:n - säkerställ att de är i job-applications med storage paths
    console.log('Fetching profiles with CVs...');
    const { data: cvProfiles, error: cvError } = await supabaseClient
      .from('profiles')
      .select('user_id, cv_url')
      .not('cv_url', 'is', null);

    if (cvError) {
      console.error('Error fetching CV profiles:', cvError);
      result.errors.push(`CV fetch error: ${cvError.message}`);
    } else {
      console.log(`Found ${cvProfiles?.length || 0} profiles with CVs`);
      
      for (const profile of cvProfiles || []) {
        try {
          if (profile.cv_url) {
            const original = profile.cv_url as string;
            if (original.startsWith('http')) {
              const cvPath = extractStoragePath(original);
              if (cvPath && cvPath.includes('/')) {
                const { error: updateError } = await supabaseClient
                  .from('profiles')
                  .update({ cv_url: cvPath })
                  .eq('user_id', profile.user_id);
                if (updateError) {
                  console.error(`Error updating CV for ${profile.user_id}:`, updateError);
                  result.errors.push(`CV update error for ${profile.user_id}: ${updateError.message}`);
                } else {
                  result.migratedCVs++;
                  console.log(`Successfully migrated CV for ${profile.user_id}`);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing CV for ${profile.user_id}:`, error);
          result.errors.push(`CV processing error for ${profile.user_id}: ${error.message}`);
        }
      }
    }

    console.log('Migration complete:', result);

    return new Response(
      JSON.stringify({
        ...result,
        message: `Migration complete. Profiles: ${result.migratedProfiles}, CVs: ${result.migratedCVs}`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        migratedProfiles: 0,
        migratedCVs: 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

/**
 * Extrahera storage path från URL
 */
function extractStoragePath(url: string): string | null {
  if (!url) return null;
  
  // Om det inte är en URL, returnera som den är (antagligen redan en path)
  if (!url.startsWith('http')) {
    return url;
  }
  
  // Extrahera från public URL
  const publicMatch = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+?)(?:\?|$)/);
  if (publicMatch) {
    return publicMatch[1];
  }
  
  // Extrahera från signed URL
  const signedMatch = url.match(/\/storage\/v1\/object\/sign\/[^/]+\/(.+?)(?:\?|$)/);
  if (signedMatch) {
    return signedMatch[1];
  }
  
  return null;
}
