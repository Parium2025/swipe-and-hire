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
          
          // Video - extrahera storage path (redan i job-applications)
          if (profile.video_url && profile.video_url.startsWith('http')) {
            const videoPath = extractStoragePath(profile.video_url);
            if (videoPath && videoPath.includes('/')) {
              updates.video_url = videoPath;
              console.log(`Converting video URL to storage path for user ${profile.user_id}: ${videoPath}`);
            }
          }
          
          // Profilbild - extrahera storage path (ska vara i job-applications)
          if (profile.profile_image_url && profile.profile_image_url.startsWith('http')) {
            const imagePath = extractStoragePath(profile.profile_image_url);
            if (imagePath && imagePath.includes('/')) {
              updates.profile_image_url = imagePath;
              console.log(`Converting profile image URL to storage path for user ${profile.user_id}: ${imagePath}`);
            }
          }
          
          // Cover-bild - extrahera storage path (ska vara i job-applications)
          if (profile.cover_image_url && profile.cover_image_url.startsWith('http')) {
            const coverPath = extractStoragePath(profile.cover_image_url);
            if (coverPath && coverPath.includes('/')) {
              updates.cover_image_url = coverPath;
              console.log(`Converting cover image URL to storage path for user ${profile.user_id}: ${coverPath}`);
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
            const cvPath = extractStoragePath(profile.cv_url);
            if (cvPath && cvPath.includes('/')) {
              // Uppdatera till storage path om det inte redan är det
              if (profile.cv_url.startsWith('http')) {
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
