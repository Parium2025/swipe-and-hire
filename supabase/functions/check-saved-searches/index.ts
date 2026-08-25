import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceRoleOrCronSecret } from "../_shared/service-auth.ts";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BATCH_SIZE = 500;

// ─────────────────────────────────────────────────────────────
// Synonym/typo-expansion (spegel av useOptimizedJobSearch).
// Används så att sparad sökning "budbil" matchar jobb med titeln
// "chaufför", precis som live-sökningen gör.
// ─────────────────────────────────────────────────────────────
const TITLE_SYNONYMS: Record<string, string> = {
  budbil: 'chaufför', budbilsforare: 'chaufför', bud: 'chaufför',
  leverans: 'chaufför', leveransforare: 'chaufför', kurir: 'chaufför',
  taxichauffor: 'chaufför', akare: 'chaufför',
  byggare: 'snickare', bygg: 'snickare', hantverkare: 'snickare',
  elinstallator: 'elektriker', rormokare: 'vvs-montör', vvs: 'vvs-montör',
  malare: 'målare',
  kokschef: 'kock', servitor: 'servitör', servitris: 'servitör', diskare: 'köksbiträde',
  butik: 'butikssäljare', butikssaljare: 'butikssäljare', kassa: 'kassabiträde',
  kassor: 'kassör', telefonsaljare: 'säljare', keyaccount: 'account manager',
  kam: 'account manager', affarsomradeschef: 'account manager',
  usk: 'undersköterska', underskoterska: 'undersköterska', ssk: 'sjuksköterska',
  sjukskoterska: 'sjuksköterska', personligassistent: 'personlig assistent',
  vardbitrade: 'vårdbiträde',
  stadare: 'lokalvårdare', stad: 'lokalvårdare', lokalvard: 'lokalvårdare',
  dev: 'utvecklare', developer: 'utvecklare', programmerare: 'utvecklare',
  frontend: 'frontendutvecklare', backend: 'backendutvecklare', fullstack: 'fullstackutvecklare',
  truckforare: 'truckförare', lager: 'lagerarbetare', plockare: 'lagerarbetare',
  reception: 'receptionist', admin: 'administratör', sekreterare: 'administratör',
  vaktare: 'väktare', ordningsvakt: 'väktare', parkering: 'parkeringsvakt',
};

const TYPO_CORRECTIONS: Record<string, string> = {
  utveklare: 'utvecklare', utvekalre: 'utvecklare', utvecklre: 'utvecklare',
  saljare: 'säljare', saeljare: 'säljare', seljare: 'säljare',
  ingenjor: 'ingenjör', ingenior: 'ingenjör', ingenjorr: 'ingenjör',
  sjukskotare: 'sjuksköterska', sjukskoetrska: 'sjuksköterska',
  larare: 'lärare', laerare: 'lärare', lerare: 'lärare',
  bokforing: 'bokföring', marknadsforing: 'marknadsföring',
  projektledning: 'projektledare', kundtjanst: 'kundtjänst',
  lastbilschauffor: 'lastbilschaufför', chauffeur: 'chaufför', forare: 'förare',
  programerare: 'programmerare', programmare: 'programmerare',
  adminstrator: 'administratör', assitent: 'assistent', konsullt: 'konsult',
  recptionist: 'receptionist', cheff: 'chef', ledre: 'ledare', teknker: 'tekniker',
  stocholm: 'stockholm', stockolm: 'stockholm', stokholm: 'stockholm',
  goteborg: 'göteborg', goeteborg: 'göteborg', malmo: 'malmö', malmoe: 'malmö',
  helsingbrog: 'helsingborg', hellsingborg: 'helsingborg',
  linkoping: 'linköping', jonkoping: 'jönköping', norrkoping: 'norrköping',
  orebro: 'örebro', vasteras: 'västerås', umea: 'umeå', lulea: 'luleå',
  sundvall: 'sundsvall', karlsatd: 'karlstad', vaxjo: 'växjö',
  uppsla: 'uppsala', uppsal: 'uppsala',
};

const normToken = (t: string): string =>
  t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o');

/** Expandera en söksträng till en lista med alternativa termer att söka på. */
function expandQueryTerms(raw: string): string[] {
  const trimmed = (raw || '').trim().toLowerCase();
  if (!trimmed) return [];
  const out = new Set<string>([trimmed]);
  const tokens = trimmed.split(/\s+/);
  for (const t of tokens) {
    if (t.length < 2) continue;
    out.add(t);
    const norm = normToken(t);
    if (TITLE_SYNONYMS[norm]) out.add(TITLE_SYNONYMS[norm].toLowerCase());
    if (TYPO_CORRECTIONS[norm]) out.add(TYPO_CORRECTIONS[norm].toLowerCase());
    if (norm.length > 4 && norm.endsWith('s')) {
      const s = norm.slice(0, -1);
      if (TITLE_SYNONYMS[s]) out.add(TITLE_SYNONYMS[s].toLowerCase());
      if (TYPO_CORRECTIONS[s]) out.add(TYPO_CORRECTIONS[s].toLowerCase());
    }
  }
  return Array.from(out);
}

/** Returnerar true om något av termerna finns i något av haystack-fälten. */
function anyTermMatches(terms: string[], haystacks: string[]): boolean {
  if (terms.length === 0) return true;
  const normHay = haystacks.map((h) => normToken(h || ''));
  for (const term of terms) {
    const normTerm = normToken(term);
    if (!normTerm) continue;
    if (normHay.some((h) => h.includes(normTerm))) return true;
  }
  return false;
}

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

  // Cron/internal only — called by pg_net triggers and cron jobs.
  const authErr = await requireServiceRoleOrCronSecret(req, corsHeaders);
  if (authErr) return authErr;



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
        .select('id, user_id, name, search_query, city, county, employment_types, category, subcategories, salary_min, salary_max')
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

      // Fetch subcategories column via select above (added below)
      for (const search of batch) {
        let matches = true;

        // Text search — expandera med synonymer/typos så "budbil" matchar "chaufför"
        if (search.search_query && search.search_query !== '') {
          const terms = expandQueryTerms(search.search_query);
          if (!anyTermMatches(terms, [titleLower, cityLower, municipalityLower])) {
            matches = false;
          }
        }

        // Subcategories: minst en subkategori-term ska matcha titel/kategori/beskrivning
        if (matches && Array.isArray(search.subcategories) && search.subcategories.length > 0) {
          const subTerms = search.subcategories.flatMap((s: string) => expandQueryTerms(s));
          if (!anyTermMatches(subTerms, [titleLower, (category || '').toLowerCase()])) {
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
                  title: '🔔 Nytt jobb för din sökning!',
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
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
