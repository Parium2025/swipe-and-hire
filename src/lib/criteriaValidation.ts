import { supabase } from '@/integrations/supabase/client';

// Client-side quick check — lightweight heuristic only
// Real discrimination detection is done by AI on the backend
const OBVIOUS_DISCRIMINATION_PATTERNS = [
  // === SWEDISH — Ethnicity / Race ===
  { pattern: /\betnicitet\b|\bras\b|\bhudfärg\b|\binvandrare?\b|\butlänning\b|\butlänningar\b|\binvandrar\w*/i, category: 'Etnisk diskriminering' },
  { pattern: /\bsvenne\b|\bblansen\b|\bneger\b|\bnegrer\b|\bsvartskalle\b|\bblatte\b|\bblattar\b|\bzigenare?\b|\bromer\b/i, category: 'Rasistiskt språk' },
  { pattern: /\bapor?\b|\babor?\b|\bbabbe?\b|\bkanake?\b/i, category: 'Rasistiskt språk' },

  // === SWEDISH — Gender / Sexuality ===
  { pattern: /\bsexuell läggning\b|\bhomosexuell\b|\bheterosexuell\b|\bbisexuell\b|\btranssexuell\b/i, category: 'Diskriminering pga sexuell läggning' },
  { pattern: /\bbög\b|\bbögig\b|\bbögar\b|\bflata\b|\bflator\b|\btransa?\b|\btrans\b/i, category: 'Kränkande språk' },
  { pattern: /\bmåste vara man\b|\bvara kvinna\b|\bvara man\b|\benbart män\b|\benbart kvinnor\b|\binga män\b|\binga kvinnor\b|\bkön\b/i, category: 'Könsdiskriminering' },

  // === SWEDISH — Pregnancy ===
  { pattern: /\bgraviditet\b|\bgravid\b|\bbarnledig\b|\bföräldraledig\b|\bmammaled\w*\b|\bpappaledig\b/i, category: 'Diskriminering pga graviditet/föräldraskap' },

  // === SWEDISH — Age ===
  { pattern: /\bålder\b|\bför gammal\b|\bför ung\b|\bmax \d+ år\b|\bung\b|\bunga\b|\bgammal\b|\bgamla\b|\bpensionär\b|\btonåring\b/i, category: 'Åldersdiskriminering' },

  // === SWEDISH — Disability ===
  { pattern: /\bhandikappad\b|\bhandikapp\b|\bfunktionshinder\b|\bfunktionsnedsättning\b|\binvalid\b|\bcp-skadad\b/i, category: 'Diskriminering pga funktionsnedsättning' },

  // === SWEDISH — Religion ===
  { pattern: /\bmuslim\b|\bkristen\b|\bjude\b|\bjudar\b|\breligion\b|\bateist\b|\bhijab\b|\bslöja\b|\bmoské\b|\bkyrka\b|\bsynagoga\b/i, category: 'Diskriminering pga religion' },

  // === SWEDISH — Insults / Offensive ===
  { pattern: /\bhora\b|\bhoror\b|\bslampa\b|\bslampor\b|\bfitta\b|\bkäring\b|\bkärring\b|\bluder\b/i, category: 'Kränkande språk' },
  { pattern: /\bdum\b|\bdumma\b|\btaskig\b|\btaskiga\b|\bidiot\b|\bidioter\b|\bkorkad\b|\bpucko\b|\btönt\b|\bfånig\b|\bfåniga\b/i, category: 'Kränkande språk' },
  { pattern: /\bjävel\b|\bjävla\b|\bfan\b|\bskit\b|\bskitunge\b|\bhorunge\b|\bkukhuvud\b|\bknull\b/i, category: 'Kränkande språk' },
  { pattern: /\bcp\b|\bmongo\b|\bmongoloida?\b|\befter\w*bliven\b|\bmentalt sjuk\b/i, category: 'Kränkande språk' },

  // === ENGLISH — Race / Ethnicity ===
  { pattern: /\bnigg(?:er|a|as|ers)\b|\bcoon\b|\bspic\b|\bwetback\b|\bgook\b|\bchink\b|\bjap\b|\bkike\b|\bwop\b/i, category: 'Racist language' },
  { pattern: /\bethnicity\b|\brace\b|\bskin color\b|\bskin colour\b|\bforeigner\b|\bimmigrant\b|\balien\b/i, category: 'Ethnic discrimination' },
  { pattern: /\bwhite only\b|\bblacks? only\b|\bno blacks\b|\bno whites\b|\bno asians\b|\bno mexicans\b/i, category: 'Racist language' },

  // === ENGLISH — Gender / Sexuality ===
  { pattern: /\bfagg?ot\b|\bdyke\b|\btranny\b|\bshemale\b|\bqueer\b/i, category: 'Offensive language' },
  { pattern: /\bsexual orientation\b|\bhomosexual\b|\bheterosexual\b|\bbisexual\b|\btransgender\b/i, category: 'Sexual orientation discrimination' },
  { pattern: /\bmales? only\b|\bfemales? only\b|\bno women\b|\bno men\b|\bmen only\b|\bwomen only\b|\bgender\b/i, category: 'Gender discrimination' },

  // === ENGLISH — Pregnancy ===
  { pattern: /\bpregnant\b|\bpregnancy\b|\bmaternity\b|\bpaternity leave\b/i, category: 'Pregnancy discrimination' },

  // === ENGLISH — Age ===
  { pattern: /\byoung\b|\byoung only\b|\bold\b|\btoo old\b|\btoo young\b|\bage limit\b|\bmax age\b|\bmin age\b|\bmillennial\b|\bboomer\b/i, category: 'Age discrimination' },

  // === ENGLISH — Disability ===
  { pattern: /\bdisabled\b|\bdisability\b|\bcripple\b|\bhandicapped\b|\bretard\b|\bretarded\b|\bmentally ill\b/i, category: 'Disability discrimination' },

  // === ENGLISH — Religion ===
  { pattern: /\breligion\b|\bmuslim\b|\bchristian\b|\bjewish\b|\batheist\b|\bhijab\b|\bmosque\b|\bchurch\b|\bsynagogue\b/i, category: 'Religious discrimination' },

  // === ENGLISH — Insults / Offensive ===
  { pattern: /\bbitch\b|\bwhore\b|\bslut\b|\bcunt\b|\bdick\b|\basshole\b|\bbastard\b|\bfuck\b|\bfucking\b|\bshit\b|\bdamn\b/i, category: 'Offensive language' },
  { pattern: /\bstupid\b|\bidiot\b|\bmoron\b|\bdumb\b|\bimbecile\b|\bcretin\b|\bincompetent\b|\buseless\b|\bpathetic\b/i, category: 'Offensive language' },
  { pattern: /\bugly\b|\bfat\b|\bskinny\b|\bobese\b|\banorexic\b/i, category: 'Offensive language' },
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

  // Too short to be a meaningful criterion
  if (trimmed.length < 5) {
    return { isValid: false, reason: 'Skriv ett tydligt kriterium.' };
  }

  // Minimum word count — a real AI instruction needs at least 2 words
  if (words.length < 2) {
    return { isValid: false, reason: 'Beskriv tydligare vad AI:n ska leta efter.' };
  }

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
