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

    console.log(`📊 Found ${jobs?.length || 0} jobs to check`);

    // Build a Set of all image paths currently referenced in the database
    const referencedPaths = new Set<string>();
    if (jobs && jobs.length > 0) {
      for (const job of jobs as JobImageRecord[]) {
        if (job.job_image_url) {
          // Extract just the storage path if it's a full URL
          let path = job.job_image_url;
          
          // If it contains job-applications, extract the path part
          if (path.includes('/job-applications/')) {
            const match = path.match(/\/job-applications\/(.+)$/);
            if (match) path = match[1];
          }
          
          // Only add paths that look like they're in job-applications (not public URLs)
          if (!path.startsWith('https://') && !path.includes('/job-images/')) {
            referencedPaths.add(path);
          }
        }
      }
    }

    console.log(`📝 Found ${referencedPaths.size} paths referenced in database`);

    let deletedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const cleanupResults: Array<{
      path: string, 
      status: string, 
      size?: number,
      error?: string
    }> = [];

    // Get list of all files in job-applications bucket (recursively scan all folders)
    async function listAllFiles(bucket: string, prefix: string = ''): Promise<Array<{name: string, size?: number}>> {
      const allFiles: Array<{name: string, size?: number}> = [];
      
      const { data: items, error } = await supabase.storage
        .from(bucket)
        .list(prefix, {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) {
        console.error(`Error listing ${prefix}:`, error);
        return allFiles;
      }

      if (!items) return allFiles;

      for (const item of items) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        
        if (item.id === null) {
          // It's a folder, recurse into it
          const subFiles = await listAllFiles(bucket, fullPath);
          allFiles.push(...subFiles);
        } else {
          // It's a file
          allFiles.push({
            name: fullPath,
            size: item.metadata?.size
          });
        }
      }

      return allFiles;
    }

    console.log(`🔍 Scanning all files in job-applications bucket...`);
    const allFilesInBucket = await listAllFiles('job-applications');
    console.log(`📦 Found ${allFilesInBucket.length} total files in job-applications bucket`);

    // Check each file - if it's NOT referenced in database, mark for deletion
    for (const file of allFilesInBucket) {
      try {
        const filePath = file.name;
        console.log(`🔄 Checking: ${filePath}`);

        // Check if this file is referenced in the database
        const isReferenced = referencedPaths.has(filePath);

        if (isReferenced) {
          console.log(`✅ File is still referenced: ${filePath}`);
          skippedCount++;
          cleanupResults.push({
            path: filePath,
            status: 'skipped_still_referenced',
            size: file.size
          });
          continue;
        }

        // File is NOT referenced - it's orphaned and should be deleted
        if (dryRun) {
          console.log(`🗑️ [DRY RUN] Would delete orphaned file: ${filePath} (${file.size} bytes)`);
          deletedCount++;
          cleanupResults.push({
            path: filePath,
            status: 'would_delete_orphaned',
            size: file.size
          });
        } else {
          // Actually delete the orphaned file
          const { error: deleteError } = await supabase.storage
            .from('job-applications')
            .remove([filePath]);

          if (deleteError) {
            console.error(`❌ Failed to delete ${filePath}:`, deleteError);
            failedCount++;
            cleanupResults.push({
              path: filePath,
              status: 'delete_failed',
              size: file.size,
              error: deleteError.message
            });
          } else {
            console.log(`✅ Deleted orphaned file: ${filePath} (${file.size} bytes)`);
            deletedCount++;
            cleanupResults.push({
              path: filePath,
              status: 'deleted_orphaned',
              size: file.size
            });
          }
        }

      } catch (error) {
        console.error(`❌ Unexpected error processing ${file.name}:`, error);
        failedCount++;
        cleanupResults.push({
          path: file.name,
          status: 'unexpected_error',
          size: file.size,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const totalSizeBytes = cleanupResults
      .filter(r => r.status.includes('delete') || r.status.includes('would_delete'))
      .reduce((sum, r) => sum + (r.size || 0), 0);
    const totalSizeMB = (totalSizeBytes / 1024 / 1024).toFixed(2);

    const message = dryRun 
      ? `🔍 Dry run completed - no files were actually deleted`
      : `🎉 Cleanup completed!`;

    console.log(`${message} Would delete/Deleted: ${deletedCount}, Failed: ${failedCount}, Skipped: ${skippedCount}`);
    console.log(`💾 Total size to free: ${totalSizeMB} MB`);

    return new Response(
      JSON.stringify({ 
        message,
        dry_run: dryRun,
        deleted: deletedCount,
        failed: failedCount,
        skipped: skippedCount,
        total_files_scanned: allFilesInBucket.length,
        total_size_mb: totalSizeMB,
        results: cleanupResults,
        note: dryRun 
          ? 'This was a dry run. To actually delete files, send {"dry_run": false} in the request body.'
          : 'Orphaned files have been permanently deleted from job-applications bucket.'
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