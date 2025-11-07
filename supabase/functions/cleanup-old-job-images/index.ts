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

    // Parse request body to check for dry_run flag
    let dryRun = true; // Default to dry run for safety
    try {
      const body = await req.json();
      dryRun = body.dry_run !== false; // Only do actual cleanup if explicitly set to false
    } catch {
      // If no body or invalid JSON, default to dry run
      dryRun = true;
    }

    console.log(`🚀 Starting cleanup process (${dryRun ? 'DRY RUN' : 'ACTUAL CLEANUP'})...`);

    // Get all job postings
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
          message: 'No jobs found',
          dry_run: dryRun,
          deleted: 0,
          failed: 0
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let deletedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const cleanupResults: Array<{
      jobId: string, 
      title: string, 
      status: string, 
      oldPath?: string,
      error?: string
    }> = [];

    // Get list of all files in job-applications bucket
    const { data: oldFiles, error: listError } = await supabase.storage
      .from('job-applications')
      .list();

    if (listError) {
      console.error('❌ Error listing files in job-applications bucket:', listError);
    }

    // Get unique paths that might be in job-applications
    const pathsToCheck = new Set<string>();
    
    for (const job of jobs as JobImageRecord[]) {
      if (!job.job_image_url) continue;

      const imageUrl = job.job_image_url;
      
      // Skip if it's already a public URL (these don't need cleanup)
      if (imageUrl.includes('/job-images/') || imageUrl.startsWith('https://')) {
        console.log(`✅ Job "${job.title}" already using public URL, skipping`);
        skippedCount++;
        cleanupResults.push({
          jobId: job.id,
          title: job.title,
          status: 'skipped_already_public'
        });
        continue;
      }

      // If it's a storage path, it might be in job-applications
      pathsToCheck.add(imageUrl);
    }

    console.log(`🔍 Found ${pathsToCheck.size} potential paths to clean up`);

    // Check each path and try to delete if it exists in job-applications
    for (const path of pathsToCheck) {
      try {
        console.log(`🔄 Checking path: ${path}`);

        // First, verify the file exists in job-applications
        const { data: fileExists, error: checkError } = await supabase.storage
          .from('job-applications')
          .download(path);

        if (checkError || !fileExists) {
          console.log(`⚠️ File not found in job-applications: ${path}`);
          continue;
        }

        // Find which job this path belongs to
        const job = (jobs as JobImageRecord[]).find(j => j.job_image_url === path);
        const jobTitle = job?.title || 'Unknown';
        const jobId = job?.id || 'unknown';

        if (dryRun) {
          // Dry run: just log what would be deleted
          console.log(`🗑️ [DRY RUN] Would delete: ${path} (from job: "${jobTitle}")`);
          deletedCount++;
          cleanupResults.push({
            jobId: jobId,
            title: jobTitle,
            status: 'would_delete',
            oldPath: path
          });
        } else {
          // Actually delete the file
          const { error: deleteError } = await supabase.storage
            .from('job-applications')
            .remove([path]);

          if (deleteError) {
            console.error(`❌ Failed to delete ${path}:`, deleteError);
            failedCount++;
            cleanupResults.push({
              jobId: jobId,
              title: jobTitle,
              status: 'delete_failed',
              oldPath: path,
              error: deleteError.message
            });
          } else {
            console.log(`✅ Deleted: ${path} (from job: "${jobTitle}")`);
            deletedCount++;
            cleanupResults.push({
              jobId: jobId,
              title: jobTitle,
              status: 'deleted',
              oldPath: path
            });
          }
        }

      } catch (error) {
        console.error(`❌ Unexpected error processing path ${path}:`, error);
        failedCount++;
        cleanupResults.push({
          jobId: 'unknown',
          title: 'Unknown',
          status: 'unexpected_error',
          oldPath: path,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const message = dryRun 
      ? `🔍 Dry run completed - no files were actually deleted`
      : `🎉 Cleanup completed!`;

    console.log(`${message} Would delete/Deleted: ${deletedCount}, Failed: ${failedCount}, Skipped: ${skippedCount}`);

    return new Response(
      JSON.stringify({ 
        message,
        dry_run: dryRun,
        deleted: deletedCount,
        failed: failedCount,
        skipped: skippedCount,
        total_checked: pathsToCheck.size,
        results: cleanupResults,
        note: dryRun 
          ? 'This was a dry run. To actually delete files, send {"dry_run": false} in the request body.'
          : 'Files have been permanently deleted from job-applications bucket.'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})