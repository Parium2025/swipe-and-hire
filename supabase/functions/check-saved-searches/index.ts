import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceRoleOrCronSecret } from "../_shared/service-auth.ts";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BATCH_SIZE = 500;
/** Hur många pushnotiser som får schemaläggas per minut vid en ny annons. */
const PUSH_PER_MINUTE = 2000;
/** Längsta utspridning – ingen väntar mer än så här på sin notis. */
const MAX_SPREAD_MINUTES = 15;
import { expandSearchToken, levenshtein } from '../_shared/jobSearchLexicon.ts';

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
  terminal: 'lagerarbetare', logistik: 'lagerarbetare', orderplock: 'lagerarbetare',
  truck: 'truckförare', distribution: 'chaufför', lastbil: 'lastbilschaufför',
  restaurang: 'kock', kok: 'köksbiträde', bartender: 'servitör', cafe: 'barista',
  vard: 'undersköterska', omsorg: 'undersköterska', hemtjanst: 'undersköterska',
  barnskotare: 'barnskötare', forskola: 'barnskötare', skola: 'lärare', pedagog: 'lärare',
  ekonomi: 'ekonom', redovisning: 'redovisningsekonom', lon: 'löneadministratör',
  hr: 'hr-specialist', rekrytering: 'rekryterare', kundservice: 'kundtjänst',
  support: 'kundtjänst', it: 'utvecklare', systemutvecklare: 'utvecklare',
  mekaniker: 'fordonstekniker', bilmekaniker: 'fordonstekniker', svetsare: 'svetsare',
  montor: 'montör', industri: 'operatör', produktion: 'operatör', fabrik: 'operatör',
  stadning: 'lokalvårdare', fastighet: 'fastighetsskötare', vaktmastare: 'fastighetsskötare',
  elektriker: 'elektriker', el: 'elektriker', snickeri: 'snickare', marketing: 'marknadsförare',
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

/**
 * Expandera ett sökord med SAMMA motor som sökrutan i appen
 * (gemensam ordlista: stavfel, böjningar, synonymkluster, Levenshtein)
 * plus bevakningens egna vardagsord.
 */
function expandToken(t: string): string[] {
  const out = new Set(expandSearchToken(t));
  const norm = normToken(t);
  for (const k of [norm, norm.endsWith('s') ? norm.slice(0, -1) : '']) {
    const syn = k && TITLE_SYNONYMS[k];
    if (syn) expandSearchToken(syn).forEach((x) => out.add(x));
    const typo = k && TYPO_CORRECTIONS[k];
    if (typo) expandSearchToken(typo).forEach((x) => out.add(x));
  }
  return [...out];
}

function expandQueryTerms(raw: string): string[] {
  const out = new Set<string>();
  for (const t of (raw || '').trim().split(/\s+/)) {
    if (t.length >= 2) expandToken(t).forEach((x) => out.add(x));
  }
  const whole = normToken((raw || '').trim()).replace(/\s+/g, '');
  if (whole) out.add(whole);
  return [...out];
}

/** Ord i haystack (för stavfelstolerans på ordnivå). */
const wordsOf = (h: string) => h.split(/[\s,\-/()&+.]+/).filter((w) => w.length >= 3);

function termHits(term: string, normHay: string[]): boolean {
  if (normHay.some((h) => h.includes(term) || h.replace(/\s+/g, '').includes(term))) return true;
  // Stavfel i annonsen eller sökningen: ett ords avstånd (två för långa ord).
  if (term.length >= 5) {
    const max = term.length >= 8 ? 2 : 1;
    return normHay.some((h) => wordsOf(h).some((w) => levenshtein(w, term, max) <= max));
  }
  return false;
}

function anyTermMatches(terms: string[], haystacks: string[]): boolean {
  if (terms.length === 0) return true;
  const normHay = haystacks.map((h) => normToken(h || ''));
  return terms.some((term) => { const n = normToken(term); return !!n && termHits(n, normHay); });
}

const STOPWORDS = new Set(['i', 'pa', 'vid', 'och', 'eller', 'jobb', 'tjanst', 'tjanster', 'som', 'inom', 'med', 'for', 'av', 'till', 'en', 'ett', 'den', 'det']);

/**
 * Varje meningsbärande sökord (eller synonym/rättstavning/sammansättning med
 * nästa ord) måste förekomma i något fält.
 */
function allTokensMatch(raw: string, haystacks: string[]): boolean {
  const tokens = raw.trim().toLowerCase().split(/[\s,]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(normToken(t)));
  if (tokens.length === 0) return true;
  const normHay = haystacks.map((h) => normToken(h || ''));
  for (let i = 0; i < tokens.length; i++) {
    if (expandToken(tokens[i]).some((term) => termHits(term, normHay))) continue;
    // Sammansättning: "lager arbetare" → "lagerarbetare" täcker båda orden.
    const next = tokens[i + 1];
    if (next) {
      const compound = normToken(tokens[i] + next);
      if (expandToken(compound).some((term) => termHits(term, normHay))) { i++; continue; }
    }
    return false;
  }
  return true;
}

const normCounty = (c: string) => normToken(c || '').replace(/s? lan$/, '').trim();

export interface JobCtx {
  title: string | null; occupation: string | null; category: string | null;
  city: string | null; municipality: string | null; county: string | null;
  workplace_name: string | null; employment_type: string | null;
  salary_min: number | null; salary_max: number | null;
}

/**
 * EN gemensam matchningsregel för både liveträffar och omräkning, så att
 * räknaren och notiserna alltid är överens.
 */
export function matchesSearch(search: any, j: JobCtx): boolean {
  const title = (j.title || '').toLowerCase();
  const occ = (j.occupation || '').toLowerCase();
  const cat = (j.category || '').toLowerCase();
  const city = (j.city || '').toLowerCase();
  const muni = (j.municipality || '').toLowerCase();
  const county = j.county || '';
  // Varje sökord måste träffa (AND): "lager göteborg" kräver båda.
  if (search.search_query && String(search.search_query).trim() !== '') {
    if (!allTokensMatch(search.search_query, [title, occ, cat, city, muni, county.toLowerCase(), (j.workplace_name || '').toLowerCase()])) return false;
  }
  if (Array.isArray(search.subcategories) && search.subcategories.length > 0) {
    const subTerms = search.subcategories.flatMap((s: string) => expandQueryTerms(s));
    if (!anyTermMatches(subTerms, [title, occ, cat])) return false;
  }
  if (search.city && String(search.city).trim() !== '') {
    const sc = normToken(String(search.city).trim());
    if (!normToken(city).includes(sc) && !normToken(muni).includes(sc)) return false;
  }
  if (search.county && search.county !== '' && normCounty(county) !== normCounty(search.county)) return false;
  if (Array.isArray(search.employment_types) && search.employment_types.length > 0) {
    const et = normToken(j.employment_type || '');
    if (!et || !search.employment_types.some((t: string) => normToken(t) === et)) return false;
  }
  if (search.category && search.category !== '' && normToken(j.category || '') !== normToken(search.category)) return false;
  if (search.salary_min != null && j.salary_max != null && j.salary_max < search.salary_min) return false;
  if (search.salary_max != null && j.salary_min != null && j.salary_min > search.salary_max) return false;
  return true;
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
      const { data: gotLock, error: lockError } = await supabase.rpc('try_claim_job_lock', {
        _key: 'saved-searches-full-scan',
        _ttl_seconds: 55 * 60,
      });
      if (lockError) throw lockError;
      if (!gotLock) {
        return new Response(JSON.stringify({ success: true, skipped: 'already_running' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      try {
        return await fullScan(supabase);
      } finally {
        await supabase.rpc('release_job_lock', { _key: 'saved-searches-full-scan' });
      }
    }

    // ──────────────────────────────────────────────
    // SINGLE-JOB MODE: match one new job against all saved searches in batches
    // ──────────────────────────────────────────────
    console.log(`[check-saved-searches] Matching job "${title}" (${job_id}) against saved searches...`);

    // Hämta yrke och arbetsplats (finns inte i triggerns nyttolast) och
    // bekräfta att annonsen fortfarande är aktiv innan något skickas.
    const { data: jobRow } = await supabase
      .from('job_postings')
      .select('occupation, workplace_name, is_active, deleted_at')
      .eq('id', job_id)
      .maybeSingle();
    if (!jobRow || jobRow.is_active === false || jobRow.deleted_at) {
      return new Response(JSON.stringify({ success: true, skipped: 'inactive' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const job = jobRow as { occupation: string | null; workplace_name: string | null };

    let offset = 0;
    let totalMatches = 0;
    let totalChecked = 0;
    let emailsSent = 0;
    // Räknas upp över ALLA satser så utspridningen blir jämn för hela annonsen.
    let queuedSoFar = 0;
    // En användare får bara ett mejl per annons även om flera bevakningar träffar.
    const emailedUsers = new Set<string>();

    while (true) {
      // Utan uttrycklig sortering kan databasen ge tillbaka raderna i olika
      // ordning mellan sidorna – då hoppas vissa bevakningar över och andra
      // dubbleras. Sorterad sidindelning är förutsättningen för att alla
      // bevakningar verkligen kontrolleras.
      const { data: batch, error: batchError } = await supabase
        .from('saved_searches')
        .select('id, user_id, name, search_query, city, county, employment_types, category, subcategories, salary_min, salary_max')
        .order('id', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

      if (batchError) {
        console.error('[check-saved-searches] Batch fetch error:', batchError);
        break;
      }

      if (!batch || batch.length === 0) break;

      totalChecked += batch.length;
      const ctx: JobCtx = {
        title, occupation: job.occupation, category, city: workplace_city,
        municipality: workplace_municipality ?? null, county: workplace_county,
        workplace_name: job.workplace_name, employment_type, salary_min, salary_max,
      };

      const matched: Array<{ id: string; user_id: string; name: string }> = [];
      for (const search of batch) {
        if (matchesSearch(search, ctx)) {
          totalMatches++;
          matched.push({ id: search.id, user_id: search.user_id, name: search.name || '' });
        }
      }

      // SKALA: tidigare skickades varje push direkt härifrån, några i taget.
      // Vid tiotusentals träffar hann körningen aldrig klart – och alla
      // notiser landade i samma sekund, så alla öppnade appen samtidigt.
      // Nu läggs notiserna i kön och betas av i jämn takt, utspridda över
      // tid. Samma träffar, samma notiser – bara utan stöttopp.
      if (matched.length > 0) {
        const ids = matched.map((m) => m.id);
        const { error: incError } = await supabase.rpc('increment_saved_search_matches', {
          p_ids: ids,
        });
        if (incError) {
          console.error('[check-saved-searches] Failed to increment match counts:', incError);
        }

        const userIds = [...new Set(matched.map((m) => m.user_id))];
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('user_id, is_enabled')
          .eq('notification_type', 'saved_search_match')
          .in('user_id', userIds);
        // Standard är påslaget – bara uttryckligt avstängt hoppas över.
        const disabled = new Set(
          (prefs || [])
            .filter((p) => (p as { is_enabled: boolean | null }).is_enabled === false)
            .map((p) => (p as { user_id: string }).user_id)
        );

        const targets = matched.filter((m) => !disabled.has(m.user_id));
        const now = Date.now();
        const rows = targets.map((m) => {
          // Sprid ut utskicket: varje påbörjad sats om PUSH_PER_MINUTE skjuts
          // en minut framåt, upp till MAX_SPREAD_MINUTES.
          const delayMinutes = Math.min(
            Math.floor(queuedSoFar++ / PUSH_PER_MINUTE),
            MAX_SPREAD_MINUTES
          );
          return {
            recipient_id: m.user_id,
            title: 'Nytt jobb för din sökning',
            body: `${title} - ${workplace_city || 'Okänd plats'}`,
            notification_type: 'saved_search_match',
            // Samma annons + samma bevakning ska aldrig ge två notiser.
            dedupe_key: `saved_search:${job_id}:${m.id}`,
            scheduled_at: new Date(now + delayMinutes * 60_000).toISOString(),
            data: {
              type: 'saved_search_match',
              job_id,
              search_id: m.id,
              route: '/job-view/' + job_id,
            },
          };
        });

        const { error: queueError } = await supabase.rpc('enqueue_push_notifications', {
          p_rows: rows,
        });
        if (queueError) {
          console.error('[check-saved-searches] Failed to queue push notifications:', queueError);
        }

        await insertInAppNotifications(supabase, matched, { job_id, title, workplace_city });

        emailsSent += await sendMatchEmails(supabase, matched, emailedUsers, {
          job_id, title, workplace_city, workplace_name: job.workplace_name,
        });
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
  console.log('[check-saved-searches] Full scan – recounting with the shared match rule...');

  // Aktiva annonser senaste 60 dagarna räcker: räknaren gäller bara annonser
  // som kommit sedan senaste notisen, och utgångna räknas bort.
  const since = new Date(Date.now() - 60 * 86400_000).toISOString();
  const jobs: Array<JobCtx & { created_at: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('job_postings')
      .select('title, occupation, category, workplace_city, workplace_municipality, workplace_county, workplace_name, employment_type, salary_min, salary_max, created_at, expires_at')
      .eq('is_active', true).is('deleted_at', null).gt('created_at', since)
      .order('id', { ascending: true }).range(from, from + 999);
    if (error) throw error;
    const nowIso = new Date().toISOString();
    for (const r of data || []) {
      if (r.expires_at && r.expires_at < nowIso) continue;
      jobs.push({
        title: r.title, occupation: r.occupation, category: r.category, city: r.workplace_city,
        municipality: r.workplace_municipality, county: r.workplace_county, workplace_name: r.workplace_name,
        employment_type: r.employment_type, salary_min: r.salary_min, salary_max: r.salary_max, created_at: r.created_at,
      });
    }
    if (!data || data.length < 1000 || jobs.length >= 20000) break;
  }

  let offset = 0;
  let totalUpdates = 0;
  while (true) {
    const { data: searches, error } = await supabase
      .from('saved_searches')
      .select('id, search_query, city, county, employment_types, category, subcategories, salary_min, salary_max, new_matches_count, last_notified_at, last_checked_at, created_at')
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);
    if (error || !searches || searches.length === 0) break;

    const unchanged: string[] = [];
    const nowIso = new Date().toISOString();
    for (const search of searches) {
      const sinceDate = search.last_notified_at || search.last_checked_at || search.created_at;
      let count = 0;
      for (const j of jobs) if (j.created_at > sinceDate && matchesSearch(search, j)) count++;
      if (count !== (search.new_matches_count || 0)) {
        totalUpdates++;
        await supabase.from('saved_searches')
          .update({ new_matches_count: count, last_checked_at: nowIso, updated_at: nowIso })
          .eq('id', search.id);
      } else {
        unchanged.push(search.id);
      }
    }
    if (unchanged.length > 0) {
      await supabase.from('saved_searches').update({ last_checked_at: nowIso }).in('id', unchanged);
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
