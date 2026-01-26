import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  search_query: string | null;
  city: string | null;
  county: string | null;
  employment_types: string[] | null;
  category: string | null;
  salary_min: number | null;
  salary_max: number | null;
  last_checked_at: string;
}

interface JobPosting {
  id: string;
  title: string;
  workplace_city: string | null;
  workplace_county: string | null;
  employment_type: string | null;
  category: string | null;
  salary_min: number | null;
  salary_max: number | null;
  created_at: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[check-saved-searches] Starting check for new matching jobs...');

    // Get all saved searches
    const { data: savedSearches, error: searchError } = await supabase
      .from('saved_searches')
      .select('*');

    if (searchError) {
      console.error('[check-saved-searches] Error fetching saved searches:', searchError);
      throw searchError;
    }

    if (!savedSearches || savedSearches.length === 0) {
      console.log('[check-saved-searches] No saved searches found');
      return new Response(JSON.stringify({ message: 'No saved searches to check' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[check-saved-searches] Found ${savedSearches.length} saved searches`);

    // For each saved search, find new jobs since last check
    const updates: { searchId: string; userId: string; newCount: number; searchName: string }[] = [];

    for (const search of savedSearches as SavedSearch[]) {
      // Build query for matching jobs
      let query = supabase
        .from('job_postings')
        .select('id, title, workplace_city, workplace_county, employment_type, category, salary_min, salary_max, created_at')
        .eq('is_active', true)
        .is('deleted_at', null)
        .gt('created_at', search.last_checked_at);

      // Apply filters based on saved search criteria
      if (search.search_query) {
        // Use ilike for simple text search
        query = query.or(`title.ilike.%${search.search_query}%,workplace_city.ilike.%${search.search_query}%`);
      }

      if (search.city) {
        query = query.or(`workplace_city.ilike.%${search.city}%,workplace_municipality.ilike.%${search.city}%`);
      }

      if (search.county) {
        query = query.eq('workplace_county', search.county);
      }

      if (search.employment_types && search.employment_types.length > 0) {
        query = query.in('employment_type', search.employment_types);
      }

      if (search.category) {
        query = query.eq('category', search.category);
      }

      // Salary range filter
      if (search.salary_min) {
        query = query.or(`salary_max.gte.${search.salary_min},salary_max.is.null`);
      }

      if (search.salary_max) {
        query = query.or(`salary_min.lte.${search.salary_max},salary_min.is.null`);
      }

      const { data: matchingJobs, error: jobError } = await query;

      if (jobError) {
        console.error(`[check-saved-searches] Error checking jobs for search ${search.id}:`, jobError);
        continue;
      }

      const newMatchCount = matchingJobs?.length || 0;

      if (newMatchCount > 0) {
        console.log(`[check-saved-searches] Found ${newMatchCount} new jobs for search "${search.name}"`);
        updates.push({
          searchId: search.id,
          userId: search.user_id,
          newCount: newMatchCount,
          searchName: search.name,
        });
      }
    }

    // Update saved searches with new match counts and send push notifications
    for (const update of updates) {
      // Increment new_matches_count
      const { error: updateError } = await supabase
        .from('saved_searches')
        .update({
          new_matches_count: supabase.rpc('increment_count', { row_id: update.searchId }),
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', update.searchId);

      // Fallback: direct update if RPC doesn't exist
      if (updateError) {
        // Get current count and increment
        const { data: current } = await supabase
          .from('saved_searches')
          .select('new_matches_count')
          .eq('id', update.searchId)
          .single();

        await supabase
          .from('saved_searches')
          .update({
            new_matches_count: (current?.new_matches_count || 0) + update.newCount,
            last_checked_at: new Date().toISOString(),
          })
          .eq('id', update.searchId);
      }

      // Send push notification
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            recipient_id: update.userId,
            title: '🔔 Nya jobb matchar din sökning!',
            body: `${update.newCount} nya jobb matchar "${update.searchName}"`,
            data: {
              type: 'saved_search_match',
              search_id: update.searchId,
              route: '/search-jobs',
            },
          },
        });
        console.log(`[check-saved-searches] Push sent to user ${update.userId}`);
      } catch (pushError) {
        console.error(`[check-saved-searches] Failed to send push:`, pushError);
      }
    }

    // Update last_checked_at for all searches (even those with no matches)
    const now = new Date().toISOString();
    await supabase
      .from('saved_searches')
      .update({ last_checked_at: now })
      .lt('last_checked_at', now);

    console.log(`[check-saved-searches] Completed. ${updates.length} searches had new matches.`);

    return new Response(
      JSON.stringify({
        success: true,
        searchesChecked: savedSearches.length,
        searchesWithNewMatches: updates.length,
        totalNewJobs: updates.reduce((sum, u) => sum + u.newCount, 0),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[check-saved-searches] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
