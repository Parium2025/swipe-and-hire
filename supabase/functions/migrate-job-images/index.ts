import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface JobImageRecord {
  id: string;
  job_image_url: string | null;
  title: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🚀 Starting job image migration...');

    // Get all job postings with images
    const { data: jobs, error: fetchError } = await supabase
      .from('job_postings')
      .select('id, job_image_url, title')
      .not('job_image_url', 'is', null)
      .not('job_image_url', 'eq', '')

    if (fetchError) {
      console.error('❌ Error fetching jobs:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch job postings' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`📊 Found ${jobs?.length || 0} jobs with images to check`);

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No job images found to migrate',
          migrated: 0,
          failed: 0
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let migratedCount = 0;
    let failedCount = 0;
    const migrationResults: Array<{jobId: string, title: string, status: string, newUrl?: string, error?: string}> = [];

    for (const job of jobs as JobImageRecord[]) {
      try {
        if (!job.job_image_url) continue;

        const imagePath = job.job_image_url;
        console.log(`🔄 Processing job "${job.title}" (ID: ${job.id}) with image: ${imagePath}`);

        // Check if image is already in job-images bucket (public URL)
        if (imagePath.includes('/job-images/') || imagePath.startsWith('http')) {
          console.log(`✅ Job "${job.title}" already has public image, skipping`);
          migrationResults.push({
            jobId: job.id,
            title: job.title,
            status: 'already_public'
          });
          continue;
        }

        // Try to download from job-applications bucket
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('job-applications')
          .download(imagePath);

        if (downloadError || !fileData) {
          console.warn(`⚠️ Could not download ${imagePath} from job-applications:`, downloadError);
          
          // Check if file exists in job-images bucket already
          const { data: existsData, error: existsError } = await supabase.storage
            .from('job-images')
            .download(imagePath);

          if (!existsError && existsData) {
            // File exists in job-images, just update the URL
            const publicUrl = supabase.storage
              .from('job-images')
              .getPublicUrl(imagePath).data.publicUrl;

            const { error: updateError } = await supabase
              .from('job_postings')
              .update({ job_image_url: publicUrl })
              .eq('id', job.id);

            if (updateError) {
              console.error(`❌ Failed to update job ${job.id}:`, updateError);
              failedCount++;
              migrationResults.push({
                jobId: job.id,
                title: job.title,
                status: 'update_failed',
                error: updateError.message
              });
            } else {
              console.log(`✅ Updated job "${job.title}" to use existing public image`);
              migratedCount++;
              migrationResults.push({
                jobId: job.id,
                title: job.title,
                status: 'updated_to_existing',
                newUrl: publicUrl
              });
            }
          } else {
            failedCount++;
            migrationResults.push({
              jobId: job.id,
              title: job.title,
              status: 'file_not_found',
              error: `File not found in job-applications: ${imagePath}`
            });
          }
          continue;
        }

        // Generate new filename with timestamp to avoid conflicts
        const timestamp = new Date().getTime();
        const fileExtension = imagePath.split('.').pop() || 'jpg';
        const newFileName = `migrated/${job.id}-${timestamp}.${fileExtension}`;

        // Upload to job-images bucket (public)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('job-images')
          .upload(newFileName, fileData, {
            contentType: fileData.type,
            upsert: false
          });

        if (uploadError) {
          console.error(`❌ Failed to upload ${newFileName} to job-images:`, uploadError);
          failedCount++;
          migrationResults.push({
            jobId: job.id,
            title: job.title,
            status: 'upload_failed',
            error: uploadError.message
          });
          continue;
        }

        // Get public URL for the new file
        const publicUrl = supabase.storage
          .from('job-images')
          .getPublicUrl(newFileName).data.publicUrl;

        // Update job posting with new image URL
        const { error: updateError } = await supabase
          .from('job_postings')
          .update({ job_image_url: publicUrl })
          .eq('id', job.id);

        if (updateError) {
          console.error(`❌ Failed to update job ${job.id}:`, updateError);
          
          // Clean up uploaded file if DB update failed
          await supabase.storage
            .from('job-images')
            .remove([newFileName]);

          failedCount++;
          migrationResults.push({
            jobId: job.id,
            title: job.title,
            status: 'db_update_failed',
            error: updateError.message
          });
          continue;
        }

        // Optionally remove old file from job-applications bucket
        // (commented out for safety - you can manually clean up later)
        // await supabase.storage.from('job-applications').remove([imagePath]);

        console.log(`✅ Successfully migrated job "${job.title}" to public URL: ${publicUrl}`);
        migratedCount++;
        migrationResults.push({
          jobId: job.id,
          title: job.title,
          status: 'migrated',
          newUrl: publicUrl
        });

      } catch (error) {
        console.error(`❌ Unexpected error processing job ${job.id}:`, error);
        failedCount++;
        migrationResults.push({
          jobId: job.id,
          title: job.title,
          status: 'unexpected_error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`🎉 Migration completed! Migrated: ${migratedCount}, Failed: ${failedCount}`);

    return new Response(
      JSON.stringify({ 
        message: 'Job image migration completed',
        migratedCount: migratedCount,
        failedCount: failedCount,
        total: jobs.length,
        results: migrationResults
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Migration failed:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})