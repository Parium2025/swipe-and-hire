import { useEffect, useRef, useState } from 'react';
import { SplinePhone } from '@/components/landing/SplinePhone';

// ─────────────────────────────────────────────────────────────────────────────
// FixedPhoneLayer
// Renderar Spline-telefonen i ett fast layer ovanför sidan, med metrics
// uträknade från viewport + hero-anchor. Lyssnar på `parium:hero-index`
// och scroll-events i `[data-landing-scroll-root]` för att fade:a ut/in.
// Extraherad från AudienceLanding.tsx — ingen visuell förändring.
// ─────────────────────────────────────────────────────────────────────────────
const FixedPhoneLayer = () => {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const heroIndexRef = useRef(0);
  const lastHeroMetricsRef = useRef<{ isDesktop: boolean; top: number; height: number; zoom: number; yOffset: number } | null>(null);
  const getVisibleAnchor = () => {
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const anchors = Array.from(document.querySelectorAll('[data-hero-phone-anchor]')) as HTMLElement[];
    return anchors.find((anchor) => {
      const rect = anchor.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < viewportHeight;
    }) ?? null;
  };
  const calculatePhoneMetrics = () => {
    if (typeof window === 'undefined') return { isDesktop: true, top: 0, height: 660, zoom: 0.68, yOffset: 0 };
    if (heroIndexRef.current !== 0 && lastHeroMetricsRef.current) return lastHeroMetricsRef.current;
    const width = window.visualViewport?.width ?? window.innerWidth;
    const height = window.visualViewport?.height ?? window.innerHeight;

    if (width >= 1024) {
      const isCompactLaptop = height <= 820;
      const desktopTopPadding = isCompactLaptop ? 132 : 142;
      const desktopBottomPadding = isCompactLaptop ? 84 : 96;
      const safeCanvasHeight = Math.max(340, height - desktopTopPadding - desktopBottomPadding);
      const widthFitHeight = (Math.min(width * 0.28, 390) * 19.5) / 9;
      const safeHeight = clamp(Math.min(safeCanvasHeight, widthFitHeight), isCompactLaptop ? 340 : 390, isCompactLaptop ? 500 : 570);
      const viewportScale = clamp(width / 1440, 0.82, 1);
      const yOffset = isCompactLaptop ? 30 : 26;
      const metrics = {
        isDesktop: true,
        top: 0,
        height: safeHeight,
        zoom: clamp((height / safeHeight) * (isCompactLaptop ? 0.38 : 0.42) * viewportScale, 0.36, isCompactLaptop ? 0.5 : 0.56),
        yOffset,
      };
      lastHeroMetricsRef.current = metrics;
      return metrics;
    }

    const anchor = getVisibleAnchor();
    const textBottom = anchor?.getBoundingClientRect().bottom ?? height * 0.48;
    const tablet = width >= 700;
    const gap = tablet ? clamp(height * 0.055, 44, 96) : clamp(height * 0.06, 40, 88);
    const topSafeGap = tablet ? clamp(height * 0.075, 56, 120) : clamp(height * 0.082, 54, 110);
    const bottomSafe = tablet ? clamp(height * 0.095, 70, 140) : clamp(height * 0.11, 76, 132);
    const canvasTopBreathingRoom = tablet ? clamp(height * 0.07, 50, 110) : clamp(height * 0.095, 64, 120);
    const availableHeight = Math.max(220, height - textBottom - gap - bottomSafe);
    const maxCanvasHeight = Math.max(220, height - gap - bottomSafe);
    const visualHeight = availableHeight;
    const finalHeight = Math.min(visualHeight + canvasTopBreathingRoom, maxCanvasHeight);
    const yOffset = width >= 768 ? 18 : clamp(height * 0.038, 28, 42);
    const safeTop = textBottom + topSafeGap + (tablet ? 0 : yOffset);
    const bottomAnchoredTop = height - bottomSafe - visualHeight;
    const top = Math.max(gap, safeTop, bottomAnchoredTop);
    const referenceHeight = tablet ? 460 : 376;
    const baseZoom = tablet ? 0.46 : 0.44;
    const canvasWidth = Math.min(width, tablet ? 560 : width);
    const widthLimitedZoom = baseZoom * (canvasWidth / (tablet ? 560 : 390));
    const heightLimitedZoom = baseZoom * (finalHeight / referenceHeight);
    const fluidZoom = Math.min(widthLimitedZoom, heightLimitedZoom);
    const metrics = {
      isDesktop: false,
      top,
      height: finalHeight,
      zoom: clamp(fluidZoom, 0.32, tablet ? 0.6 : 0.58),
      yOffset,
    };
    lastHeroMetricsRef.current = metrics;
    return metrics;
  };
  const [visible, setVisible] = useState(true);
  const [active, setActive] = useState(true);
  const [phoneReady, setPhoneReady] = useState(false);
  const [phoneMetrics, setPhoneMetrics] = useState(calculatePhoneMetrics);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVisibleRef = useRef(true);

  useEffect(() => {
    const syncPhoneMetrics = () => {
      setPhoneMetrics(calculatePhoneMetrics());
    };

    syncPhoneMetrics();
    const frame = window.requestAnimationFrame(syncPhoneMetrics);
    const timers = [80, 180, 360, 720, 1200].map((delay) => window.setTimeout(syncPhoneMetrics, delay));
    const anchor = document.querySelector('[data-hero-phone-anchor]') as HTMLElement | null;
    const observer = anchor ? new ResizeObserver(syncPhoneMetrics) : null;
    if (anchor) observer?.observe(anchor);
    document.fonts?.ready.then(syncPhoneMetrics).catch(() => undefined);
    window.addEventListener('resize', syncPhoneMetrics, { passive: true });
    window.visualViewport?.addEventListener('resize', syncPhoneMetrics, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer?.disconnect();
      window.removeEventListener('resize', syncPhoneMetrics);
      window.visualViewport?.removeEventListener('resize', syncPhoneMetrics);
    };
  }, []);

  useEffect(() => {
    const scrollRoot = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;

    const isHeroZone = () => {
      if (heroIndexRef.current !== 0) return false;
      if (!scrollRoot) return true;
      const stage = document.querySelector('[data-hero-intro-stage]') as HTMLElement | null;
      if (!stage) return scrollRoot.scrollTop <= window.innerHeight * 0.65;
      const rect = stage.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.12 && rect.bottom > window.innerHeight * 0.55;
    };

    const apply = (next: boolean) => {
      if (next === lastVisibleRef.current && showTimerRef.current === null) return;
      if (next) {
        if (showTimerRef.current) return;
        showTimerRef.current = setTimeout(() => {
          showTimerRef.current = null;
          lastVisibleRef.current = true;
          setVisible(true);
        }, 900);
      } else {
        if (showTimerRef.current) {
          clearTimeout(showTimerRef.current);
          showTimerRef.current = null;
        }
        lastVisibleRef.current = false;
        setVisible(false);
      }
    };

    const sync = () => apply(isHeroZone());

    const onIndex = (e: Event) => {
      const detail = (e as CustomEvent<{ index: number }>).detail;
      heroIndexRef.current = detail?.index ?? 0;
      setActive((detail?.index ?? 0) === 0);
      setPhoneMetrics(calculatePhoneMetrics());
      apply(detail?.index !== 1 && isHeroZone());
    };

    sync();
    const onSplineReady = () => setPhoneReady(true);
    window.addEventListener('parium:hero-index', onIndex);
    window.addEventListener('parium:spline-ready', onSplineReady);
    scrollRoot?.addEventListener('scroll', sync, { passive: true });

    const phoneWrapper = document.querySelector('[data-phone-scroll-forward]') as HTMLElement | null;
    let touchY: number | null = null;

    const forwardWheel = (e: WheelEvent) => {
      if (!scrollRoot) return;
      e.preventDefault();
      e.stopPropagation();
      scrollRoot.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: e.deltaY,
          deltaX: e.deltaX,
          deltaMode: e.deltaMode,
          bubbles: true,
          cancelable: true,
        }),
      );
    };

    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchY === null || !scrollRoot) return;
      const cy = e.touches[0]?.clientY ?? touchY;
      const dy = touchY - cy;
      if (Math.abs(dy) < 6) return;
      e.preventDefault();
      scrollRoot.dispatchEvent(
        new WheelEvent('wheel', { deltaY: dy * 2, bubbles: true, cancelable: true }),
      );
      touchY = cy;
    };
    const onTouchEnd = () => { touchY = null; };

    phoneWrapper?.addEventListener('wheel', forwardWheel, { passive: false, capture: true });
    phoneWrapper?.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    phoneWrapper?.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    phoneWrapper?.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });

    return () => {
      window.removeEventListener('parium:hero-index', onIndex);
      window.removeEventListener('parium:spline-ready', onSplineReady);
      scrollRoot?.removeEventListener('scroll', sync);
      phoneWrapper?.removeEventListener('wheel', forwardWheel, true);
      phoneWrapper?.removeEventListener('touchstart', onTouchStart, true);
      phoneWrapper?.removeEventListener('touchmove', onTouchMove, true);
      phoneWrapper?.removeEventListener('touchend', onTouchEnd, true);
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    };
  }, []);

  const shouldShowPhone = visible && (phoneReady || !phoneMetrics.isDesktop);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 flex h-[100svh] items-start justify-center overflow-hidden px-5 sm:px-6 md:px-12 lg:items-center lg:px-24 lg:pb-16 lg:pt-28"
      aria-hidden="true"
    >
      <div className="relative mx-auto flex h-full w-full max-w-[1280px] items-start justify-center lg:grid lg:h-auto lg:grid-cols-2 lg:items-start lg:gap-16 2xl:max-w-[1440px]">
        <div aria-hidden className="hidden lg:block" />
        <div
          data-phone-scroll-forward
          className={`${shouldShowPhone ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'} ${phoneMetrics.isDesktop ? 'relative mx-auto flex w-fit items-center justify-center transition-opacity duration-500 ease-out' : 'absolute left-1/2 flex w-fit -translate-x-1/2 items-start justify-center transition-opacity duration-300 ease-out'}`}
          style={phoneMetrics.isDesktop
            ? { touchAction: 'none', overscrollBehavior: 'contain', height: `${phoneMetrics.height}px`, transform: `translateY(${phoneMetrics.yOffset}px)` }
            : { touchAction: 'none', overscrollBehavior: 'contain', top: `${phoneMetrics.top}px`, height: `${phoneMetrics.height}px` }
          }
        >
          <SplinePhone
            className={phoneMetrics.isDesktop ? "h-full w-auto aspect-[9/19.5]" : "h-full w-auto min-w-[140px] max-w-[min(72vw,270px)] aspect-[9/19.5]"}
            style={phoneMetrics.isDesktop ? undefined : { transform: `translateY(-${phoneMetrics.yOffset}px)` }}
            zoom={phoneMetrics.zoom}
            active={active}
            instantFallback={!phoneMetrics.isDesktop}
          />
        </div>
      </div>
    </div>
  );
};

export default FixedPhoneLayer;
