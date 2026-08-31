import { describe, expect, it } from 'vitest';
import { sanitizeRichTextHtml } from '@/lib/sanitizeRichText';

describe('sanitizeRichTextHtml', () => {
  it('preserves normal notes formatting', () => {
    expect(sanitizeRichTextHtml('<p><strong>Hej</strong> världen</p>')).toBe(
      '<p><strong>Hej</strong> världen</p>',
    );
  });

  it('removes scripts, event handlers and scriptable URLs', () => {
    const sanitized = sanitizeRichTextHtml(
      '<img src="x" onerror="globalThis.pwned=1"><script>globalThis.pwned=1</script><a href="javascript:alert(1)">länk</a>',
    );

    expect(sanitized).not.toMatch(/onerror|script|javascript:/i);
    expect(sanitized).toContain('länk');
  });
});
