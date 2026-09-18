/**
 * React 18 (18.3.x) does not recognise the camelCase `fetchPriority` prop and
 * logs a DOM-attribute warning for every element that uses it. The HTML
 * attribute itself is fully supported by Chrome/Edge/Safari — only React's
 * prop whitelist is behind (it lands natively in React 19).
 *
 * This helper emits the correct lowercase `fetchpriority` attribute, so the
 * browser still gets the loading hint while the console stays clean.
 *
 * Usage:
 *   <img {...fetchPriority('high')} />
 *   <img {...fetchPriority(isVisible ? 'high' : 'auto')} />
 */
export type FetchPriority = 'high' | 'low' | 'auto';

export function fetchPriority(value: FetchPriority): Record<string, string> {
  return { fetchpriority: value };
}
