import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify identity
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user and verify admin email
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ADMIN_EMAIL = 'pariumab@hotmail.com';
    if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to query storage.objects
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get all storage objects with their sizes
    const { data: objects, error: storageError } = await adminClient
      .from('objects')
      .select('bucket_id, name, metadata')
      .in('bucket_id', ['job-applications', 'company-logos', 'job-images']);

    if (storageError) {
      console.error('Storage query error:', storageError);
      // Try alternative approach - query each bucket
    }

    // Calculate storage by bucket and type
    const storageStats = {
      totalBytes: 0,
      totalMB: 0,
      byBucket: {} as Record<string, { count: number; bytes: number; mb: number }>,
      byType: {
        videos: { count: 0, bytes: 0, mb: 0 },
        cvs: { count: 0, bytes: 0, mb: 0 },
        images: { count: 0, bytes: 0, mb: 0 },
        other: { count: 0, bytes: 0, mb: 0 },
      },
    };

    if (objects) {
      for (const obj of objects) {
        const size = obj.metadata?.size || obj.metadata?.contentLength || 0;
        const bucketId = obj.bucket_id;
        const fileName = obj.name?.toLowerCase() || '';

        // Add to total
        storageStats.totalBytes += size;

        // Add to bucket stats
        if (!storageStats.byBucket[bucketId]) {
          storageStats.byBucket[bucketId] = { count: 0, bytes: 0, mb: 0 };
        }
        storageStats.byBucket[bucketId].count++;
        storageStats.byBucket[bucketId].bytes += size;

        // Categorize by file type
        if (fileName.match(/\.(mp4|mov|webm|avi)$/)) {
          storageStats.byType.videos.count++;
          storageStats.byType.videos.bytes += size;
        } else if (fileName.match(/\.(pdf|doc|docx)$/)) {
          storageStats.byType.cvs.count++;
          storageStats.byType.cvs.bytes += size;
        } else if (fileName.match(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/)) {
          storageStats.byType.images.count++;
          storageStats.byType.images.bytes += size;
        } else {
          storageStats.byType.other.count++;
          storageStats.byType.other.bytes += size;
        }
      }
    }

    // Convert bytes to MB
    const bytesToMB = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 100) / 100;
    
    storageStats.totalMB = bytesToMB(storageStats.totalBytes);
    
    for (const bucket of Object.keys(storageStats.byBucket)) {
      storageStats.byBucket[bucket].mb = bytesToMB(storageStats.byBucket[bucket].bytes);
    }
    
    for (const type of Object.keys(storageStats.byType) as Array<keyof typeof storageStats.byType>) {
      storageStats.byType[type].mb = bytesToMB(storageStats.byType[type].bytes);
    }

    // Also get database size estimate from table counts
    const [profilesRes, jobsRes, applicationsRes, messagesRes] = await Promise.all([
      adminClient.from('profiles').select('id', { count: 'exact', head: true }),
      adminClient.from('job_postings').select('id', { count: 'exact', head: true }),
      adminClient.from('job_applications').select('id', { count: 'exact', head: true }),
      adminClient.from('messages').select('id', { count: 'exact', head: true }),
    ]);

    const dbStats = {
      profiles: profilesRes.count || 0,
      jobs: jobsRes.count || 0,
      applications: applicationsRes.count || 0,
      messages: messagesRes.count || 0,
      // Rough estimate: avg row size * count
      estimatedMB: Math.round((
        (profilesRes.count || 0) * 2 + // profiles are larger
        (jobsRes.count || 0) * 5 + // jobs have descriptions
        (applicationsRes.count || 0) * 3 + // applications have answers
        (messagesRes.count || 0) * 0.5
      ) / 1024 * 100) / 100,
    };

    return new Response(
      JSON.stringify({
        storage: storageStats,
        database: dbStats,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-storage-stats:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
