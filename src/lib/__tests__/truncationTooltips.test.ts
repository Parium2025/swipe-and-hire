import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { isTextTruncated, useTruncationTooltip } from '@/hooks/useTruncationTooltip';

const SRC = resolve(process.cwd(), 'src');

const walk = (dir: string): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (entry.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
};

/**
 * En tooltip över kapad text måste öppnas enligt faktisk overflowmätning,
 * inte alltid. Tillåtna former: `open={...}` på själva `<Tooltip>`-taggen
 * (hook som mäter) eller att texten ritas av `<TruncatedText>`, som redan
 * har en trunceringsmedveten tooltip.
 */
const findUngatedTooltips = (source: string, file: string): string[] => {
  const violations: string[] = [];
  const opener = /<Tooltip[\s>]/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(source))) {
    const start = match.index;
    const end = source.indexOf('</Tooltip>', start);
    if (end === -1) continue;
    const block = source.slice(start, end);
    const openTag = block.slice(0, block.indexOf('>'));
    if (!/\btruncate\b|line-clamp-\d/.test(block)) continue;
    if (/\bopen=\{/.test(openTag)) continue;
    if (block.includes('<TruncatedText')) continue;
    violations.push(`${relative(SRC, file)}:${source.slice(0, start).split('\n').length}`);
  }
  return violations;
};

describe('tooltips on truncated text', () => {
  it('is never shown unconditionally over clipped text', () => {
    const violations: string[] = [];
    for (const file of walk(SRC)) {
      if (file.includes(`${join('src', 'components', 'ui')}`)) continue;
      violations.push(...findUngatedTooltips(readFileSync(file, 'utf8'), file));
    }
    expect(violations).toEqual([]);
  });

  it('stays closed when the text fits', () => {
    const { result } = renderHook(() => useTruncationTooltip(() => false));
    act(() => result.current.onOpenChange(true));
    expect(result.current.open).toBe(false);
  });

  it('opens only when the text is actually clipped', () => {
    const { result } = renderHook(() => useTruncationTooltip(() => true));
    act(() => result.current.onOpenChange(true));
    expect(result.current.open).toBe(true);
    act(() => result.current.onOpenChange(false));
    expect(result.current.open).toBe(false);
  });

  it('measures nothing without an element', () => {
    expect(isTextTruncated(null)).toBe(false);
  });
});
