import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('boot loop guards', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

  it('begränsar automatisk boot-omladdning till ett försök', () => {
    expect(html).toContain('var maxAutomaticReloads = 1;');
    expect(html).toContain('if (attempts > maxAutomaticReloads)');
    expect(html).not.toContain("setTimeout(function() { if (!isBooted()) hardReload(); }, 30000)");
  });

  it('godkänner endast lyckade nätprober', () => {
    expect(html).toContain('.then(function(r) { return r.ok; })');
    expect(html).not.toContain('.then(function(r) { return !!r; })');
  });
});