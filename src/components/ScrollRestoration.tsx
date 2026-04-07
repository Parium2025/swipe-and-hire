import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const SCROLL_STORAGE_KEY = 'parium-scroll-positions';
const RESTORE_TOLERANCE_PX = 2;
const REQUIRED_STABLE_FRAMES = 2;
const SCROLL_HEIGHT_TOLERANCE_PX = 32;

interface ScrollPosition {
  top: number;
  anchorId?: string;
  anchorOffset?: number;
  scrollHeight?: number;
}

const getManagedScrollContainer = (): HTMLElement | null => {
  return document.querySelector('[data-main-scroll-container="true"]');
};

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

const readPositions = (): Record<string, ScrollPosition> => {
  try {
    const raw = sessionStorage.getItem(SCROLL_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed).reduce<Record<string, ScrollPosition>>((acc, [pathname, value]) => {
      const normalized = normalizePosition(value);
      if (normalized) {
        acc[pathname] = normalized;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const writePositions = (positions: Record<string, ScrollPosition>) => {
  try {
    sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // ignore
  }
};

const getAnchorElements = (scrollContainer: HTMLElement): HTMLElement[] => {
  return Array.from(scrollContainer.querySelectorAll<HTMLElement>('[data-scroll-anchor-id]'));
};

const getAnchorSnapshot = (scrollContainer: HTMLElement): { anchorId: string; anchorOffset: number } | null => {
  const anchors = getAnchorElements(scrollContainer);
  if (anchors.length === 0) return null;

  const containerTop = scrollContainer.getBoundingClientRect().top;
  let bestMatch: { anchorId: string; anchorOffset: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  anchors.forEach((anchor) => {
    const anchorId = anchor.dataset.scrollAnchorId;
    if (!anchorId) return;

    const anchorOffset = anchor.getBoundingClientRect().top - containerTop;
    const distance = Math.abs(anchorOffset);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = { anchorId, anchorOffset };
    }
  });

  return bestMatch;
};

const getAnchorDelta = (
  scrollContainer: HTMLElement,
  anchorId?: string,
  expectedOffset?: number,
): number | null => {
  if (!anchorId || typeof expectedOffset !== 'number') {
    return null;
  }

  const escapedAnchorId = window.CSS?.escape ? window.CSS.escape(anchorId) : anchorId.replace(/"/g, '\\"');
  const anchor = scrollContainer.querySelector<HTMLElement>(`[data-scroll-anchor-id="${escapedAnchorId}"]`);
  if (!anchor) return null;

  const containerTop = scrollContainer.getBoundingClientRect().top;
  const actualOffset = anchor.getBoundingClientRect().top - containerTop;
  return actualOffset - expectedOffset;
};

export function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const isRestoringRef = useRef(false);
  const pendingSaveFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const scrollContainer = getManagedScrollContainer();
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (isRestoringRef.current) return;
      if (pendingSaveFrameRef.current) return;

      pendingSaveFrameRef.current = requestAnimationFrame(() => {
        pendingSaveFrameRef.current = null;
        if (isRestoringRef.current) return;

        const positions = readPositions();
        const anchorSnapshot = getAnchorSnapshot(scrollContainer);

        positions[location.pathname] = {
          top: scrollContainer.scrollTop,
          anchorId: anchorSnapshot?.anchorId,
          anchorOffset: anchorSnapshot?.anchorOffset,
          scrollHeight: scrollContainer.scrollHeight,
        };
        writePositions(positions);
      });
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (pendingSaveFrameRef.current) {
        cancelAnimationFrame(pendingSaveFrameRef.current);
        pendingSaveFrameRef.current = null;
      }
    };
  }, [location.pathname]);

  useLayoutEffect(() => {
    const positions = readPositions();
    const storedPosition = navigationType === 'POP' ? positions[location.pathname] : undefined;
    const targetTop = storedPosition?.top ?? 0;
    let cancelled = false;
    let rafId = 0;

    const releaseRestoreLock = () => {
      requestAnimationFrame(() => {
        if (!cancelled) {
          isRestoringRef.current = false;
        }
      });
    };

    isRestoringRef.current = true;

    // For scroll-to-top (targetTop === 0) we can apply immediately
    if (targetTop === 0) {
      const scrollContainer = getManagedScrollContainer();
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
      }
      releaseRestoreLock();

      return () => {
        cancelled = true;
        if (rafId) cancelAnimationFrame(rafId);
      };
    }

    // For restoring a saved position, we need to wait until:
    // 1. The scroll container exists
    // 2. The container has enough content to scroll to the target position
    // This can take several hundred ms when data is loading after a remount.
    const startTime = performance.now();
    const MAX_WAIT_MS = 3000;
    let stableFrames = 0;

    const tryRestore = () => {
      if (cancelled) return;

      const scrollContainer = getManagedScrollContainer();
      if (!scrollContainer) {
        if (performance.now() - startTime < MAX_WAIT_MS) {
          rafId = requestAnimationFrame(tryRestore);
        } else {
          releaseRestoreLock();
        }
        return;
      }

      const anchorDelta = getAnchorDelta(
        scrollContainer,
        storedPosition?.anchorId,
        storedPosition?.anchorOffset,
      );

      if (anchorDelta !== null) {
        scrollContainer.scrollTo({ top: scrollContainer.scrollTop + anchorDelta, behavior: 'auto' });
      } else {
        scrollContainer.scrollTo({ top: targetTop, behavior: 'auto' });
      }

      // If content hasn't loaded enough, the actual scrollTop will be less than targetTop.
      // Keep retrying until content grows enough or timeout.
      const actualTop = scrollContainer.scrollTop;
      const nextAnchorDelta = getAnchorDelta(
        scrollContainer,
        storedPosition?.anchorId,
        storedPosition?.anchorOffset,
      );
      const closeEnough = nextAnchorDelta !== null
        ? Math.abs(nextAnchorDelta) <= RESTORE_TOLERANCE_PX
        : Math.abs(actualTop - targetTop) <= RESTORE_TOLERANCE_PX;
      const heightReady = !storedPosition?.scrollHeight
        || scrollContainer.scrollHeight >= storedPosition.scrollHeight - SCROLL_HEIGHT_TOLERANCE_PX;

      if (closeEnough && heightReady) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
      }

      if (stableFrames >= REQUIRED_STABLE_FRAMES) {
        releaseRestoreLock();
        return;
      }

      if (performance.now() - startTime < MAX_WAIT_MS) {
        rafId = requestAnimationFrame(tryRestore);
      } else {
        releaseRestoreLock();
      }
    };

    rafId = requestAnimationFrame(tryRestore);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [location.pathname, navigationType]);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  return null;
}
