import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BATCH_SIZE = 500;

interface NewJobPayload {
  job_id: string;
  title: string;
  workplace_city: string | null;
  workplace_municipality?: string | null;
  workplace_county: string | null;
  employment_type: string | null;
  category: string | null;
  salary_min: number | null;
  salary_max: number | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json() as NewJobPayload;
    const { job_id, title, workplace_city, workplace_municipality, workplace_county, employment_type, category, salary_min, salary_max } = body;

    if (!job_id) {
      // Legacy mode: full scan (called by cron)
      return await fullScan(supabase);
    }

    // ──────────────────────────────────────────────
    // SINGLE-JOB MODE: match one new job against all saved searches in batches
    // ──────────────────────────────────────────────
    console.log(`[check-saved-searches] Matching job "${title}" (${job_id}) against saved searches...`);

    let offset = 0;
    let totalMatches = 0;
    let totalChecked = 0;

    while (true) {
      const { data: batch, error: batchError } = await supabase
        .from('saved_searches')
        .select('id, user_id, name, search_query, city, county, employment_types, category, salary_min, salary_max')
        .range(offset, offset + BATCH_SIZE - 1);

      if (batchError) {
        console.error('[check-saved-searches] Batch fetch error:', batchError);
        break;
      }

      if (!batch || batch.length === 0) break;

      totalChecked += batch.length;
      const titleLower = (title || '').toLowerCase();
      const cityLower = (workplace_city || '').toLowerCase();
      const municipalityLower = (workplace_municipality || '').toLowerCase();
      const countyValue = workplace_county || '';

      for (const search of batch) {
        let matches = true;

        // Text search
        if (search.search_query && search.search_query !== '') {
          const q = search.search_query.toLowerCase();
          if (!titleLower.includes(q) && !cityLower.includes(q) && !municipalityLower.includes(q)) {
            matches = false;
          }
        }

        // City filter
        if (matches && search.city && search.city !== '') {
          const sc = search.city.toLowerCase();
          if (!cityLower.includes(sc) && !municipalityLower.includes(sc)) {
            matches = false;
          }
        }

        // County filter
        if (matches && search.county && search.county !== '') {
          if (countyValue !== search.county) {
            matches = false;
          }
        }

        // Employment type filter
        if (matches && search.employment_types && search.employment_types.length > 0) {
          if (!employment_type || !search.employment_types.includes(employment_type)) {
            matches = false;
          }
        }

        // Category filter
        if (matches && search.category && search.category !== '') {
          if (category !== search.category) {
            matches = false;
          }
        }

        // Salary filters
        if (matches && search.salary_min != null) {
          if (salary_max != null && salary_max < search.salary_min) {
            matches = false;
          }
        }
        if (matches && search.salary_max != null) {
          if (salary_min != null && salary_min > search.salary_max) {
            matches = false;
          }
        }

        if (matches) {
          totalMatches++;

          // Update match count
          const { data: current } = await supabase
            .from('saved_searches')
            .select('new_matches_count')
            .eq('id', search.id)
            .single();

          await supabase
            .from('saved_searches')
            .update({
              new_matches_count: (current?.new_matches_count || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', search.id);

          // Send push notification (fire-and-forget)
          try {
            const notifEnabled = await supabase.rpc('is_notification_enabled', {
              p_user_id: search.user_id,
              p_type: 'saved_search_match',
            });

            if (notifEnabled.data) {
              await supabase.functions.invoke('send-push-notification', {
                body: {
                  recipient_id: search.user_id,
                  title: '🔔 Nytt jobb matchar din sökning!',
                  body: `${title} - ${workplace_city || 'Okänd plats'}`,
                  data: {
                    type: 'saved_search_match',
                    job_id,
                    search_id: search.id,
                    route: '/job-view/' + job_id,
                  },
                },
              });
            }
          } catch (pushErr) {
            console.warn('[check-saved-searches] Push failed for user', search.user_id, pushErr);
          }
        }
      }

      // If we got less than BATCH_SIZE, we've reached the end
      if (batch.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }

    console.log(`[check-saved-searches] Done. Checked ${totalChecked} searches, ${totalMatches} matches.`);

    return new Response(
      JSON.stringify({ success: true, checked: totalChecked, matches: totalMatches }),
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

/**
 * Legacy full-scan mode (for cron-based checks)
 */
async function fullScan(supabase: any) {
  console.log('[check-saved-searches] Running full scan (cron mode) - recounting active matches...');

  let offset = 0;
  let totalUpdates = 0;

  while (true) {
    const { data: searches, error } = await supabase
      .from('saved_searches')
      .select('*')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error || !searches || searches.length === 0) break;

    for (const search of searches) {
      // Count ALL active jobs that match this search's criteria
      // and were created after last_notified_at (or last_checked_at as fallback)
      const sinceDate = search.last_notified_at || search.last_checked_at;
      
      let query = supabase
        .from('job_postings')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .is('deleted_at', null)
        .gt('created_at', sinceDate);

      if (search.search_query) {
        query = query.or(`title.ilike.%${search.search_query}%,workplace_city.ilike.%${search.search_query}%`);
      }
      if (search.city) {
        query = query.or(`workplace_city.ilike.%${search.city}%,workplace_municipality.ilike.%${search.city}%`);
      }
      if (search.county) {
        query = query.eq('workplace_county', search.county);
      }
      if (search.employment_types?.length > 0) {
        query = query.in('employment_type', search.employment_types);
      }
      if (search.category) {
        query = query.eq('category', search.category);
      }
      if (search.salary_min != null) {
        query = query.or(`salary_max.gte.${search.salary_min},salary_max.is.null`);
      }
      if (search.salary_max != null) {
        query = query.or(`salary_min.lte.${search.salary_max},salary_min.is.null`);
      }

      const { count } = await query;
      const newCount = count || 0;

      // SET the count (not accumulate) — this ensures expired/deleted jobs
      // are no longer counted, fixing stale badge notifications
      if (newCount !== (search.new_matches_count || 0)) {
        totalUpdates++;
        await supabase
          .from('saved_searches')
          .update({
            new_matches_count: newCount,
            last_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', search.id);
      } else {
        // Just update last_checked_at
        await supabase
          .from('saved_searches')
          .update({ last_checked_at: new Date().toISOString() })
          .eq('id', search.id);
      }
    }

    if (searches.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  console.log(`[check-saved-searches] Full scan done. ${totalUpdates} searches recounted.`);

  return new Response(
    JSON.stringify({ success: true, mode: 'full_scan', updatedSearches: totalUpdates }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  );
}
