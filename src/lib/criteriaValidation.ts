import { supabase } from '@/integrations/supabase/client';

// Client-side quick check — lightweight heuristic only
// Real discrimination detection is done by AI on the backend
const OBVIOUS_DISCRIMINATION_PATTERNS = [
  { pattern: /\betnicitet\b|\bras\b|\bhudfärg\b/i, category: 'Etnisk diskriminering' },
  { pattern: /\bsexuell läggning\b|\bhomosexuell\b|\bheterosexuell\b|\bbisexuell\b/i, category: 'Diskriminering pga sexuell läggning' },
  { pattern: /\bgraviditet\b|\bgravid\b/i, category: 'Diskriminering pga graviditet' },
];

// Common filler/nonsense words that aren't real criteria
const FILLER_WORDS = new Set([
  'hej', 'hå', 'ja', 'nej', 'test', 'asdf', 'qwerty', 'abc', 'xyz',
  'foo', 'bar', 'baz', 'blah', 'bla', 'lol', 'haha', 'ok', 'okej',
  'hmm', 'aha', 'öhh', 'ehh', 'aaa', 'bbb', 'ccc', 'ddd',
  'hallå', 'tja', 'tjo', 'hey', 'yo', 'yep', 'nope', 'nä',
]);

/**
 * Check if a single word looks like gibberish (not a real word).
 * Real Swedish/English words have a mix of consonants and vowels.
 * Words like "ghgygttfdhf" have extremely low vowel ratios.
 */
function isGibberishWord(word: string): boolean {
  if (word.length <= 2) return false; // Too short to judge
  
  const vowels = word.match(/[aeiouåäöy]/gi) || [];
  const vowelRatio = vowels.length / word.length;
  
  // Real words typically have 25-70% vowels. Below 15% in 4+ char word = gibberish
  if (word.length >= 4 && vowelRatio < 0.15) return true;
  
  // Check for 4+ consecutive consonants (rare in real words, common in gibberish)
  if (/[^aeiouåäöy\s]{4,}/i.test(word)) return true;
  
  return false;
}

/**
 * Check if text is gibberish or meaningless input.
 * Catches repeated characters, random key mashing, filler words, too-short text, etc.
 */
export function checkInputQuality(text: string): { isValid: boolean; reason?: string } {
  const trimmed = text.trim();
  
  // Empty is ok (handled elsewhere as required field)
  if (trimmed.length === 0) return { isValid: true };

  // Must be at least 3 characters
  if (trimmed.length < 3) {
    return { isValid: false, reason: 'Texten är för kort — skriv ett tydligt kriterium.' };
  }

  // Check for repeated single character (e.g. "jjjjjj", "aaaa")
  if (/^(.)\1+$/i.test(trimmed)) {
    return { isValid: false, reason: 'Texten verkar inte vara ett riktigt kriterium.' };
  }

  // Check for random character spam — no vowels in 5+ chars (e.g. "jkjkjk", "qwrtp")
  if (trimmed.length >= 5 && !/[aeiouåäöy\s]/i.test(trimmed)) {
    return { isValid: false, reason: 'Texten verkar inte vara meningsfull.' };
  }

  // Check if it's just the same short pattern repeated (e.g. "abab", "jkjkjk")
  if (trimmed.length >= 4) {
    for (let len = 1; len <= 3; len++) {
      const pattern = trimmed.slice(0, len);
      const repeated = pattern.repeat(Math.ceil(trimmed.length / len)).slice(0, trimmed.length);
      if (repeated.toLowerCase() === trimmed.toLowerCase()) {
        return { isValid: false, reason: 'Texten verkar inte vara ett riktigt kriterium.' };
      }
    }
  }

  // Check if ALL words are filler/nonsense words
  const words = trimmed.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length > 0 && words.every(w => FILLER_WORDS.has(w))) {
    return { isValid: false, reason: 'Skriv ett tydligt och specifikt urvalskriterium.' };
  }

  // Check if it's the same word repeated (e.g. "ja ja ja", "test test test")
  if (words.length >= 2) {
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    if (uniqueWords.size === 1) {
      return { isValid: false, reason: 'Texten verkar inte vara ett riktigt kriterium.' };
    }
  }

  // Check if majority of words are gibberish (e.g. "har ghgygttfdhf h")
  if (words.length >= 2) {
    const gibberishCount = words.filter(w => isGibberishWord(w)).length;
    const gibberishRatio = gibberishCount / words.length;
    // If more than half the words are gibberish, flag it
    if (gibberishRatio > 0.5) {
      return { isValid: false, reason: 'AI-instruktionen verkar inte vara meningsfull — formulera ett tydligt krav.' };
    }
  }
  
  // Single gibberish word that's long enough to judge
  if (words.length === 1 && words[0].length >= 5 && isGibberishWord(words[0])) {
    return { isValid: false, reason: 'Texten verkar inte vara meningsfull.' };
  }

  // Too short to be a meaningful criterion (less than 5 chars after trim)
  if (trimmed.length < 5) {
    return { isValid: false, reason: 'Kriteriet är för kort — beskriv tydligare vad du söker.' };
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
