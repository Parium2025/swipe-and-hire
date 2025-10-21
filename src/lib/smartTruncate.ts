/**
 * Smartly truncates text at natural breaking points (prepositions, conjunctions, etc.)
 * instead of cutting mid-word or mid-sentence.
 * 
 * @param text - The text to truncate
 * @param maxLength - Maximum character length (approximate)
 * @returns Truncated text with "..." if shortened, or original text
 */
export function smartTruncate(text: string, maxLength: number = 50): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  // Common Swedish prepositions and conjunctions that are good breaking points
  const breakWords = [
    ' i ', ' på ', ' vid ', ' inom ', ' till ', ' från ', ' med ', ' utan ',
    ' under ', ' över ', ' genom ', ' för ', ' av ', ' åt ', ' om ', ' hos ',
    ' mot ', ' ur ', ' efter ', ' före ', ' sedan ', ' bakom ', ' framför ',
    ' mellan ', ' bland ', ' omkring ', ' kring ', ' och ', ' eller ', ' men ',
    ' - ', ' – '
  ];

  // Find all potential break points within maxLength
  let bestBreakIndex = -1;
  let bestBreakWord = '';
  
  for (const breakWord of breakWords) {
    const index = text.lastIndexOf(breakWord, maxLength);
    if (index > bestBreakIndex && index > maxLength * 0.6) {
      // Only break if we're at least 60% through the max length
      bestBreakIndex = index;
      bestBreakWord = breakWord;
    }
  }

  if (bestBreakIndex > 0) {
    // Truncate at the break point (include the break word but trim)
    return text.substring(0, bestBreakIndex + bestBreakWord.length).trim();
  }

  // Fallback: if no good break point found, cut at last space before maxLength
  const lastSpace = text.lastIndexOf(' ', maxLength);
  if (lastSpace > maxLength * 0.7) {
    return text.substring(0, lastSpace).trim();
  }

  // Last resort: hard cut at maxLength
  return text.substring(0, maxLength).trim() + '...';
}
