import { supabase } from '@/integrations/supabase/client';

// Client-side quick check — lightweight heuristic only
// Real discrimination detection is done by AI on the backend
const OBVIOUS_DISCRIMINATION_PATTERNS = [
  { pattern: /\betnicitet\b|\bras\b|\bhudfärg\b/i, category: 'Etnisk diskriminering' },
  { pattern: /\bsexuell läggning\b|\bhomosexuell\b|\bheterosexuell\b|\bbisexuell\b/i, category: 'Diskriminering pga sexuell läggning' },
  { pattern: /\bgraviditet\b|\bgravid\b/i, category: 'Diskriminering pga graviditet' },
];

/**
 * Check if text is gibberish or meaningless input.
 * Catches repeated characters, random key mashing, too-short text, etc.
 */
export function checkInputQuality(text: string): { isValid: boolean; reason?: string } {
  const trimmed = text.trim();
  
  // Must be at least 3 characters
  if (trimmed.length > 0 && trimmed.length < 3) {
    return { isValid: false, reason: 'Texten är för kort — skriv ett tydligt kriterium.' };
  }

  // Check for repeated single character (e.g. "jjjjjj", "aaaa")
  if (trimmed.length >= 3 && /^(.)\1+$/i.test(trimmed)) {
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
