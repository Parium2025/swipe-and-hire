import { supabase } from '@/integrations/supabase/client';

// Client-side quick check — lightweight heuristic only
// Real discrimination detection is done by AI on the backend
const OBVIOUS_DISCRIMINATION_PATTERNS = [
  // ╔══════════════════════════════════════════════════════════╗
  // ║  SWEDISH                                                 ║
  // ╚══════════════════════════════════════════════════════════╝

  // --- Ethnicity / Race / Nationality ---
  { pattern: /\betnicitet\b|\bras\b|\bhudfärg\b|\bhudfärgen\b|\brasism\b|\brasist\b/i, category: 'Etnisk diskriminering' },
  { pattern: /\binvandrare?\b|\butlänning\b|\butlänningar\b|\binvandrar\w*|\bflykting\w*|\basylsökande\b/i, category: 'Etnisk diskriminering' },
  { pattern: /\bsvensk bakgrund\b|\butländsk bakgrund\b|\bsvensk härkomst\b|\butländsk härkomst\b/i, category: 'Etnisk diskriminering' },
  { pattern: /\bsvenne\b|\bsvennar\b|\bblansen\b|\bneger\b|\bnegrer\b|\bnegress\b/i, category: 'Rasistiskt språk' },
  { pattern: /\bsvartskalle\b|\bsvartskallar\b|\bblatte\b|\bblattar\b|\bzigenare?\b|\bromer\b/i, category: 'Rasistiskt språk' },
  { pattern: /\bkanake?\b|\bkanaker\b|\bbabbe?\b|\bbabbar\b|\babor?\b|\bapor?\b/i, category: 'Rasistiskt språk' },
  { pattern: /\bfittstansen?\b|\bsandneger\b|\bkamelfösare?\b|\bturk\b|\bturkar\b|\bpolack\b|\bpolackar\b/i, category: 'Rasistiskt språk' },
  { pattern: /\bkines\b|\bkineser\b|\bgulingar?\b|\bfinne\b|\bfinnar\b|\bfinnjävel\b/i, category: 'Rasistiskt språk' },
  { pattern: /\bvitaskal\b|\bvitfigur\b|\bfärgling\b|\bsvart\b(?=\s*(person|människa|folk))/i, category: 'Rasistiskt språk' },

  // --- Gender / Sexuality ---
  { pattern: /\bsexuell läggning\b|\bhomosexuell\b|\bheterosexuell\b|\bbisexuell\b|\btranssexuell\b|\basexuell\b/i, category: 'Diskriminering pga sexuell läggning' },
  { pattern: /\bbög\b|\bbögig\b|\bbögar\b|\bbögarna\b|\bflata\b|\bflator\b|\bflatorna\b/i, category: 'Kränkande språk' },
  { pattern: /\btransa?\b|\btransor\b|\btrans\b|\bkönsidentitet\b|\bickebinär\b|\bnon-?binär\b/i, category: 'Kränkande språk' },
  { pattern: /\blesb\w*\b|\bgay\b|\bqueer\b|\bhbtq\w*\b/i, category: 'Diskriminering pga sexuell läggning' },
  { pattern: /\bmåste vara man\b|\bvara kvinna\b|\bvara man\b|\benbart män\b|\benbart kvinnor\b/i, category: 'Könsdiskriminering' },
  { pattern: /\binga män\b|\binga kvinnor\b|\bkön\b|\bkönet\b|\bkönstillhörighet\b/i, category: 'Könsdiskriminering' },
  { pattern: /\bmanlig\b|\bkvinnlig\b|\bmanligt\b|\bkvinnligt\b/i, category: 'Könsdiskriminering' },

  // --- Pregnancy / Parenthood ---
  { pattern: /\bgraviditet\b|\bgravid\b|\bbarnledig\b|\bföräldraledig\b|\bföräldraledighet\b/i, category: 'Diskriminering pga graviditet/föräldraskap' },
  { pattern: /\bmammaled\w*\b|\bpappaledig\b|\bpappaledighet\b|\bvab\b|\bsmåbarnsförälder\b/i, category: 'Diskriminering pga graviditet/föräldraskap' },
  { pattern: /\bbarnfri\b|\binga barn\b|\bhar barn\b|\bplanerar barn\b/i, category: 'Diskriminering pga föräldraskap' },

  // --- Age ---
  { pattern: /\bålder\b|\båldern\b|\båldersgräns\b|\bfödelseår\b|\bfödd\b/i, category: 'Åldersdiskriminering' },
  { pattern: /\bför gammal\b|\bför ung\b|\bmax \d+ år\b|\bmin \d+ år\b/i, category: 'Åldersdiskriminering' },
  { pattern: /\bung\b|\bunga\b|\bgammal\b|\bgamla\b|\bpensionär\b|\bpensionärer\b|\btonåring\b|\btonåringar\b/i, category: 'Åldersdiskriminering' },
  { pattern: /\bmedelålders\b|\bsenior\b|\bjunior\b(?!\s*(utvecklare|designer|konsult))/i, category: 'Åldersdiskriminering' },
  { pattern: /\bnyexaminerad\b|\bnyutexaminerad\b/i, category: 'Åldersdiskriminering' },

  // --- Disability ---
  { pattern: /\bhandikappad\b|\bhandikappade\b|\bhandikapp\b|\bfunktionshinder\b|\bfunktionsnedsättning\b/i, category: 'Diskriminering pga funktionsnedsättning' },
  { pattern: /\binvalid\b|\binvalider\b|\bcp-skadad\b|\brullstol\b|\brullstolsburen\b/i, category: 'Diskriminering pga funktionsnedsättning' },
  { pattern: /\bblind\b|\bdöv\b|\bstum\b|\bhörselskadad\b|\bsynskadad\b|\brörelsehindrad\b/i, category: 'Diskriminering pga funktionsnedsättning' },

  // --- Religion ---
  { pattern: /\bmuslim\b|\bmuslimer\b|\bislam\b|\bkristen\b|\bkristna\b|\bkristendom\b/i, category: 'Diskriminering pga religion' },
  { pattern: /\bjude\b|\bjudar\b|\bjudendom\b|\bjudisk\b|\bateist\b|\bateister\b/i, category: 'Diskriminering pga religion' },
  { pattern: /\bhijab\b|\bslöja\b|\bniqab\b|\bburka\b|\bturban\b|\bkippa\b/i, category: 'Diskriminering pga religion' },
  { pattern: /\bmoské\b|\bkyrka\b|\bsynagoga\b|\btempel\b|\breligiös\b|\breligiösa\b|\btro\b|\btrosuppfattning\b/i, category: 'Diskriminering pga religion' },
  { pattern: /\bbuddist\b|\bhindu\b|\bsikh\b|\bmormon\b|\bjehovas?\b/i, category: 'Diskriminering pga religion' },

  // --- Swedish Insults / Offensive (extensive) ---
  { pattern: /\bhora\b|\bhoror\b|\bhoran\b|\bhororna\b|\bslampa\b|\bslampor\b|\bslampan\b/i, category: 'Kränkande språk' },
  { pattern: /\bfitta\b|\bfittan\b|\bfittor\b|\bkäring\b|\bkärring\b|\bkärringar\b|\bluder\b|\bludder\b/i, category: 'Kränkande språk' },
  { pattern: /\bkuk\b|\bkuken\b|\bkukhuvud\b|\bpitt\b|\bröv\b|\bröven\b|\brövar\b|\brövhål\b/i, category: 'Kränkande språk' },
  { pattern: /\bdum\b|\bdumma\b|\bdumme\b|\bdummerjöns\b|\bdumbom\b/i, category: 'Kränkande språk' },
  { pattern: /\btaskig\b|\btaskiga\b|\btaskigt\b|\bidiot\b|\bidioter\b|\bidioten\b|\bidiotisk\b/i, category: 'Kränkande språk' },
  { pattern: /\bkorkad\b|\bkorkade\b|\bpucko\b|\btönt\b|\btöntar\b|\btöntig\b/i, category: 'Kränkande språk' },
  { pattern: /\bfånig\b|\bfåniga\b|\bfåne\b|\bfånar\b|\blåtsas\b/i, category: 'Kränkande språk' },
  { pattern: /\bjävel\b|\bjävla\b|\bjävlar\b|\bjävligt\b|\bfan\b|\bfasen\b|\bsatan\b/i, category: 'Kränkande språk' },
  { pattern: /\bskit\b|\bskitunge\b|\bskitstövel\b|\bskithög\b|\bskitsnack\b/i, category: 'Kränkande språk' },
  { pattern: /\bhorunge\b|\bhorsyster\b|\bjävlafitta\b|\bjävlaskit\b/i, category: 'Kränkande språk' },
  { pattern: /\bknull\b|\bknulla\b|\bknullad\b|\brunka\b|\brunkar\b/i, category: 'Kränkande språk' },
  { pattern: /\bcp\b|\bmongo\b|\bmongoloida?\b|\befter\w*bliven\b|\bmentalt sjuk\b/i, category: 'Kränkande språk' },
  { pattern: /\bpsykfall\b|\bpsyko\b|\bgalenskap\b|\bsinnessjuk\b|\btokig\b|\btokiga\b/i, category: 'Kränkande språk' },
  { pattern: /\bluffare?\b|\blögnare?\b|\bbedragare?\b|\bparasit\b|\bparasiter\b/i, category: 'Kränkande språk' },
  { pattern: /\bful\b|\bfula\b|\bfult\b|\btjock\b|\btjocka\b|\btjockt\b|\bfet\b|\bfeta\b|\bfett\b/i, category: 'Kränkande språk' },
  { pattern: /\bsmal\b|\bsmala\b|\bmager\b|\bmagra\b|\banorektisk\b|\bövervik\w*\b/i, category: 'Kränkande språk' },
  { pattern: /\bvärdelös\b|\bvärdelösa\b|\bonödig\b|\bonödiga\b|\binkompetent\b|\binkompetenta\b/i, category: 'Kränkande språk' },
  { pattern: /\bäcklig\b|\bäckliga\b|\bäckel\b|\bvidrigt?\b|\bmotbjudande\b/i, category: 'Kränkande språk' },
  { pattern: /\bhatad\b|\bhatade\b|\bhata\b|\bhatar\b|\bavsky\b|\bförakt\b/i, category: 'Kränkande språk' },
  { pattern: /\blat\b|\blata\b|\blatsas\b|\bslö\b|\bslöa\b|\bdålig\b|\bdåliga\b/i, category: 'Kränkande språk' },

  // --- Swedish — Appearance / Body ---
  { pattern: /\butseende\b|\butseendet\b|\bsnygg\b|\bsnygga\b|\battraktiv\b|\battraktiva\b/i, category: 'Diskriminering pga utseende' },
  { pattern: /\bvacker\b|\bvackra\b|\bsöt\b|\bsöta\b|\bläcker\b|\bläckra\b/i, category: 'Diskriminering pga utseende' },

  // --- Swedish — Political views ---
  { pattern: /\bpolitisk\b|\bpolitiska\b|\bpolitisk tillhörighet\b|\bpartitillhörighet\b/i, category: 'Diskriminering pga politisk åsikt' },
  { pattern: /\bsocialist\b|\bkommunist\b|\bnazist\b|\bfascist\b|\bhögerextrem\b|\bvänsterextrem\b/i, category: 'Diskriminering pga politisk åsikt' },

  // --- Swedish — Marital / Family status ---
  { pattern: /\bcivil ?stånd\b|\bogift\b|\bgift\b|\bskild\b|\bfrånskild\b|\bänka\b|\bänkling\b|\bsambo\b|\bensamstående\b/i, category: 'Diskriminering pga civilstånd' },

  // ╔══════════════════════════════════════════════════════════╗
  // ║  ENGLISH                                                 ║
  // ╚══════════════════════════════════════════════════════════╝

  // --- Race / Ethnicity ---
  { pattern: /\bnigg(?:er|a|as|ers|let)\b|\bcoon\b|\bcoons\b|\bspic\b|\bspics\b|\bwetback\b|\bwetbacks\b/i, category: 'Racist language' },
  { pattern: /\bgook\b|\bgooks\b|\bchink\b|\bchinks\b|\bjap\b|\bjaps\b|\bkike\b|\bkikes\b|\bwop\b|\bwops\b/i, category: 'Racist language' },
  { pattern: /\bdarkie\b|\bsandnigg\w*\b|\btowelhead\b|\braghead\b|\bcamel ?jockey\b/i, category: 'Racist language' },
  { pattern: /\bredskin\b|\bpaki\b|\bpakis\b|\bjungle ?bunny\b|\bporchmonkey\b/i, category: 'Racist language' },
  { pattern: /\bethnicity\b|\brace\b|\bracial\b|\bskin color\b|\bskin colour\b|\bnationality\b/i, category: 'Ethnic discrimination' },
  { pattern: /\bforeigner\b|\bforeigners\b|\bimmigrant\b|\bimmigrants\b|\balien\b|\baliens\b|\billegal\b/i, category: 'Ethnic discrimination' },
  { pattern: /\bwhite only\b|\bblacks? only\b|\bno blacks\b|\bno whites\b|\bno asians\b|\bno mexicans\b|\bno arabs\b/i, category: 'Racist language' },
  { pattern: /\bwhite suprema\w*\b|\bwhite power\b|\baryan\b|\bnazi\b|\bnazis\b|\bneonazi\b/i, category: 'Racist language' },

  // --- Gender / Sexuality ---
  { pattern: /\bfagg?ot\b|\bfagg?ots\b|\bdyke\b|\bdykes\b|\btranny\b|\btrannies\b|\bshemale\b/i, category: 'Offensive language' },
  { pattern: /\bsexual orientation\b|\bhomosexual\b|\bheterosexual\b|\bbisexual\b|\btransgender\b/i, category: 'Sexual orientation discrimination' },
  { pattern: /\bmales? only\b|\bfemales? only\b|\bno women\b|\bno men\b|\bmen only\b|\bwomen only\b/i, category: 'Gender discrimination' },
  { pattern: /\bgender\b|\bgender identity\b|\bsex\b(?=\s*(only|required|preferred))/i, category: 'Gender discrimination' },
  { pattern: /\blesbian\b|\blesbians\b|\bgay\b|\bgays\b|\bqueer\b|\bqueers\b|\blgbt\w*\b/i, category: 'Sexual orientation discrimination' },

  // --- Pregnancy ---
  { pattern: /\bpregnant\b|\bpregnancy\b|\bmaternity\b|\bpaternity leave\b|\bchild-?free\b|\bchildless\b/i, category: 'Pregnancy discrimination' },

  // --- Age ---
  { pattern: /\byoung\b|\byoung only\b|\bold\b|\btoo old\b|\btoo young\b|\bage limit\b|\bmax age\b|\bmin age\b/i, category: 'Age discrimination' },
  { pattern: /\bmillennial\b|\bmillennials\b|\bboomer\b|\bboomers\b|\bgen ?z\b|\belderly\b/i, category: 'Age discrimination' },

  // --- Disability ---
  { pattern: /\bdisabled\b|\bdisability\b|\bcripple\b|\bcrippled\b|\bhandicapped\b/i, category: 'Disability discrimination' },
  { pattern: /\bretard\b|\bretarded\b|\bretards\b|\bmentally ill\b|\bmental illness\b|\binsane\b|\bcrazy\b|\blunatic\b/i, category: 'Disability discrimination' },
  { pattern: /\bdeaf\b|\bblind\b|\bmute\b|\bwheelchair\b/i, category: 'Disability discrimination' },

  // --- Religion ---
  { pattern: /\breligion\b|\breligious\b|\bmuslim\b|\bmuslims\b|\bchristian\b|\bchristians\b/i, category: 'Religious discrimination' },
  { pattern: /\bjewish\b|\bjews\b|\batheist\b|\batheists\b|\bhijab\b|\bmosque\b|\bchurch\b|\bsynagogue\b/i, category: 'Religious discrimination' },
  { pattern: /\bbuddhist\b|\bhindu\b|\bsikh\b|\bmormon\b|\bjehovah\b|\bscientolog\w*\b/i, category: 'Religious discrimination' },

  // --- English Insults / Offensive (extensive) ---
  { pattern: /\bbitch\b|\bbitches\b|\bwhore\b|\bwhores\b|\bslut\b|\bsluts\b|\bcunt\b|\bcunts\b/i, category: 'Offensive language' },
  { pattern: /\bdick\b|\bdicks\b|\bdickhead\b|\basshole\b|\bassholes\b|\bbastard\b|\bbastards\b/i, category: 'Offensive language' },
  { pattern: /\bfuck\b|\bfucking\b|\bfucked\b|\bfucker\b|\bfuckers\b|\bmotherfuck\w*\b/i, category: 'Offensive language' },
  { pattern: /\bshit\b|\bshitty\b|\bshithead\b|\bbullshit\b|\bhorseshit\b|\bdamn\b|\bdamned\b/i, category: 'Offensive language' },
  { pattern: /\bstupid\b|\bidiot\b|\bidiots\b|\bidiotic\b|\bmoron\b|\bmorons\b|\bmoronic\b/i, category: 'Offensive language' },
  { pattern: /\bdumb\b|\bdumbass\b|\bimbecile\b|\bcretin\b|\bincompetent\b|\buseless\b|\bpathetic\b/i, category: 'Offensive language' },
  { pattern: /\bugly\b|\bfat\b|\bfatty\b|\bskinny\b|\bobese\b|\banorexic\b|\boverweight\b|\bunattractive\b/i, category: 'Offensive language' },
  { pattern: /\bloser\b|\blosers\b|\bworthless\b|\btrash\b|\bgarbage\b|\bscum\b|\bscumbag\b/i, category: 'Offensive language' },
  { pattern: /\blazy\b|\bstupidity\b|\bignorant\b|\bignorance\b|\bdisgust\w*\b/i, category: 'Offensive language' },
  { pattern: /\bhate\b|\bhated\b|\bhater\b|\bhaters\b|\bhateful\b|\bdespise\b/i, category: 'Offensive language' },
  { pattern: /\bpussy\b|\bpussies\b|\bwanker\b|\bwankers\b|\btosser\b|\btossers\b|\btwat\b|\btwats\b/i, category: 'Offensive language' },
  { pattern: /\bprick\b|\bpricks\b|\bbollocks\b|\bknob\b|\bknobhead\b|\bbellend\b/i, category: 'Offensive language' },

  // --- English — Appearance / Body ---
  { pattern: /\battractiveness\b|\bappearance\b|\blooks\b|\bhot\b(?=\s*(only|required|preferred))/i, category: 'Appearance discrimination' },
  { pattern: /\bbeautiful\b|\bhandsome\b|\bpretty\b|\bgood.?looking\b/i, category: 'Appearance discrimination' },

  // --- English — Marital / Family status ---
  { pattern: /\bmarital status\b|\bmarried\b|\bsingle\b|\bdivorced\b|\bwidow\b|\bwidower\b/i, category: 'Marital status discrimination' },

  // --- English — Political views ---
  { pattern: /\bpolitical\b|\bpolitical views\b|\brepublican\b|\bdemocrat\b|\bconservative\b|\bliberal\b/i, category: 'Political discrimination' },
];

// Common filler/nonsense words that aren't real criteria
const FILLER_WORDS = new Set([
  'hej', 'hå', 'ja', 'nej', 'test', 'asdf', 'qwerty', 'abc', 'xyz',
  'foo', 'bar', 'baz', 'blah', 'bla', 'lol', 'haha', 'ok', 'okej',
  'hmm', 'aha', 'öhh', 'ehh', 'aaa', 'bbb', 'ccc', 'ddd',
  'hallå', 'tja', 'tjo', 'hey', 'yo', 'yep', 'nope', 'nä',
]);

// Small set of common Swedish words that ARE real (to avoid false positives)
const COMMON_SWEDISH_WORDS = new Set([
  'har', 'kan', 'ska', 'bör', 'med', 'och', 'att', 'för', 'den', 'det',
  'ett', 'som', 'var', 'vid', 'till', 'från', 'eller', 'inte', 'över',
  'under', 'mellan', 'inom', 'samt', 'utan', 'efter', 'genom', 'hos',
  'mot', 'per', 'vid', 'minst', 'års', 'erfarenhet', 'kunskap',
  'körkort', 'arbeta', 'jobba', 'arbete', 'jobb', 'svenska', 'engelska',
  'skriftligt', 'muntligt', 'god', 'goda', 'bra', 'stark', 'starka',
  'relevant', 'dokumenterad', 'kompetens', 'utbildning', 'behörighet',
  'certifiering', 'truckkort', 'hygienpass', 'legitimation',
]);

/**
 * Check if a single word looks like gibberish (not a real word).
 * Uses vowel ratio, consonant clusters, and a known-word allowlist.
 */
function isGibberishWord(word: string): boolean {
  if (word.length <= 2) return false; // Too short to judge
  
  // If it's a known common word, it's not gibberish
  if (COMMON_SWEDISH_WORDS.has(word.toLowerCase())) return false;
  
  const vowels = word.match(/[aeiouåäöy]/gi) || [];
  const vowelRatio = vowels.length / word.length;
  
  // Real words typically have 25-70% vowels. Below 20% in 3+ char word = suspicious
  if (word.length >= 3 && vowelRatio < 0.2) return true;
  
  // Check for 3+ consecutive consonants (uncommon in Swedish, very common in gibberish)
  // Exception: common Swedish clusters like "str", "skr", "spr"
  const stripped = word.toLowerCase().replace(/^(str|skr|spr|sch)/, '');
  if (/[^aeiouåäöy]{3,}/i.test(stripped)) return true;
  
  // Check for unlikely character sequences (double+ uncommon consonants)
  if (/([qwxz]){1,}|([^aeiouåäöy])\2{2,}/i.test(word)) return true;
  
  return false;
}

/**
 * Check if text is gibberish or meaningless input.
 * Multi-layered: pattern checks → word-level gibberish detection → filler word detection.
 */
export function checkInputQuality(text: string): { isValid: boolean; reason?: string } {
  const trimmed = text.trim();
  
  // Empty is ok (handled elsewhere as required field)
  if (trimmed.length === 0) return { isValid: true };

  // Must be at least 3 characters
  if (trimmed.length < 3) {
    return { isValid: false, reason: 'Skriv ett tydligt kriterium.' };
  }

  // Check for repeated single character (e.g. "jjjjjj", "aaaa")
  if (/^(.)\1+$/i.test(trimmed)) {
    return { isValid: false, reason: 'Skriv ett riktigt kriterium.' };
  }

  // Check for random character spam — no vowels in 5+ chars
  if (trimmed.length >= 5 && !/[aeiouåäöy\s]/i.test(trimmed)) {
    return { isValid: false, reason: 'Skriv ett meningsfullt kriterium.' };
  }

  // Check if it's just the same short pattern repeated (e.g. "abab", "jkjkjk")
  if (trimmed.length >= 4) {
    for (let len = 1; len <= 3; len++) {
      const pattern = trimmed.slice(0, len);
      const repeated = pattern.repeat(Math.ceil(trimmed.length / len)).slice(0, trimmed.length);
      if (repeated.toLowerCase() === trimmed.toLowerCase()) {
        return { isValid: false, reason: 'Skriv ett riktigt kriterium.' };
      }
    }
  }

  const words = trimmed.toLowerCase().split(/\s+/).filter(w => w.length > 0);

  // Check if ALL words are filler/nonsense words
  if (words.length > 0 && words.every(w => FILLER_WORDS.has(w))) {
    return { isValid: false, reason: 'Skriv ett tydligt urvalskriterium.' };
  }

  // Check if it's the same word repeated
  if (words.length >= 2) {
    const uniqueWords = new Set(words);
    if (uniqueWords.size === 1) {
      return { isValid: false, reason: 'Skriv ett riktigt kriterium.' };
    }
  }

  // Word-level gibberish detection — ANY gibberish word flags the input
  // (one real word + gibberish = still not a valid criterion)
  if (words.length >= 1) {
    const gibberishWords = words.filter(w => w.length >= 3 && isGibberishWord(w));
    if (gibberishWords.length > 0) {
      return { isValid: false, reason: 'Formulera ett tydligt krav utan oläsbara ord.' };
    }
  }

  // Too short to be a meaningful criterion (single short word like "ab")
  if (trimmed.length < 3) {
    return { isValid: false, reason: 'Skriv ett tydligt kriterium.' };
  }

  // Single word is OK if it's a real word (not gibberish, not filler)
  // AI will interpret it broadly — e.g. "körkort" → check all driving licenses

  return { isValid: true };
}

/**
 * Fast client-side check for obvious discrimination patterns.
 * Catches only the most blatant cases — backend AI handles nuanced detection.
 */
export function checkForDiscrimination(text: string): { isDiscriminatory: boolean; reason?: string } {
  for (const { pattern, category } of OBVIOUS_DISCRIMINATION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isDiscriminatory: true,
        reason: `${category} — kriterier ska baseras på kompetens.`,
      };
    }
  }
  return { isDiscriminatory: false };
}

/**
 * Backend AI-powered discrimination check.
 * Uses the evaluate-candidate edge function with action=validate_criterion.
 * Returns { isDiscriminatory, reason } — falls back to allowing if AI is unavailable.
 */
export async function checkDiscriminationWithAI(
  title: string,
  prompt: string
): Promise<{ isDiscriminatory: boolean; reason?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('evaluate-candidate', {
      body: { action: 'validate_criterion', title, prompt },
    });

    if (error) {
      console.warn('AI discrimination check failed (allowing):', error);
      return { isDiscriminatory: false };
    }

    return {
      isDiscriminatory: data?.isDiscriminatory === true,
      reason: data?.reason || undefined,
    };
  } catch (err) {
    console.warn('AI discrimination check error (allowing):', err);
    return { isDiscriminatory: false };
  }
}
