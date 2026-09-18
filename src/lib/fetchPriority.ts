/**
 * React 19 stöder prioriteringshinten natively som camelCase-propen
 * `fetchPriority`. Den gamla lowercase-varianten ger en DOM-varning i konsolen
 * och sätts inte på elementet, så helpern returnerar camelCase.
 *
 * Usage:
 *   <img {...fetchPriority('high')} />
 *   <img {...fetchPriority(isVisible ? 'high' : 'auto')} />
 */
export type FetchPriority = 'high' | 'low' | 'auto';

export function fetchPriority(value: FetchPriority): Record<string, string> {
  return { fetchPriority: value };
}
