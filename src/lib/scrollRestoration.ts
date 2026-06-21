/** Pure utility functions for scroll-position persistence. */

const SCROLL_STORAGE_KEY = 'parium-scroll-positions';
const PENDING_FOOTER_RESTORE_KEY = 'parium-pending-footer-restore';
const LATEST_FOOTER_NAVIGATION_KEY = 'parium-latest-footer-navigation';

export const RESTORE_TOLERANCE_PX = 2;
export const REQUIRED_STABLE_FRAMES = 2;
export const SCROLL_HEIGHT_TOLERANCE_PX = 32;
export const MAX_WAIT_MS = 3000;

export interface ScrollPosition {
  top: number;
  anchorId?: string;
  anchorOffset?: number;
  scrollHeight?: number;
  restoreSource?: 'footer';
  restoreTargetPath?: string;
  restoreSavedAt?: number;
}

// ---------------------------------------------------------------------------
// Scroll container
// ---------------------------------------------------------------------------

export const getManagedScrollContainer = (): HTMLElement | null =>
  document.querySelector('[data-main-scroll-container="true"]');

export const getRestorableScrollContainer = (): HTMLElement | null =>
  getManagedScrollContainer()
  ?? document.querySelector<HTMLElement>('[data-landing-scroll-root]')
  ?? (document.scrollingElement as HTMLElement | null)
  ?? document.documentElement;

// ---------------------------------------------------------------------------
// Session-storage read / write with defensive parsing
// ---------------------------------------------------------------------------

const normalizePosition = (value: unknown): ScrollPosition | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { top: value };
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<ScrollPosition>;
  if (typeof candidate.top !== 'number' || !Number.isFinite(candidate.top)) {
    return null;
  }

  return {
    top: candidate.top,
    anchorId: typeof candidate.anchorId === 'string' ? candidate.anchorId : undefined,
    anchorOffset: typeof candidate.anchorOffset === 'number' ? candidate.anchorOffset : undefined,
    scrollHeight: typeof candidate.scrollHeight === 'number' ? candidate.scrollHeight : undefined,
    restoreSource: candidate.restoreSource === 'footer' ? 'footer' : undefined,
    restoreTargetPath: typeof candidate.restoreTargetPath === 'string' ? candidate.restoreTargetPath : undefined,
    restoreSavedAt: typeof candidate.restoreSavedAt === 'number' ? candidate.restoreSavedAt : undefined,
  };
};

export const readPositions = (): Record<string, ScrollPosition> => {
  try {
    const raw = sessionStorage.getItem(SCROLL_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      try { sessionStorage.removeItem(SCROLL_STORAGE_KEY); } catch { /* ignore */ }
      return {};
    }
    return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, ScrollPosition>>((acc, [pathname, value]) => {
      const normalized = normalizePosition(value);
      if (normalized) {
        acc[pathname] = normalized;
      }
      return acc;
    }, {});
  } catch {
    try { sessionStorage.removeItem(SCROLL_STORAGE_KEY); } catch { /* ignore */ }
    return {};
  }
};

export const writePositions = (positions: Record<string, ScrollPosition>) => {
  try {
    sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // quota exceeded — silently ignore
  }
};

/**
 * Synchronously snapshot the current scroll position for `pathname`.
 * Use this on pointerdown of links/cards so we never lose the exact
 * position to a missed rAF when the user clicks fast.
 */
export const saveScrollNow = (
  pathname: string,
  options?: { restoreSource?: 'footer'; restoreTargetPath?: string },
) => {
  const container = getRestorableScrollContainer();
  if (!container) return;
  const positions = readPositions();
  const anchor = getAnchorSnapshot(container);
  positions[pathname] = {
    top: container.scrollTop,
    anchorId: anchor?.anchorId,
    anchorOffset: anchor?.anchorOffset,
    scrollHeight: container.scrollHeight,
    restoreSource: options?.restoreSource,
    restoreTargetPath: options?.restoreTargetPath,
    restoreSavedAt: options?.restoreSource ? Date.now() : undefined,
  };
  writePositions(positions);

  if (options?.restoreSource === 'footer' && options.restoreTargetPath) {
    try {
      sessionStorage.setItem(LATEST_FOOTER_NAVIGATION_KEY, JSON.stringify({
        originPath: pathname,
        targetPath: options.restoreTargetPath,
        savedAt: Date.now(),
      }));
    } catch { /* ignore */ }
  }
};

export const clearFooterRestoreForTarget = (targetPath: string) => {
  const positions = readPositions();
  let changed = false;

  for (const [pathname, position] of Object.entries(positions)) {
    if (position.restoreSource !== 'footer' || position.restoreTargetPath !== targetPath) continue;
    positions[pathname] = {
      top: position.top,
      anchorId: position.anchorId,
      anchorOffset: position.anchorOffset,
      scrollHeight: position.scrollHeight,
    };
    changed = true;
  }

  if (changed) writePositions(positions);
};

export const getFooterRestoreOrigin = (targetPath: string): string | null => {
  try {
    const raw = sessionStorage.getItem(LATEST_FOOTER_NAVIGATION_KEY);
    if (raw) {
      const latest = JSON.parse(raw) as { originPath?: unknown; targetPath?: unknown; savedAt?: unknown };
      if (
        latest.targetPath === targetPath
        && typeof latest.originPath === 'string'
        && typeof latest.savedAt === 'number'
        && Date.now() - latest.savedAt < 30 * 60 * 1000
      ) {
        return latest.originPath;
      }
    }
  } catch { /* ignore */ }

  const positions = readPositions();
  let best: { pathname: string; savedAt: number } | null = null;

  for (const [pathname, position] of Object.entries(positions)) {
    if (position.restoreSource !== 'footer' || position.restoreTargetPath !== targetPath) continue;
    const savedAt = position.restoreSavedAt ?? 0;
    if (!best || savedAt > best.savedAt) best = { pathname, savedAt };
  }

  return best?.pathname ?? null;
};

export const requestFooterRestore = (originPath: string) => {
  try { sessionStorage.setItem(PENDING_FOOTER_RESTORE_KEY, originPath); } catch { /* ignore */ }
};

export const clearLatestFooterNavigationIfLeavingTarget = (previousPath: string) => {
  try {
    const raw = sessionStorage.getItem(LATEST_FOOTER_NAVIGATION_KEY);
    if (!raw) return;
    const latest = JSON.parse(raw) as { targetPath?: unknown };
    if (latest && typeof latest === 'object' && latest.targetPath === previousPath) {
      sessionStorage.removeItem(LATEST_FOOTER_NAVIGATION_KEY);
    }
  } catch {
    try { sessionStorage.removeItem(LATEST_FOOTER_NAVIGATION_KEY); } catch { /* ignore */ }
  }
};

export const consumePendingFooterRestore = (pathname: string): boolean => {
  try {
    if (sessionStorage.getItem(PENDING_FOOTER_RESTORE_KEY) !== pathname) return false;
    sessionStorage.removeItem(PENDING_FOOTER_RESTORE_KEY);
    return true;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// Anchor helpers — find the element closest to the container viewport top
// ---------------------------------------------------------------------------

export const getAnchorSnapshot = (
  scrollContainer: HTMLElement,
): { anchorId: string; anchorOffset: number } | null => {
  const anchors = Array.from(
    scrollContainer.querySelectorAll<HTMLElement>('[data-scroll-anchor-id]'),
  );
  if (anchors.length === 0) return null;

  const containerTop = scrollContainer.getBoundingClientRect().top;
  let bestMatch: { anchorId: string; anchorOffset: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const anchor of anchors) {
    const anchorId = anchor.dataset.scrollAnchorId;
    if (!anchorId) continue;

    const anchorOffset = anchor.getBoundingClientRect().top - containerTop;
    const distance = Math.abs(anchorOffset);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = { anchorId, anchorOffset };
    }
  }

  return bestMatch;
};

export const getAnchorDelta = (
  scrollContainer: HTMLElement,
  anchorId?: string,
  expectedOffset?: number,
): number | null => {
  if (!anchorId || typeof expectedOffset !== 'number') {
    return null;
  }

  const escapedAnchorId = window.CSS?.escape
    ? window.CSS.escape(anchorId)
    : anchorId.replace(/"/g, '\\"');

  const anchor = scrollContainer.querySelector<HTMLElement>(
    `[data-scroll-anchor-id="${escapedAnchorId}"]`,
  );
  if (!anchor) return null;

  const containerTop = scrollContainer.getBoundingClientRect().top;
  const actualOffset = anchor.getBoundingClientRect().top - containerTop;
  return actualOffset - expectedOffset;
};
