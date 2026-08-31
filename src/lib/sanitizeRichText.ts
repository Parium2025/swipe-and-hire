import DOMPurify from 'dompurify';

/**
 * Notes are rich HTML, but server content must never reach an HTML sink
 * without an allow-list sanitizer. DOMPurify keeps normal editor formatting
 * while removing scriptable elements, event handlers and dangerous URLs.
 */
export function sanitizeRichTextHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
}
