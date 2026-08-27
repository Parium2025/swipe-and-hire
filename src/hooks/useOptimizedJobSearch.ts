import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { createRealtimeChannel } from '@/lib/realtimeChannel';
import { getTimeRemaining } from '@/lib/date';
import { detectSalarySearch, allKnownLocationTerms } from '@/lib/smartSearch';
import { OCCUPATION_CATEGORIES } from '@/lib/occupations';
import { safeSetItem } from '@/lib/safeStorage';
import { imageCache } from '@/lib/imageCache';
import { readThroughCache } from '@/lib/performanceGuards';
import { measurePerformance } from '@/lib/realtimePerformance';

// 🔥 Offline-cache: senaste lyckade sökresultat per query-nyckel.
// Används som fallback när nätverket är borta så att jobbkort fortfarande
// kan visas. Påverkar inte online-flödet — vi skriver bara över initialData
// när det finns en cache, query:n hämtar nytt så snart nätet finns.
const SEARCH_CACHE_PREFIX = 'parium_job_search_cache_v1_';
const SEARCH_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 dagar
const HOT_SEARCH_CACHE_PREFIX = 'parium_hot_job_search_v1_';
const HOT_SEARCH_CACHE_TTL = 20 * 1000;
const COUNT_CACHE_PREFIX = 'parium_job_search_count_v1_';
const COUNT_CACHE_TTL = 30 * 1000;

interface CachedSearch {
  jobs: SearchJob[];
  timestamp: number;
}

function searchCacheKey(parts: unknown[]): string {
  try {
    return SEARCH_CACHE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(parts)))).slice(0, 120);
  } catch {
    return SEARCH_CACHE_PREFIX + JSON.stringify(parts).slice(0, 120);
  }
}

function readSearchCache(key: string): SearchJob[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: CachedSearch = JSON.parse(raw);
    if (!parsed?.jobs || !Array.isArray(parsed.jobs)) return null;
    if (Date.now() - parsed.timestamp > SEARCH_CACHE_TTL) return null;
    return parsed.jobs;
  } catch {
    return null;
  }
}

/**
 * Normalisera en logo-URL till en stabil public-URL som imageCache kan blob-cacha.
 * - Full http(s)-URL → strippa query (signed-tokens m.m.)
 * - Storage-path → konvertera via supabase.storage public URL
 * Returnerar null om vi inte kan ta fram en användbar URL.
 */
function normalizeLogoUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.split('?')[0];
  }
  try {
    const publicUrl = supabase.storage.from('company-logos').getPublicUrl(trimmed).data.publicUrl;
    return publicUrl ? publicUrl.split('?')[0] : null;
  } catch {
    return null;
  }
}

/**
 * 🔥 Förvärm blob-cache med arbetsgivares logotyper för givna sökresultat.
 * Kör i idle/bakgrund — blockerar aldrig render. Effekten:
 *   - Online: nästa render läser logon synkront från blob-cache → noll flimmer.
 *   - Offline: SW + blob-cache har redan blobben → logon visas direkt utan nät.
 */
function warmCompanyLogos(jobs: SearchJob[]): void {
  if (!jobs || jobs.length === 0) return;

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const job of jobs) {
    const normalized = normalizeLogoUrl(job.company_logo_url);
    if (normalized && !seen.has(normalized) && !imageCache.isCached(normalized)) {
      seen.add(normalized);
      urls.push(normalized);
    }
  }
  if (urls.length === 0) return;

  const run = () => {
    void imageCache.preloadImages(urls);
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(run, { timeout: 1500 });
  } else {
    setTimeout(run, 0);
  }
}

function writeSearchCache(key: string, jobs: SearchJob[]): void {
  if (!jobs || jobs.length === 0) return;
  // Spara max 60 jobb för att hålla localStorage-fotavtrycket litet
  const trimmed = jobs.slice(0, 60);
  const payload: CachedSearch = { jobs: trimmed, timestamp: Date.now() };
  safeSetItem(key, JSON.stringify(payload));
  // 🔥 Förvärm logotyper i bakgrunden så de finns redo offline
  warmCompanyLogos(trimmed);
}

export interface SearchJob {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  workplace_city: string | null;
  workplace_county: string | null;
  workplace_municipality: string | null;
  workplace_address: string | null;
  workplace_name: string | null;
  workplace_postal_code: string | null;
  employment_type: string | null;
  duration_amount: number | null;
  duration_unit: string | null;
  part_time_days: string[] | null;
  part_time_shifts: string[] | null;
  work_schedule: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_type: string | null;
  salary_transparency: string | null;
  positions_count: number | null;
  occupation: string | null;
  category: string | null;
  pitch: string | null;
  requirements: string | null;
  benefits: string[] | null;
  remote_work_possible: string | null;
  work_location_type: string | null;
  contact_email: string | null;
  application_instructions: string | null;
  job_image_url: string | null;
  job_image_desktop_url: string | null;
  employer_id: string;
  is_active: boolean;
  views_count: number;
  applications_count: number;
  created_at: string;
  updated_at: string;
  image_updated_at?: string | null;
  expires_at: string | null;
  search_rank: number;
  image_focus_position: string;
  company_name: string;
  company_logo_url?: string;
  overlay_text_color?: string | null;
  company_avg_rating?: number;
  company_review_count?: number;
}

export type JobSearchSort = 'newest' | 'oldest' | 'most-views';

/**
 * Keyset-markör. Måste innehålla ALLA fält som ingår i serverns ORDER BY,
 * annars kan rader hoppas över eller dubbleras när flera jobb delar samma
 * created_at (vanligt vid massimport).
 */
interface SearchCursor {
  createdAt: string;
  id: string;
  rank: number;
  views: number;
}

interface UseOptimizedJobSearchOptions {
  searchQuery: string;
  city: string;
  employmentTypes: string[];
  category: string;
  subcategories: string[];
  enabled?: boolean;
  /** 🔥 SCALE: Filtrera på arbetsgivar-ID i DB istället för i klienten. */
  employerIds?: string[];
  /** 🔥 SCALE: ISO-timestamp; jobb skapade efter denna tid filtreras i DB. */
  createdAfter?: string | null;
  /** Antal jobb per batch. Default 100. */
  pageSize?: number;
  /** Sortering körs i databasen — gäller hela resultatet, inte bara laddade sidor. */
  sort?: JobSearchSort;
}

const normalizeSwedish = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/è/g, 'e');
};

const levenshteinDistance = (a: string, b: string): number => {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

// ─────────────────────────────────────────────────────────────
// TYPO-KORRIGERING: normaliserad token (utan å/ä/ö) → korrekt stavning.
// Används INNAN kluster-expansion. Täcker vanliga svenska felstavningar.
// ─────────────────────────────────────────────────────────────
const typoCorrections: Record<string, string> = {
  // ── IT / utvecklare ──
  utveklare: 'utvecklare', utvekalre: 'utvecklare', utvecklre: 'utvecklare',
  utveckalre: 'utvecklare', utveckare: 'utvecklare', utvekare: 'utvecklare',
  utveckalare: 'utvecklare', utveclare: 'utvecklare',
  programerare: 'programmerare', programmare: 'programmerare', programör: 'programmerare',
  programeare: 'programmerare', progammerare: 'programmerare',
  utveckelare: 'utvecklare', develloper: 'developer', devloper: 'developer',
  frontent: 'frontend', frontendd: 'frontend', bakend: 'backend', backendd: 'backend',
  fullstak: 'fullstack', fulstack: 'fullstack',
  systemutveklare: 'systemutvecklare', webbutveklare: 'webbutvecklare',
  ittekniker: 'it-tekniker', supprttekniker: 'supporttekniker', helpddesk: 'helpdesk',
  // ── Sälj ──
  saljare: 'säljare', saeljare: 'säljare', seljare: 'säljare', sälare: 'säljare',
  sälgare: 'säljare', säljjare: 'säljare',
  telefonsaljare: 'telefonförsäljare', telefonsäljare: 'telefonförsäljare',
  butikssaljare: 'butikssäljare', innesaljare: 'innesäljare', utesaljare: 'utesäljare',
  faltsaljare: 'fältsäljare',
  // ── Ingenjör ──
  ingenjor: 'ingenjör', ingenior: 'ingenjör', ingenjorr: 'ingenjör', injengör: 'ingenjör',
  ingengör: 'ingenjör', ingenjeur: 'ingenjör', ingnjör: 'ingenjör',
  civilingenjor: 'civilingenjör', hogskoleingenjor: 'högskoleingenjör',
  // ── Vård & omsorg ──
  sjukskotare: 'sjuksköterska', sjukskoetrska: 'sjuksköterska', sjukskoterska: 'sjuksköterska',
  sjuksköterksa: 'sjuksköterska', sjuksköterrska: 'sjuksköterska', sjuksköterksa2: 'sjuksköterska',
  sjukskötare: 'sjuksköterska', sjukskoeterska: 'sjuksköterska',
  underskoterska: 'undersköterska', underskotare: 'undersköterska', undersköterksa: 'undersköterska',
  underskötare: 'undersköterska', undersskoterska: 'undersköterska',
  vardbitrade: 'vårdbiträde', vårdbitrade: 'vårdbiträde', vårdbiträ: 'vårdbiträde',
  personligassisten: 'personlig assistent', persoligassistent: 'personlig assistent',
  personligassitent: 'personlig assistent',
  barnskotare: 'barnskötare', barskotare: 'barnskötare',
  forskollarare: 'förskollärare', förskolärare: 'förskollärare', förskollärar: 'förskollärare',
  fysoterapeut: 'fysioterapeut', sjukgymanst: 'sjukgymnast',
  tandskoterska: 'tandsköterska', tandlakare: 'tandläkare', tandhyginist: 'tandhygienist',
  socionomm: 'socionom', socialsekreterrare: 'socialsekreterare',
  // ── Lärare / skola ──
  larare: 'lärare', laerare: 'lärare', lerare: 'lärare', lärarr: 'lärare', läärare: 'lärare',
  grundskolelarare: 'grundskollärare', gymnasielärar: 'gymnasielärare',
  amneslarare: 'ämneslärare', speciallarare: 'speciallärare',
  elevassitent: 'elevassistent',
  // ── Kontor / admin ──
  bokforing: 'bokföring', bokforare: 'bokförare', bokförare: 'bokförare',
  marknadsforing: 'marknadsföring', marknadforing: 'marknadsföring',
  kundtjanst: 'kundtjänst', kundtjenst: 'kundtjänst', kundserive: 'kundservice',
  projektledning: 'projektledare', projekletdare: 'projektledare',
  adminstrator: 'administratör', administrator: 'administratör', administratör: 'administratör',
  adminstratör: 'administratör', administratör2: 'administratör',
  assitent: 'assistent', assistent: 'assistent', assistant: 'assistent', assitant: 'assistent',
  konsullt: 'konsult', konsulnt: 'konsult', konsultt: 'konsult',
  recptionist: 'receptionist', recepsionist: 'receptionist', receptionst: 'receptionist',
  reseptonist: 'receptionist',
  sektreterare: 'sekreterare', sektretare: 'sekreterare',
  handlaggare: 'handläggare', handläggre: 'handläggare',
  koordinatr: 'koordinator', koordniator: 'koordinator',
  controler: 'controller', kontroler: 'controller',
  redovsiningsekonom: 'redovisningsekonom', ekonomassistent: 'ekonomiassistent',
  loneadministrator: 'löneadministratör', lonespecialist: 'lönespecialist',
  rekyterare: 'rekryterare', rekrytter: 'rekryterare',
  // ── Chef / ledning ──
  chef: 'chef', cheff: 'chef', shef: 'chef', schef: 'chef',
  ledre: 'ledare', ledrare: 'ledare', lder: 'ledare',
  vdd: 'vd', ceoo: 'ceo',
  // ── Transport ──
  chauffeur: 'chaufför', chauffor: 'chaufför', chauför: 'chaufför', chafför: 'chaufför',
  chuafför: 'chaufför', shufför: 'chaufför', shofför: 'chaufför', schaufför: 'chaufför',
  chuffor: 'chaufför', chuffør: 'chaufför',
  forare: 'förare', förar: 'förare', förere: 'förare', förarre: 'förare',
  lastbilschauffor: 'lastbilschaufför', lastbilsforare: 'lastbilsförare',
  lastbilschafför: 'lastbilschaufför',
  taxichauffor: 'taxichaufför', bussforare: 'bussförare', busschauffor: 'busschaufför',
  yrkeschauffor: 'yrkeschaufför', distributionsforare: 'distributionsförare',
  bubil: 'budbil', budbilsforare: 'budbilsförare', budbilschauffor: 'budbilschaufför',
  kuir: 'kurir', kurirbud: 'kurir',
  akare: 'åkare', utkorare: 'utkörare', leveransforare: 'leveransförare',
  truckforare: 'truckförare', gafffeltruck: 'gaffeltruck',
  // ── Tekniker ──
  teknker: 'tekniker', tekiker: 'tekniker', teknikker: 'tekniker', tekniiker: 'tekniker',
  servicetkeniker: 'servicetekniker', fordonstekniker2: 'fordonstekniker',
  mekniker: 'mekaniker', mekaanker: 'mekaniker', mekanker: 'mekaniker',
  bilmekniker: 'bilmekaniker',
  // ── Restaurang ──
  kokschef: 'kökschef', kock: 'kock', kokk: 'kock', kokc: 'kock',
  souschef2: 'souschef', kallskanka: 'kallskänka',
  servitor: 'servitör', servitris: 'servitör', servitör2: 'servitör', servitø: 'servitör',
  diskare: 'diskare', diskar: 'diskare', diskre: 'diskare',
  koksbitrade: 'köksbiträde', köksbitrade: 'köksbiträde', köksbiträ: 'köksbiträde',
  bartendr: 'bartender', baritsa: 'barista', barrista: 'barista',
  bagre: 'bagare', konditr: 'konditor',
  // ── Städ / bygg ──
  stadare: 'städare', stadning: 'städning', lokalvard: 'lokalvårdare', lokalvardare: 'lokalvårdare',
  loklavårdare: 'lokalvårdare', hemstadare: 'hemstädare', kontorsstadare: 'kontorsstädare',
  snikare: 'snickare', snickar: 'snickare', snikkare: 'snickare',
  elektikker: 'elektriker', eletriker: 'elektriker', elektricker: 'elektriker',
  elktriker: 'elektriker', elinstallator: 'elinstallatör',
  malare: 'målare', mallare: 'målare', målar: 'målare',
  murare: 'murare', muraree: 'murare', golvläggare2: 'golvläggare',
  rormokare: 'rörmokare', rørmokare: 'rörmokare', vvsmontor: 'vvs-montör',
  vvsinstalatör: 'vvsinstallatör',
  svetare: 'svetsare', svettsare: 'svetsare',
  betongarbetae: 'betongarbetare', anlaggningsarbetare: 'anläggningsarbetare',
  byggnadsabretare: 'byggnadsarbetare', bygare: 'byggare', hantverkae: 'hantverkare',
  timmerman2: 'timmerman',
  // ── Lager & industri ──
  lagerabetare: 'lagerarbetare', lageraretare: 'lagerarbetare', lagerarbetae: 'lagerarbetare',
  lageararbetare: 'lagerarbetare', laagerarbetare: 'lagerarbetare',
  plockar: 'plockare', orderplokare: 'orderplockare', orderplockar: 'orderplockare',
  packae: 'packare', pakare: 'packare',
  terminalabetare: 'terminalarbetare', godshanterare: 'godshanterare',
  industriabretare: 'industriarbetare', prodkutionsarbetare: 'produktionsarbetare',
  produktionabretare: 'produktionsarbetare', operatr: 'operatör', operatoer: 'operatör',
  maskinoperator: 'maskinoperatör', processoperator: 'processoperatör',
  montor: 'montör', monter: 'montör', kvalitetstekniker2: 'kvalitetstekniker',
  // ── Säkerhet ──
  vaktare: 'väktare', vaktarr: 'väktare', ordningsvakt2: 'ordningsvakt',
  sakerhetsvakt: 'säkerhetsvakt', dorrvakt: 'dörrvakt', entrevard: 'entrévärd',
  brandmn: 'brandman', raddningstjanst: 'räddningstjänst',
  // ── Marknad & kommunikation ──
  marknadsforare: 'marknadsförare', markandsförare: 'marknadsförare',
  kommunikator: 'kommunikatör', kommunikatr: 'kommunikatör',
  copyriter: 'copywriter', kopywriter: 'copywriter',
  contentcreater: 'content creator', socialmediamanager: 'socialmediemanager',
  redaktor: 'redaktör', informator: 'informatör',
  // ── Design ──
  uxdesigner: 'ux-designer', uidesigner: 'ui-designer',
  produkdesigner: 'produktdesigner', grafiskdesignr: 'grafiskdesigner',
  // ── HR ──
  personaladmin: 'personaladministratör', personaladministratr: 'personaladministratör',
  hrspecialist2: 'hr-specialist', hrpartner2: 'hrpartner',
  // ── Övrigt ──
  frisor: 'frisör', frisör2: 'frisör', friisör: 'frisör', frissör: 'frisör',
  massor: 'massör', massoer: 'massör',
  florst: 'florist', fotoggraf: 'fotograf', fotgraf: 'fotograf',
  personligtranare: 'personlig tränare', gyminstruktor: 'gyminstruktör',
  // ── Städer ──
  stocholm: 'stockholm', stockolm: 'stockholm', stokholm: 'stockholm', stockhlm: 'stockholm',
  stckholm: 'stockholm', stockhllm: 'stockholm',
  goteborg: 'göteborg', goeteborg: 'göteborg', götborg: 'göteborg', gtbg: 'göteborg',
  gøteborg: 'göteborg', gotteborg: 'göteborg',
  malmo: 'malmö', malmoe: 'malmö', mallmö: 'malmö', malmø: 'malmö',
  helsingbrog: 'helsingborg', hellsingborg: 'helsingborg', helsingbourg: 'helsingborg',
  helsingborj: 'helsingborg',
  linkoping: 'linköping', linkoepping: 'linköping', linjöping: 'linköping',
  jonkoping: 'jönköping', jonkoeping: 'jönköping',
  norrkoping: 'norrköping', norkoping: 'norrköping',
  orebro: 'örebro', oerebro: 'örebro', örrebro: 'örebro',
  vasteras: 'västerås', vaesteras: 'västerås', västras: 'västerås',
  umea: 'umeå', umeaa: 'umeå', umeo: 'umeå',
  lulea: 'luleå', luleaa: 'luleå',
  sundvall: 'sundsvall', sunsvall: 'sundsvall',
  karlsatd: 'karlstad', karltad: 'karlstad',
  vaxjo: 'växjö', vaexjoe: 'växjö', vaeksjo: 'växjö',
  uppsla: 'uppsala', uppsal: 'uppsala', uppsalla: 'uppsala',
  eskilstua: 'eskilstuna', halmastad: 'halmstad', gvle: 'gävle', gavle: 'gävle',
  boras: 'borås', boraas: 'borås',
  ostersund: 'östersund', oestersund: 'östersund',
  vasterbotten: 'västerbotten', vasternorrland: 'västernorrland',
};

// ─────────────────────────────────────────────────────────────
// SYNONYMKLUSTER: ord som betyder ungefär samma sak — söker du på ETT
// får du träffar på ALLA i klustret. Bidirektionellt, expansivt.
// Målet: skriver du "chaufför" ska "Budbilsförare sökes" hittas, och tvärtom.
// ─────────────────────────────────────────────────────────────
const SYNONYM_CLUSTERS: string[][] = [
  // ── TRANSPORT & LOGISTIK ──
  [
    'chaufför', 'chauffor', 'förare', 'forare', 'bud', 'budbil', 'budbilsförare',
    'budbilsforare', 'kurir', 'kurirförare', 'leverans', 'leveransförare',
    'leveransforare', 'utkörare', 'åkare', 'akare', 'taxichaufför', 'taxichauffor',
    'taxi', 'lastbilschaufför', 'lastbilschauffor', 'lastbilsförare', 'lastbilsforare',
    'yrkeschaufför', 'yrkeschauffor', 'distributionsförare', 'distributionsforare',
    'bussförare', 'bussforare', 'busschaufför', 'busschauffor',
  ],
  ['truckförare', 'truckforare', 'truck', 'truckförare/lager', 'gaffeltruck', 'truckchaufför', 'motviktstruck', 'skjutstativtruck', 'forklift', 'forklift operator'],
  ['lagerarbetare', 'lager', 'lagermedarbetare', 'lagerpersonal', 'plockare', 'packare', 'orderplockare', 'lagerplockare', 'warehouse worker', 'warehouse', 'plock och pack', 'plockpackare', 'inleveransarbetare', 'utleveransarbetare'],
  ['terminalarbetare', 'terminal', 'godsmottagning', 'godshantering', 'godshanterare', 'lossare', 'lastare', 'hamnarbetare', 'stuveriarbetare'],
  ['logistiker', 'logistik', 'logistikkoordinator', 'transportledare', 'transportplanerare', 'speditör', 'speditor', 'logistics coordinator', 'supply chain'],
  ['pilot', 'flygkapten', 'flygvärdinna', 'flygvärd', 'cabin crew', 'kabinpersonal', 'flygtekniker'],
  ['sjöman', 'sjoman', 'matros', 'däcksman', 'befälhavare'],

  // ── BYGG & HANTVERK ──
  ['snickare', 'byggare', 'bygg', 'byggnadsarbetare', 'hantverkare', 'timmerman', 'träarbetare', 'trarbetare', 'byggarbetare', 'byggnadssnickare', 'inredningssnickare', 'carpenter'],
  ['elektriker', 'el', 'elinstallatör', 'elinstallator', 'servicetekniker-el', 'installationselektriker', 'industrielektriker', 'servicelektriker', 'electrician', 'eltekniker', 'elmontör'],
  ['vvs-montör', 'vvsmontor', 'vvs', 'rörmokare', 'rormokare', 'rörläggare', 'rorlaggare', 'vvsinstallatör', 'vvstekniker', 'plumber', 'värme och sanitet', 'kyltekniker', 'ventilationsmontör'],
  ['målare', 'malare', 'byggmålare', 'industrimålare', 'painter', 'lackerare', 'billackerare'],
  ['betongarbetare', 'betong', 'anläggningsarbetare', 'anlaggningsarbetare', 'markarbetare', 'grundläggare', 'asfaltarbetare', 'väg och anläggning', 'väg- och anläggningsarbetare'],
  ['svetsare', 'svets', 'mig-svetsare', 'tig-svetsare', 'mag-svetsare', 'welder', 'svetsspecialist', 'rörssvetsare'],
  ['mekaniker', 'mekanik', 'bilmekaniker', 'servicetekniker', 'fordonstekniker', 'fordonsmekaniker', 'lastbilsmekaniker', 'däcktekniker', 'mechanic', 'motorreparatör', 'skadereparatör'],
  ['plåtslagare', 'platslagare', 'takläggare', 'taklaggare', 'byggplåtslagare'],
  ['golvläggare', 'golvlaggare', 'golvarbetare', 'plattsättare', 'plattsattare', 'kakelsättare', 'kakelsattare'],
  ['murare', 'murararbete', 'mason', 'stenläggare'],
  ['glasmästare', 'glasmastare', 'glasare'],
  ['arkitekt', 'byggnadsingenjör', 'byggnadsingenjor', 'byggingenjör', 'projekteringsingenjör', 'konstruktör', 'konstruktor', 'architect'],

  // ── RESTAURANG & LIVSMEDEL ──
  ['kock', 'kokk', 'kökschef', 'kokschef', 'souschef', 'kallskänka', 'kallskanka', 'restaurangbiträde', 'chef de partie', 'linjekock', 'pizzabagare', 'pizzabakare', 'sushikock', 'cook'],
  ['servitör', 'servitor', 'servitris', 'servis', 'restaurangpersonal', 'runner', 'hovmästare', 'hovmastare', 'waiter', 'waitress', 'serveringspersonal', 'restaurangvärd'],
  ['bartender', 'barpersonal', 'baristor', 'barista', 'coffee', 'baristo', 'kafépersonal', 'cafepersonal'],
  ['diskare', 'köksbiträde', 'koksbitrade', 'kokspersonal', 'kökspersonal', 'dishwasher'],
  ['bagare', 'konditor', 'bageri', 'baker', 'pastry chef', 'brödbagare'],
  ['livsmedelsarbetare', 'charkuterist', 'slaktare', 'köttskärare', 'fiskhandlare'],

  // ── HANDEL & SÄLJ ──
  [
    'säljare', 'saljare', 'butikssäljare', 'butikssaljare', 'butik', 'butiksmedarbetare',
    'butikspersonal', 'shopmedarbetare', 'säljmedarbetare', 'säljkonsulent',
    'telefonförsäljare', 'telefonsaljare', 'telemarketing', 'innesäljare', 'innesaljare',
    'utesäljare', 'utesaljare', 'fältsäljare', 'faltsaljare', 'account manager',
    'accountmanager', 'kam', 'keyaccount', 'affärsutvecklare', 'affarsutvecklare',
    'affärsområdeschef', 'affarsomradeschef', 'säljchef', 'saljchef', 'sales',
    'sales representative', 'sales manager', 'sales executive', 'account executive',
    'business developer', 'bdr', 'sdr', 'säljare b2b', 'säljare b2c', 'säljande',
    'butiksansvarig', 'shop assistant', 'retail', 'demonstratör',
  ],
  ['kassör', 'kassor', 'kassa', 'kassabiträde', 'kassabitrade', 'kassapersonal', 'cashier'],
  ['butikschef', 'butikssamordnare', 'store manager', 'storemanager', 'shop manager', 'assistant store manager'],
  ['inköpare', 'inkopare', 'inköp', 'inkop', 'purchaser', 'procurement', 'category manager', 'sortimentschef'],
  ['visual merchandiser', 'vm', 'butiksinredare', 'skyltdockare'],
  ['e-handel', 'ehandel', 'e-commerce', 'ecommerce', 'e-handelschef', 'e-commerce manager'],

  // ── VÅRD & OMSORG ──
  [
    'sjuksköterska', 'sjukskoterska', 'ssk', 'legitimeradsjuksköterska', 'grundutbildadsjuksköterska',
    'distriktssköterska', 'distriktsskoterska', 'anestesisjuksköterska', 'operationssjuksköterska',
    'barnsjuksköterska', 'iva-sjuksköterska', 'akutsjuksköterska', 'nurse', 'registered nurse', 'rn',
    'skolsjuksköterska', 'psykiatrisjuksköterska',
  ],
  ['undersköterska', 'underskoterska', 'usk', 'vårdbiträde', 'vardbitrade', 'omsorgspersonal', 'vårdare', 'vardare', 'nurse assistant', 'omsorgsassistent', 'stödassistent', 'stodassistent', 'boendestödjare', 'boendestodjare'],
  ['personlig assistent', 'personligassistent', 'personligassisent', 'assistent', 'personal assistant', 'ledsagare', 'pa'],
  ['barnskötare', 'barnskotare', 'förskollärare', 'forskollarare', 'fritidspedagog', 'fritidsledare', 'dagbarnvårdare', 'preschool teacher', 'nanny', 'au pair', 'barnvakt'],
  ['läkare', 'lakare', 'doktor', 'st-läkare', 'stlakare', 'allmänläkare', 'specialistläkare', 'överläkare', 'ol', 'physician', 'doctor', 'md', 'at-läkare'],
  ['fysioterapeut', 'sjukgymnast', 'arbetsterapeut', 'physiotherapist', 'occupational therapist', 'kiropraktor', 'naprapat'],
  ['tandläkare', 'tandlakare', 'tandsköterska', 'tandskoterska', 'tandhygienist', 'dentist', 'dental hygienist'],
  ['socialsekreterare', 'socionom', 'kurator', 'behandlingsassistent', 'behandlare', 'familjebehandlare', 'social worker', 'skolkurator'],
  ['psykolog', 'psykoterapeut', 'terapeut', 'psychologist', 'legitimerad psykolog', 'pt-legitimation'],
  ['optiker', 'optometrist', 'ögonläkare'],
  ['veterinär', 'veterinar', 'djursjukvårdare', 'djurskötare', 'vet', 'veterinary'],
  ['farmaceut', 'apotekare', 'apotekstekniker', 'pharmacist'],

  // ── SKOLA & PEDAGOGIK ──
  ['lärare', 'larare', 'grundskollärare', 'gymnasielärare', 'ämneslärare', 'amneslarare', 'speciallärare', 'sva-lärare', 'teacher', 'mattelärare', 'sva-pedagog', 'idrottslärare', 'musiklärare', 'språklärare', 'engelsklärare'],
  ['förskollärare', 'forskollarare', 'förskolechef', 'rektor', 'skolledare', 'biträdande rektor', 'preschool teacher', 'principal'],
  ['elevassistent', 'skolassistent', 'resurspedagog', 'fritidspedagog', 'teacher assistant'],
  ['studie- och yrkesvägledare', 'syv', 'studievägledare', 'career counsellor'],

  // ── STÄD & FASTIGHET ──
  ['lokalvårdare', 'lokalvardare', 'städare', 'stadare', 'städ', 'stad', 'städpersonal', 'stadpersonal', 'lokalvård', 'kontorsstädare', 'hemstädare', 'cleaner', 'cleaning', 'hotellstädare', 'byggstädare'],
  ['fastighetsskötare', 'fastighetsskotare', 'fastighet', 'vaktmästare', 'vaktmastare', 'fastighetstekniker', 'facility manager', 'building manager', 'fastighetsansvarig', 'fastighetsförvaltare'],
  ['trädgårdsarbetare', 'tradgardsarbetare', 'trädgårdsmästare', 'markskötare', 'gardener', 'anläggare', 'parkarbetare'],

  // ── IT / TEKNIK ──
  [
    'utvecklare', 'developer', 'dev', 'programmerare', 'kodare', 'software engineer',
    'softwareengineer', 'systemutvecklare', 'systemutveklare', 'apputvecklare',
    'webbutvecklare', 'webutvecklare', 'software developer', 'engineer', 'coder',
    'mjukvaruutvecklare', 'javautvecklare', 'javautveklare', '.net-utvecklare',
    'pythonutvecklare', 'nodeutvecklare', 'reactutvecklare', 'iosutvecklare',
    'androidutvecklare', 'mobilutvecklare', 'mobile developer', 'embedded developer',
    'inbyggnadsutvecklare',
  ],
  ['frontendutvecklare', 'frontend', 'frontendutveklare', 'frontend-utvecklare', 'ui-utvecklare', 'frontend developer', 'reactutvecklare', 'vue-utvecklare', 'angularutvecklare', 'client-side'],
  ['backendutvecklare', 'backend', 'backend-utvecklare', 'server-utvecklare', 'backend developer', 'nodejs-utvecklare', 'server-side', 'api-utvecklare'],
  ['fullstackutvecklare', 'fullstack', 'full-stack', 'full-stackutvecklare', 'fullstack developer', 'full stack developer'],
  ['devops', 'sre', 'plattformsingenjör', 'plattformsingenjor', 'devopsingenjör', 'site reliability engineer', 'platform engineer', 'cloud engineer', 'kubernetes-ingenjör', 'infrastrukturingenjör'],
  ['dataengineer', 'data engineer', 'datatekniker', 'dataarkitekt', 'datavetare', 'dataingenjör', 'etl-utvecklare', 'bi-utvecklare', 'business intelligence'],
  ['datascientist', 'data scientist', 'ml-ingenjör', 'ai-ingenjör', 'aiingenjor', 'machine learning engineer', 'ai engineer', 'ml engineer', 'dataanalytiker', 'data analyst', 'analytiker'],
  ['systemadministratör', 'systemadministrator', 'sysadmin', 'it-tekniker', 'ittekniker', 'supporttekniker', 'helpdesk', 'it-support', 'servicedesk', 'it support', 'nätverkstekniker', 'natverkstekniker', 'network engineer', 'itansvarig'],
  ['produktägare', 'produktagare', 'product owner', 'productowner', 'produktchef', 'produktledare', 'product manager', 'po', 'pm', 'produktstrateg'],
  ['projektledare', 'projekt', 'projektchef', 'projectmanager', 'programledare', 'project manager', 'program manager', 'delivery manager', 'teknisk projektledare', 'byggprojektledare'],
  ['scrummaster', 'scrum master', 'agilcoach', 'agile coach', 'kanban master'],
  ['ux-designer', 'ux', 'ui-designer', 'ui', 'produktdesigner', 'interaktionsdesigner', 'grafiskdesigner', 'formgivare', 'graphic designer', 'motion designer', 'illustratör', 'illustrator', 'brand designer', 'ux researcher', 'ux writer'],
  ['säkerhetsingenjör', 'informationssäkerhet', 'it-säkerhet', 'cybersäkerhet', 'security engineer', 'infosec', 'soc-analytiker', 'penetrationstestare', 'pentester'],
  ['qa-testare', 'qa', 'testare', 'testautomatiserare', 'test automation', 'quality assurance', 'test engineer', 'kvalitetstestare'],
  ['tech lead', 'techlead', 'lead developer', 'utvecklingschef', 'cto', 'engineering manager', 'utvecklingsledare'],

  // ── EKONOMI / HR ──
  ['ekonom', 'ekonomi', 'ekonomiassistent', 'ekonomichef', 'controller', 'redovisningsekonom', 'redovisningskonsult', 'business controller', 'financial controller', 'cfo', 'finance manager', 'ekonomiansvarig'],
  ['bokförare', 'bokforare', 'bokföring', 'bokforing', 'redovisning', 'accountant', 'accounting'],
  ['revisor', 'revision', 'revisorsassistent', 'auktoriseradrevisor', 'auditor', 'internrevisor'],
  ['hr', 'hr-generalist', 'hrpartner', 'hrchef', 'hr-specialist', 'personaladministratör', 'personalchef', 'rekryterare', 'talent acquisition', 'talentacquisition', 'hr business partner', 'hrbp', 'people partner', 'recruiter', 'talent partner', 'people & culture'],
  ['löneadministratör', 'loneadministrator', 'lönespecialist', 'lonespecialist', 'lön', 'lon', 'payroll specialist', 'löneassistent'],
  ['jurist', 'advokat', 'bolagsjurist', 'legal counsel', 'affärsjurist', 'notarie', 'paralegal'],
  ['bank', 'banktjänsteman', 'banktjansteman', 'kundrådgivare', 'kundradgivare', 'privatrådgivare', 'företagsrådgivare', 'financial advisor', 'investment banker'],
  ['försäkringstjänsteman', 'försäkringsförmedlare', 'insurance broker', 'skadereglerare'],

  // ── MARKNAD & KOMMUNIKATION ──
  ['marknadsförare', 'marknadsforare', 'marknadsföring', 'marknadsforing', 'marknadschef', 'marknadskoordinator', 'marketing', 'marketing manager', 'marknadsassistent', 'marketing coordinator', 'brand manager', 'varumärkeschef'],
  ['kommunikatör', 'kommunikator', 'kommunikation', 'informatör', 'informator', 'presskontakt', 'pr', 'communications manager', 'kommunikationschef', 'pressekreterare'],
  ['sociala medier', 'socialmedia', 'social media', 'socialmediemanager', 'content creator', 'contentcreator', 'copywriter', 'skribent', 'redaktör', 'redaktor', 'community manager', 'content manager', 'content strategist', 'contentstrateg', 'seo-specialist', 'seo specialist', 'sem-specialist', 'growth marketer', 'performance marketer', 'digital marknadsförare'],
  ['event', 'eventkoordinator', 'eventansvarig', 'event manager', 'projektledare event', 'mötesbokare', 'event planner'],

  // ── KONTOR / ADMINISTRATION ──
  ['administratör', 'administratoer', 'administrator', 'sekreterare', 'kontorsassistent', 'kanslist', 'handläggare', 'handlaggare', 'office coordinator', 'office manager', 'kontorsansvarig', 'executive assistant', 'ea', 'kontorschef', 'ledningsassistent'],
  ['receptionist', 'reception', 'kontorsreceptionist', 'front office', 'frontoffice', 'receptionschef', 'hotellreceptionist'],
  ['kundtjänst', 'kundtjanst', 'kundservice', 'kundsupport', 'customer support', 'customersupport', 'customer success', 'customer service', 'customer experience', 'cx', 'kundservicemedarbetare', 'kundtjänstmedarbetare', 'servicerådgivare', 'call center'],

  // ── SÄKERHET ──
  ['väktare', 'vaktare', 'ordningsvakt', 'säkerhetsvakt', 'sakerhetsvakt', 'skyddsvakt', 'entrévärd', 'entrevard', 'dörrvakt', 'dorrvakt', 'security guard', 'securitas', 'crossbar', 'butikskontrollant'],
  ['parkeringsvakt', 'parkering', 'p-vakt', 'parkeringsövervakare'],
  ['brandman', 'räddningstjänst', 'raddningstjanst', 'firefighter', 'brandingenjör'],
  ['polis', 'polisassistent', 'kriminalinspektör', 'police officer'],

  // ── INDUSTRI ──
  ['industriarbetare', 'industri', 'produktionsarbetare', 'produktion', 'operatör', 'operator', 'processoperatör', 'maskinoperatör', 'maskinoperator', 'production worker', 'produktionstekniker', 'linjearbetare'],
  ['montör', 'montor', 'montering', 'assembly worker', 'monteringstekniker', 'slutmontör', 'elektronikmontör'],
  ['kvalitetskontrollant', 'kvalitet', 'kvalitetstekniker', 'kvalitetsingenjör', 'quality engineer', 'quality inspector', 'kvalitetsansvarig'],
  ['maskiningenjör', 'maskiningenjor', 'produktionsingenjör', 'productionengineer', 'mechanical engineer', 'processingenjör'],
  ['underhållstekniker', 'underhallstekniker', 'maintenance technician', 'reparatör', 'reparator', 'servicetekniker industri'],

  // ── LANTBRUK / SKOG ──
  ['lantbrukare', 'bonde', 'jordbrukare', 'lantarbetare', 'farmer', 'skogsarbetare', 'skogshuggare', 'skogsmaskinförare'],
  ['djurskötare', 'djurskotare', 'stallpersonal', 'ridinstruktör', 'hovslagare'],

  // ── ÖVRIGT ──
  ['frisör', 'frisor', 'stylist', 'barberare', 'hairdresser', 'barber', 'hårstylist'],
  ['massör', 'massor', 'massage', 'terapeut', 'massage therapist', 'spaterapeut'],
  ['personaltrainer', 'personlig tränare', 'ptr', 'gyminstruktör', 'gyminstruktor', 'personal trainer', 'pt', 'fitness coach', 'träningskonsulent', 'gruppträningsinstruktör'],
  ['florist', 'blomsterdekoratör', 'florist assistant'],
  ['fotograf', 'videograf', 'filmare', 'photographer', 'videographer', 'kameraman', 'filmproducent', 'editor', 'videoklippare'],
  ['tolk', 'översättare', 'oversattare', 'translator', 'interpreter', 'auktoriserad tolk'],
  ['taxichaufför', 'uber', 'bolt', 'taxi'],
];

// Normalisera ett token (utan Å/Ä/Ö och mellanslag) för uppslag.
const normalizeToken = (t: string): string =>
  t.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/\s+/g, '');

const SEARCH_STOP_WORDS = new Set([
  'i', 'pa', 'på', 'vid', 'och', 'eller', 'med', 'som', 'till', 'for', 'för', 'av', 'en', 'ett', 'den', 'det',
]);

const addTermForms = (target: Set<string>, term: string) => {
  const lower = term.trim().toLowerCase();
  if (!lower) return;

  target.add(lower);
  const normalized = normalizeToken(lower);
  if (normalized) target.add(normalized);

  lower
    .split(/[\s,/()&+-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !SEARCH_STOP_WORDS.has(normalizeToken(part)))
    .forEach((part) => {
      target.add(part);
      target.add(normalizeToken(part));
    });
};

const OCCUPATION_KNOWN_TERMS = OCCUPATION_CATEGORIES.flatMap((category) => [
  category.label,
  category.value,
  ...category.keywords,
  ...category.subcategories,
]);

// Bygg lookup: normaliserat token → array av alla kluster-medlemmar i både originalform och normaliserad form.
const CLUSTER_LOOKUP: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const cluster of SYNONYM_CLUSTERS) {
    const memberForms = new Set<string>();
    cluster.forEach((term) => addTermForms(memberForms, term));

    const members = Array.from(memberForms).filter((t) => t.length >= 2 && !SEARCH_STOP_WORDS.has(normalizeToken(t)));
    for (const member of members) {
      const key = normalizeToken(member);
      if (!m.has(key)) m.set(key, members);
    }
  }
  return m;
})();

// Pre-computed pool av kända kanoniska termer för Levenshtein-fallback.
const knownCanonicalTerms: string[] = Array.from(
  new Set([
    ...Object.values(typoCorrections).map((v) => normalizeToken(v)),
    ...SYNONYM_CLUSTERS.flat().map((v) => normalizeToken(v)),
    ...OCCUPATION_KNOWN_TERMS.map((v) => normalizeToken(v)),
    ...Array.from(CLUSTER_LOOKUP.keys()),
  ])
).filter((t) => t.length >= 4);

const resolveKnownLocationTerm = (raw: string, allowPrefix = false): string | null => {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned || cleaned.length < 3) return null;

  const normalized = normalizeSwedish(cleaned);
  const normalizedToken = normalizeToken(cleaned);
  const corrected = typoCorrections[normalizedToken];
  const candidates = [cleaned, normalized, corrected, corrected ? normalizeSwedish(corrected) : null]
    .filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (allKnownLocationTerms.has(candidate)) return candidate;
  }

  let bestMatch: string | null = null;
  for (const term of allKnownLocationTerms) {
    const termNorm = normalizeSwedish(term);
    const exact = candidates.some((candidate) => termNorm === normalizeSwedish(candidate));
    const prefix = allowPrefix && candidates.some((candidate) => termNorm.startsWith(normalizeSwedish(candidate)));
    if ((exact || prefix) && (!bestMatch || term.length < bestMatch.length)) {
      bestMatch = term;
    }
  }

  return bestMatch;
};

const fuzzyFindCanonical = (norm: string): string | null => {
  if (norm.length < 5) return null;
  const allowedDistance = norm.length >= 8 ? 2 : 1;
  let best: { term: string; dist: number } | null = null;

  for (const term of knownCanonicalTerms) {
    if (Math.abs(term.length - norm.length) > allowedDistance) continue;
    if (term[0] !== norm[0] && allowedDistance < 2) continue;
    const dist = levenshteinDistance(term, norm);
    if (dist <= allowedDistance && (!best || dist < best.dist)) {
      best = { term, dist };
    }
  }
  return best ? best.term : null;
};

/**
 * 🔥 Fras-extraktion: hitta plats i multi-word input.
 * "affärsområdeschef i Malmö" → { location: "malmö", rest: "affärsområdeschef" }
 */
export function extractPhraseLocation(searchQuery: string): { location: string; rest: string } | null {
  const trimmed = searchQuery.trim();
  if (!trimmed || !trimmed.includes(' ')) return null;

  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) return null;

  for (const take of [3, 2, 1]) {
    if (tokens.length <= take) continue;
    const candidateRaw = tokens.slice(-take).join(' ').toLowerCase();
    const candidate = candidateRaw.replace(/^(i|pa|på|vid)\s+/, '').trim();
    if (candidate.length < 3) continue;

    const matchTerm = resolveKnownLocationTerm(candidate);

    if (matchTerm) {
      let rest = tokens.slice(0, -take).join(' ').trim();
      rest = rest.replace(/\s+(i|pa|på|vid)$/i, '').trim();
      return { location: matchTerm, rest };
    }
  }

  return null;
}

/**
 * 🔥 Detektera plats i söksträngen. Enskilt ord eller fras.
 */
export function detectLocationInQuery(searchQuery: string): { location: string; rest: string } | null {
  const trimmed = searchQuery.trim().toLowerCase();
  if (!trimmed || trimmed.length < 3) return null;

  const phrase = extractPhraseLocation(searchQuery);
  if (phrase) return phrase;

  const match = resolveKnownLocationTerm(trimmed, true);
  if (match) return { location: match, rest: '' };

  return null;
}

const stripSwedishEnding = (value: string): string => {
  if (value.length <= 4) return value;
  return value
    .replace(/(ets|ens)$/i, '')
    .replace(/(arnas|ernas|ornas)$/i, '')
    .replace(/(arna|erna|orna)$/i, '')
    .replace(/(ande|ende)$/i, '')
    .replace(/(het|en|et|ar|er|or|s)$/i, '');
};

const getTokenLookupKeys = (token: string): string[] => {
  const norm = normalizeToken(token);
  const stripped = stripSwedishEnding(norm);
  return Array.from(new Set([norm, stripped, typoCorrections[norm] ? normalizeToken(typoCorrections[norm]) : '', typoCorrections[stripped] ? normalizeToken(typoCorrections[stripped]) : '']))
    .filter((key) => key.length >= 2 && !SEARCH_STOP_WORDS.has(key));
};

const addClusterExpansion = (expanded: Set<string>, key: string) => {
  const cluster = CLUSTER_LOOKUP.get(normalizeToken(key));
  if (!cluster) return false;
  for (const member of cluster) expanded.add(member);
  return true;
};

const buildCompoundCandidates = (leftRaw: string, rightRaw: string): string[] => {
  const left = leftRaw.trim().toLowerCase();
  const right = rightRaw.trim().toLowerCase();
  const rightNorm = normalizeToken(right);
  if (!left || !right || SEARCH_STOP_WORDS.has(normalizeToken(left)) || SEARCH_STOP_WORDS.has(rightNorm)) return [];

  const leftBase = left
    .replace(/(ets|ens)$/i, 'e')
    .replace(/(arnas|ernas|ornas)$/i, '')
    .replace(/(arna|erna|orna)$/i, '')
    .replace(/(en|et)$/i, '')
    .replace(/s$/i, '');

  const normalizedBase = stripSwedishEnding(normalizeToken(left));
  return Array.from(new Set([
    `${left}${right}`,
    `${left}s${right}`,
    `${leftBase}${right}`,
    `${leftBase}s${right}`,
    `${normalizedBase}${rightNorm}`,
    `${normalizedBase}s${rightNorm}`,
  ])).filter((candidate) => candidate.length >= 5);
};

/**
 * 🔥 Smart titelsökning — expansiv, bidirektionell, felstavningstolerant.
 *
 * För varje token i inputen:
 *   1. Normalisera (utan å/ä/ö).
 *   2. Kolla typo-korrigering (utveklare → utvecklare).
 *   3. Kolla synonymkluster (chaufför ↔ bud ↔ budbil ↔ kurir ↔ ...).
 *      → Returnerar ALLA kluster-medlemmar så DB:n får OR-match på alla.
 *   4. "s"-suffix (chaufförs → chaufför) fångas.
 *   5. Fuzzy Levenshtein för okända stavfel.
 *
 * Alla utökade termer sammanfogas med mellanslag → DB:ns tsquery blir en OR
 * (via v_or_tsquery i search_jobs-RPC) så jobb som innehåller NÅGON av
 * termerna matchar. Rank prioriterar exakta träffar först.
 */
const smartenTitleQuery = (raw: string): string => {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';

  const expanded = new Set<string>();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.length < 2) {
      expanded.add(token);
      continue;
    }
    const norm = normalizeToken(token);
    if (SEARCH_STOP_WORDS.has(norm)) continue;

    // Alltid behåll originaltoken (så användarens exakta stavning finns med).
    expanded.add(token.toLowerCase());
    expanded.add(norm);

    // 1. Typo-korrigering → kanonisk form.
    let canonical = typoCorrections[norm];

    // 2. Prova svensk böjning/genitiv: "chaufförs", "affärsområdets", "elektrikern".
    if (!canonical && norm.length > 4) {
      const stripped = stripSwedishEnding(norm);
      canonical = typoCorrections[stripped];
      if (canonical) expanded.add(stripped);
    }

    if (canonical) {
      expanded.add(canonical);
      expanded.add(normalizeToken(canonical));
    }

    // 3. Synonymkluster (för både originalet och den ev. korrigerade formen).
    const lookupKeys = [...getTokenLookupKeys(token), canonical ? normalizeToken(canonical) : null].filter(Boolean) as string[];
    let foundCluster = false;
    for (const key of lookupKeys) {
      foundCluster = addClusterExpansion(expanded, key) || foundCluster;
    }

    // 4. Fuzzy fallback för okända stavfel.
    if (!canonical && !foundCluster) {
      const fuzzy = lookupKeys.map((key) => fuzzyFindCanonical(key)).find(Boolean) || null;
      if (fuzzy) {
        expanded.add(fuzzy);
        addClusterExpansion(expanded, fuzzy);
      }
    }

    // 5. Svenska sammansättningar: "affärsområdets chef" → "affärsområdeschef".
    const nextToken = tokens[index + 1];
    if (nextToken) {
      for (const compound of buildCompoundCandidates(token, nextToken)) {
        expanded.add(compound);
        expanded.add(normalizeToken(compound));
        const compoundFuzzy = fuzzyFindCanonical(normalizeToken(compound));
        if (compoundFuzzy) {
          expanded.add(compoundFuzzy);
          addClusterExpansion(expanded, compoundFuzzy);
        }
        addClusterExpansion(expanded, compound);
      }
    }
  }

  // Filtrera bort för korta termer och begränsa till max 80 tokens (skydd mot query-explosion).
  const result = Array.from(expanded).filter((t) => t.length >= 2 && !SEARCH_STOP_WORDS.has(normalizeToken(t))).slice(0, 80);
  return result.join(' ');
};

function mapEmploymentTypes(employmentTypes: string[]) {
  return employmentTypes.map((type) => {
    const typeMap: Record<string, string> = {
      full_time: 'full_time',
      heltid: 'full_time',
      part_time: 'part_time',
      deltid: 'part_time',
      contract: 'contract',
      konsult: 'contract',
      temporary: 'temporary',
      vikariat: 'temporary',
      interim: 'interim',
      internship: 'internship',
      praktik: 'internship',
      lia: 'lia',
      summer_job: 'summer_job',
      sommarjobb: 'summer_job',
      timanstallning: 'part_time',
    };

    return typeMap[normalizeSwedish(type).replace(/\s+/g, '_')] || type;
  });
}

function useSearchParamsState(options: UseOptimizedJobSearchOptions) {
  const { searchQuery, city, employmentTypes, category, subcategories } = options;

  const selectedLocations = useMemo(
    () => city.split(' | ').map((value) => value.trim()).filter(Boolean),
    [city]
  );

  const hasMultipleLocations = selectedLocations.length > 1;
  const primaryLocation = selectedLocations[0] || '';
  const isCounty = primaryLocation.endsWith(' län');
  const baseCityFilter = hasMultipleLocations ? '' : isCounty ? '' : primaryLocation;
  const baseCountyFilter = hasMultipleLocations ? '' : isCounty ? primaryLocation : '';

  const phraseLocationExtract = useMemo(() => extractPhraseLocation(searchQuery), [searchQuery]);

  const detectedLocationSearch = useMemo(() => {
    // 1. Fras-extraktion har högsta prio
    if (phraseLocationExtract) return phraseLocationExtract.location;

    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed || trimmed.length < 3) return null;
    if (allKnownLocationTerms.has(trimmed)) return trimmed;

    let bestMatch: string | null = null;
    for (const term of allKnownLocationTerms) {
      if (term.startsWith(trimmed) && (!bestMatch || term.length < bestMatch.length)) {
        bestMatch = term;
      }
    }
    if (bestMatch) return bestMatch;

    const normalized = normalizeSwedish(trimmed);
    for (const [typo, correction] of Object.entries(typoCorrections)) {
      if (normalized === typo || levenshteinDistance(normalized, typo) <= 1) {
        const locationMatch = resolveKnownLocationTerm(correction);
        if (locationMatch) return locationMatch;
      }
    }

    for (const term of allKnownLocationTerms) {
      if (normalizeSwedish(term).startsWith(normalized) && (!bestMatch || term.length < bestMatch.length)) {
        bestMatch = term;
      }
    }

    return bestMatch;
  }, [searchQuery, phraseLocationExtract]);

  const { expandedSearchQuery, salarySearch } = useMemo(() => {
    if (!searchQuery.trim()) return { expandedSearchQuery: '', salarySearch: null };

    // Fras med plats: sök på RESTEN som titel + använd platsen som filter
    if (phraseLocationExtract && phraseLocationExtract.rest) {
      return {
        expandedSearchQuery: smartenTitleQuery(phraseLocationExtract.rest),
        salarySearch: null,
      };
    }

    if (detectedLocationSearch) return { expandedSearchQuery: '', salarySearch: null };

    const salaryResult = detectSalarySearch(searchQuery);
    if (salaryResult.isSalarySearch) {
      return { expandedSearchQuery: '', salarySearch: salaryResult };
    }

    return {
      expandedSearchQuery: smartenTitleQuery(searchQuery),
      salarySearch: null,
    };
  }, [searchQuery, detectedLocationSearch, phraseLocationExtract]);

  const employmentCodes = useMemo(() => mapEmploymentTypes(employmentTypes), [employmentTypes]);

  const categoryFilter = useMemo(() => {
    if (category && category !== 'all' && category !== 'all-categories') return category;
    return '';
  }, [category]);

  const categorySearchTerms = useMemo(() => {
    return subcategories.length > 0 ? subcategories.join(' ') : '';
  }, [subcategories]);

  const cityFilter = useMemo(() => {
    if (detectedLocationSearch && !baseCityFilter) {
      if (detectedLocationSearch.endsWith(' län')) return '';
      return detectedLocationSearch;
    }
    return baseCityFilter;
  }, [detectedLocationSearch, baseCityFilter]);

  const countyFilter = useMemo(() => {
    if (detectedLocationSearch && !baseCountyFilter && detectedLocationSearch.endsWith(' län')) {
      return detectedLocationSearch;
    }
    return baseCountyFilter;
  }, [detectedLocationSearch, baseCountyFilter]);

  const fullSearchQuery = useMemo(() => {
    return [expandedSearchQuery, categorySearchTerms].filter(Boolean).join(' ');
  }, [expandedSearchQuery, categorySearchTerms]);

  return {
    selectedLocations,
    cityFilter,
    countyFilter,
    employmentCodes,
    categoryFilter,
    fullSearchQuery,
    salarySearch,
  };
}

interface JobReviewMap {
  [employerId: string]: {
    avgRating?: number;
    reviewCount: number;
  };
}

interface RealtimeJobPosting extends Partial<SearchJob> {
  id: string;
  deleted_at?: string | null;
  published_at?: string | null;
}

/**
 * Måste spegla samma regel som `search_jobs`-RPC:n: publicerad, aktiv, ej
 * raderad OCH ej utgången. Utan expires_at-kontrollen blev en annons som
 * gick ut medan jobbsökaren hade listan öppen kvar i listan tills nästa
 * refetch — sökningen och realtidsströmmen hade två olika sanningar.
 */
const isRealtimeJobVisible = (job?: RealtimeJobPosting | null) => {
  if (!job?.is_active || job?.deleted_at) return false;
  const expiresAt = job.expires_at;
  if (job.published_at && expiresAt) {
    const ts = new Date(expiresAt).getTime();
    if (!Number.isNaN(ts) && ts < Date.now()) return false;
  }
  return true;
};


function useCompanyReviews(employerIds: string[], isEnabled: boolean) {
  return useQuery({
    queryKey: ['company-reviews-batch', employerIds],
    queryFn: async (): Promise<JobReviewMap> => {
      if (employerIds.length === 0) return {};

      const { data } = await supabase
        .from('company_reviews_public')
        .select('company_id, rating')
        .in('company_id', employerIds);

      const ratingsMap: JobReviewMap = {};
      if (data) {
        const acc: Record<string, { total: number; count: number }> = {};
        data.forEach((row) => {
          if (!acc[row.company_id]) acc[row.company_id] = { total: 0, count: 0 };
          acc[row.company_id].total += row.rating;
          acc[row.company_id].count++;
        });

        Object.keys(acc).forEach((id) => {
          ratingsMap[id] = {
            avgRating: acc[id].total / acc[id].count,
            reviewCount: acc[id].count,
          };
        });
      }

      return ratingsMap;
    },
    enabled: employerIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
  });
}

export function useOptimizedJobSearch(options: UseOptimizedJobSearchOptions) {
  const { enabled = true, employerIds: employerIdsFilter, createdAfter, pageSize = 100, sort = 'newest' } = options;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    selectedLocations,
    cityFilter,
    countyFilter,
    employmentCodes,
    categoryFilter,
    fullSearchQuery,
    salarySearch,
  } = useSearchParamsState(options);

  // Stabil nyckel för employerIds (sortad) så att vi inte triggar refetch
  // bara för att array-referensen ändras.
  const employerIdsKey = useMemo(() => {
    if (!employerIdsFilter || employerIdsFilter.length === 0) return '';
    return [...employerIdsFilter].sort().join(',');
  }, [employerIdsFilter]);

  const employerIdsArray = useMemo(() => {
    return employerIdsKey ? employerIdsKey.split(',') : null;
  }, [employerIdsKey]);

  const cacheKey = useMemo(
    () => searchCacheKey([
      'optimized-job-search',
      fullSearchQuery,
      cityFilter,
      countyFilter,
      employmentCodes,
      categoryFilter,
      salarySearch?.targetSalary,
      salarySearch?.isMinimumSearch,
      employerIdsKey,
      createdAfter || '',
      sort,
    ]),
    [fullSearchQuery, cityFilter, countyFilter, employmentCodes, categoryFilter, salarySearch?.targetSalary, salarySearch?.isMinimumSearch, employerIdsKey, createdAfter, sort]
  );

  // 🔥 SCALE: useInfiniteQuery med cursor-paginering på created_at.
  // Första sidan visas direkt; fetchNextPage() laddar nästa batch (default 100)
  // utan att hämta om tidigare sidor. Detta tar bort 100-jobbs-taket och
  // skalar till miljoner rader eftersom DB:n bara läser pageSize rader per call.
  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'optimized-job-search',
      fullSearchQuery,
      cityFilter,
      countyFilter,
      employmentCodes,
      categoryFilter,
      salarySearch?.targetSalary,
      salarySearch?.isMinimumSearch,
      employerIdsKey,
      createdAfter || '',
      sort,
    ],
    queryFn: async ({ pageParam }) => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const cursor = pageParam as SearchCursor | null;

      try {
        return readThroughCache<SearchJob[]>(
          searchCacheKey([HOT_SEARCH_CACHE_PREFIX, fullSearchQuery, cityFilter, countyFilter, employmentCodes, categoryFilter, salarySearch?.targetSalary, salarySearch?.isMinimumSearch, pageSize, sort, cursor ? `${cursor.createdAt}|${cursor.id}` : '', employerIdsKey, createdAfter || '']),
          HOT_SEARCH_CACHE_TTL,
          async () => {
            const { data, error } = await measurePerformance('search', () => supabase.rpc('search_jobs', {
              p_search_query: fullSearchQuery || null,
              p_city: cityFilter || null,
              p_county: countyFilter || null,
              p_employment_types: employmentCodes.length > 0 ? employmentCodes : null,
              p_category: categoryFilter || null,
              p_salary_min: salarySearch?.isMinimumSearch ? salarySearch.targetSalary : (salarySearch?.targetSalary || null),
              p_salary_max: salarySearch?.isMinimumSearch ? null : (salarySearch?.targetSalary || null),
              p_limit: pageSize,
              p_offset: 0,
              p_cursor_created_at: cursor?.createdAt ?? null,
              p_cursor_id: cursor?.id ?? null,
              p_cursor_rank: cursor?.rank ?? null,
              p_cursor_views: cursor?.views ?? null,
              p_sort: sort,
              p_employer_ids: employerIdsArray,
              p_created_after: createdAfter || null,
            } as any));

            if (error) throw error;
            return (data || []) as unknown as SearchJob[];
          },
          Array.isArray,
        );
      } catch (err) {
        // Vid första sidan + nätverksfel: använd cachad data om den finns
        if (!cursor) {
          const cached = readSearchCache(cacheKey);
          if (cached && cached.length > 0) {
            warmCompanyLogos(cached);
            return cached;
          }
        }
        throw err;
      }
    },
    initialPageParam: null as SearchCursor | null,
    getNextPageParam: (lastPage): SearchCursor | undefined => {
      if (!lastPage || lastPage.length < pageSize) return undefined;
      const last = lastPage[lastPage.length - 1];
      if (!last?.created_at || !last?.id) return undefined;
      return {
        createdAt: last.created_at,
        id: last.id,
        rank: typeof last.search_rank === 'number' ? last.search_rank : 0,
        views: typeof last.views_count === 'number' ? last.views_count : 0,
      };
    },
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const rawJobs = useMemo(() => {
    const flat = data?.pages.flat() || [];
    // Persistera första sidan som offline-fallback
    if (flat.length > 0 && (data?.pages.length ?? 0) === 1) {
      writeSearchCache(cacheKey, flat);
    }
    return flat;
  }, [data, cacheKey]);

  const employerIds = useMemo(() => [...new Set(rawJobs.map((job) => job.employer_id).filter(Boolean))], [rawJobs]);
  const jobIds = useMemo(() => [...new Set(rawJobs.map((job) => job.id).filter(Boolean))], [rawJobs]);

  // 🔥 SCALE: useLiveJobBranding togs bort — RPC:n search_jobs returnerar redan
  // workplace_name + company_logo_url + alla branding-fält. Realtime-listenern
  // nedan håller datan färsk om en arbetsgivare byter logo eller namn.
  const { data: reviewsData = {} } = useCompanyReviews(employerIds);

  const enrichedJobs = useMemo(() => {
    const jobs = rawJobs
      .map((job) => {
        return {
          ...job,
          company_name: job.workplace_name?.trim() || 'Okänt företag',
          company_logo_url: job.company_logo_url || undefined,
          company_avg_rating: reviewsData[job.employer_id]?.avgRating,
          company_review_count: reviewsData[job.employer_id]?.reviewCount || 0,
          views_count: job.views_count || 0,
          applications_count: job.applications_count || 0,
        };
      })
      .filter((job) => !getTimeRemaining(job.created_at, job.expires_at).isExpired);

    if (selectedLocations.length <= 1) return jobs;

    return jobs.filter((job) => {
      const searchableFields = [
        job.location,
        job.workplace_city,
        job.workplace_county,
        job.workplace_municipality,
        job.workplace_address,
        job.workplace_name,
      ]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());

      return selectedLocations.some((selectedLocation) => {
        const normalizedSelection = selectedLocation.toLowerCase();
        return searchableFields.some((field) => field === normalizedSelection || field.includes(normalizedSelection));
      });
    });
  }, [rawJobs, reviewsData, selectedLocations]);

  // 🔥 SCALE: Realtime-listenern är scope:ad till de jobb som faktiskt visas.
  // PostgREST in.()-filter cap:as på 200 ids; vi prenumererar på max 200 av
  // de mest relevanta (första sidan), inte hela det infinitivt växande resultatet.
  const realtimeJobIdsKey = useMemo(() => {
    if (jobIds.length === 0) return '';
    return jobIds.slice(0, 200).sort().join(',');
  }, [jobIds]);

  useEffect(() => {
    if (!realtimeJobIdsKey) return;
    const ids = realtimeJobIdsKey.split(',');
    const filter = `id=in.(${ids.join(',')})`;

    const channel = createRealtimeChannel(`optimized-search-realtime-${ids.length}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_postings', filter },
        (payload) => {
          const nextJob = payload.new as RealtimeJobPosting;
          const previousJob = payload.old as RealtimeJobPosting;

          if (payload.eventType === 'UPDATE') {
            queryClient.setQueriesData<{ pages: SearchJob[][]; pageParams: unknown[] }>(
              { queryKey: ['optimized-job-search'] },
              (existing) => {
                if (!existing?.pages) return existing;
                return {
                  ...existing,
                  pages: existing.pages.map((page) => {
                    if (!isRealtimeJobVisible(nextJob)) {
                      return page.filter((job) => job.id !== nextJob.id);
                    }
                    return page.map((job) => (
                      job.id === nextJob.id
                        ? {
                            ...job,
                            ...nextJob,
                            company_name: nextJob.workplace_name?.trim() || (job as any).company_name || 'Okänt företag',
                            company_logo_url: nextJob.company_logo_url ?? job.company_logo_url,
                          }
                        : job
                    ));
                  }),
                };
              }
            );
          }

          if (payload.eventType === 'DELETE') {
            queryClient.setQueriesData<{ pages: SearchJob[][]; pageParams: unknown[] }>(
              { queryKey: ['optimized-job-search'] },
              (existing) => {
                if (!existing?.pages) return existing;
                return {
                  ...existing,
                  pages: existing.pages.map((page) => page.filter((job) => job.id !== previousJob.id)),
                };
              }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, realtimeJobIdsKey]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  return {
    jobs: enrichedJobs,
    isLoading,
    error,
    refetch,
    totalCount: enrichedJobs.length,
    fetchNextPage,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
  };
}
