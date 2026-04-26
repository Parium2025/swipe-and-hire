import type { CSSProperties } from 'react';

export const DEFAULT_JOB_OVERLAY_TEXT_COLOR = '#FFFFFF';

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export function normalizeJobOverlayTextColor(value?: string | null): string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value)
    ? value
    : DEFAULT_JOB_OVERLAY_TEXT_COLOR;
}

export function getJobOverlayTextStyle(value?: string | null): CSSProperties {
  return {
    color: normalizeJobOverlayTextColor(value),
    textShadow: 'none',
  };
}