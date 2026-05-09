/** Pure utility functions for scroll-position persistence. */

const SCROLL_STORAGE_KEY = 'parium-scroll-positions';

export const RESTORE_TOLERANCE_PX = 2;
export const REQUIRED_STABLE_FRAMES = 2;
export const SCROLL_HEIGHT_TOLERANCE_PX = 32;
export const MAX_WAIT_MS = 3000;

export interface ScrollPosition {
  top: number;
  anchorId?: string;
  anchorOffset?: number;
  scrollHeight?: number;
}

// ---------------------------------------------------------------------------
// Scroll container
// ---------------------------------------------------------------------------

export const getManagedScrollContainer = (): HTMLElement | null =>
  document.querySelector('[data-main-scroll-container="true"]');

/**
 * Smoothly scrolls to top, then runs the callback once scroll settles.
 * Guarantees identical premium feel for both "next" and "previous" actions
 * regardless of how short the next page's content is.
 */
export const scrollToTopThenRun = (callback: () => void, maxWaitMs = 600) => {
  if (typeof window === 'undefined') {
    callback();
    return;
  }

  const container = getManagedScrollContainer();
  const getTop = () =>
    container ? container.scrollTop : window.scrollY || window.pageYOffset || 0;

  const startTop = getTop();
  if (startTop <= 2) {
    callback();
    return;
  }

  try {
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch {
    if (container) container.scrollTop = 0;
    else window.scrollTo(0, 0);
  }

  const start = performance.now();
  let lastTop = startTop;
  let stableFrames = 0;

  const tick = () => {
    const now = performance.now();
    const top = getTop();
    if (top <= 2 || now - start >= maxWaitMs) {
      callback();
      return;
    }
    if (Math.abs(top - lastTop) < 0.5) {
      stableFrames += 1;
      if (stableFrames >= 4) {
        callback();
        return;
      }
    } else {
      stableFrames = 0;
    }
    lastTop = top;
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
};

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
