/**
 * RED → GREEN: viewport-metataggen får inte blockera zoom.
 * `maximum-scale=1.0` och `user-scalable=no` gör att användare med nedsatt syn
 * inte kan zooma (WCAG 1.4.4). Övriga direktiv ska vara oförändrade.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

const viewportContent = (() => {
  const match = html.match(/<meta\s+name="viewport"\s+content="([^"]*)"/i);
  return match?.[1] ?? '';
})();

const directives = viewportContent
  .split(',')
  .map((part) => part.trim().toLowerCase())
  .filter(Boolean);

describe('index.html viewport', () => {
  it('har exakt en viewport-metatagg', () => {
    const all = html.match(/<meta\s+name="viewport"/gi) ?? [];
    expect(all).toHaveLength(1);
    expect(viewportContent).not.toBe('');
  });

  it('blockerar inte zoom: ingen maximum-scale och ingen user-scalable', () => {
    expect(directives.some((d) => d.startsWith('maximum-scale'))).toBe(false);
    expect(directives.some((d) => d.startsWith('user-scalable'))).toBe(false);
  });

  it('behåller width=device-width, initial-scale=1.0 och viewport-fit=cover', () => {
    expect(directives).toContain('width=device-width');
    expect(directives).toContain('initial-scale=1.0');
    expect(directives).toContain('viewport-fit=cover');
  });
});
