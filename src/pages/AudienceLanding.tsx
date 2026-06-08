import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import LandingNav, { type LandingNavLink } from '@/components/LandingNav';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { syncBrowserChrome } from '@/lib/browserChrome';

import PinnedHorizontalGallery from '@/components/landing/audience/PinnedHorizontalGallery';
import WaveDivider from '@/components/landing/WaveDivider';
import BouncyFooter from '@/components/landing/audience/BouncyFooter';
import SplitHeadline from '@/components/landing/audience/SplitHeadline';
import { audienceContent, type AudienceRole } from '@/components/landing/audience/content';
import { SplinePhone } from '@/components/landing/SplinePhone';
import { HeroText } from '@/components/landing/audience/HeroText';
import { AudienceSEO } from '@/components/seo/AudienceSEO';
import pariumLogoRings from '@/assets/parium-logo-rings.png';


type AudienceLandingProps = {
  audience: AudienceRole;
};

const ease = [0.16, 1, 0.3, 1] as const;

const WAVE_VIEWBOX_WIDTH = 1440;
const WAVE_VIEWBOX_HEIGHT = 600;
const WAVE_SEGMENTS = [
  { x0: 0, y0: 80, x1: 200, y1: 120, x2: 380, y2: 110, x3: 560, y3: 80 },
  { x0: 560, y0: 80, x1: 760, y1: 46, x2: 940, y2: 44, x3: 1120, y3: 72 },
  { x0: 1120, y0: 72, x1: 1270, y1: 96, x2: 1360, y2: 100, x3: 1440, y3: 82 },
] as const;

const cubic = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
};

const waveYAtViewBoxX = (x: number) => {
  const clampedX = Math.max(0, Math.min(WAVE_VIEWBOX_WIDTH, x));
  const segment = WAVE_SEGMENTS.find((s) => clampedX >= s.x0 && clampedX <= s.x3) ?? WAVE_SEGMENTS[WAVE_SEGMENTS.length - 1];
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) / 2;
    const midX = cubic(segment.x0, segment.x1, segment.x2, segment.x3, mid);
    if (midX < clampedX) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) / 2;
  return cubic(segment.y0, segment.y1, segment.y2, segment.y3, t);
};

const useWaveAwareText = () => {
  useEffect(() => {
    const isTouchViewport = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
    if (isTouchViewport) {
      document.querySelectorAll<HTMLElement>('[data-landing-scroll-root] .wave-text').forEach((el) => {
        if (el.dataset.waveText) delete el.dataset.waveText;
        if (el.dataset.waveBelow) delete el.dataset.waveBelow;
        el.style.removeProperty('--wave-ink-clip');
      });
      return;
    }

    let frame = 0;
    const root = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;

    const update = () => {
      frame = 0;
      const wave = document.querySelector('[data-landing-wave-map]') as SVGSVGElement | null;
      const waveRect = wave?.getBoundingClientRect();
      const items = Array.from(document.querySelectorAll<HTMLElement>('[data-landing-scroll-root] .wave-text'));

      items.forEach((el) => {
        const text = el.textContent?.trim() ?? '';

        const rect = el.getBoundingClientRect();
        if (!waveRect || waveRect.width <= 0 || waveRect.height <= 0 || rect.width <= 0 || rect.height <= 0) {
          if (el.dataset.waveText) delete el.dataset.waveText;
          if (el.dataset.waveBelow) delete el.dataset.waveBelow;
          el.style.removeProperty('--wave-ink-clip');
          return;
        }

        // Sampla vågens Y över elementets bredd för att avgöra om den korsar.
        const samples = Math.max(4, Math.min(18, Math.ceil(rect.width / 34)));
        const ys: number[] = [];
        for (let i = 0; i <= samples; i += 1) {
          const viewportX = rect.left + rect.width * (i / samples);
          const viewBoxX = ((viewportX - waveRect.left) / waveRect.width) * WAVE_VIEWBOX_WIDTH;
          const viewBoxY = waveYAtViewBoxX(viewBoxX);
          ys.push(waveRect.top + (viewBoxY / WAVE_VIEWBOX_HEIGHT) * waveRect.height);
        }
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const tolerance = Math.max(2, Math.min(8, rect.height * 0.08));

        // Helt på blå yta: vågens överkant ligger tydligt under textens nederkant.
        if (minY >= rect.bottom - tolerance) {
          if (el.dataset.waveText) delete el.dataset.waveText;
          if (el.dataset.waveBelow) delete el.dataset.waveBelow;
          el.style.removeProperty('--wave-ink-clip');
          return;
        }

        // Helt på vit yta: vågens nedersta punkt ligger tydligt ovanför textens överkant.
        if (maxY <= rect.top + tolerance) {
          if (el.dataset.waveText) delete el.dataset.waveText;
          if (el.dataset.waveBelow !== '1') el.dataset.waveBelow = '1';
          el.style.removeProperty('--wave-ink-clip');
          return;
        }

        // Vågen korsar elementet → dual-layer med klipp.
        if (el.dataset.waveBelow) delete el.dataset.waveBelow;
        if (el.dataset.waveText !== text) el.dataset.waveText = text;

        const points = ['0% 0%', '100% 0%'];
        for (let i = samples; i >= 0; i -= 1) {
          const xPercent = (i / samples) * 100;
          const yPercent = Math.max(0, Math.min(100, ((ys[i] - rect.top) / rect.height) * 100));
          points.push(`${xPercent.toFixed(2)}% ${yPercent.toFixed(2)}%`);
        }

        el.style.setProperty('--wave-ink-clip', `polygon(${points.join(',')})`);
      });
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(document.documentElement);
    if (root) resizeObserver.observe(root);

    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(root ?? document.body, { childList: true, subtree: true, characterData: true });

    schedule();
    document.fonts?.ready.then(schedule).catch(() => undefined);
    root?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    window.visualViewport?.addEventListener('scroll', schedule, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      root?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, []);
};

const isMobileAnimationPrearmed = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
};

const useIsMobileLandingMotion = () => {
  const [isMobile, setIsMobile] = useState(isMobileAnimationPrearmed);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px), (pointer: coarse)');
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, []);

  return isMobile;
};

const IntroText = ({ paragraphs }: { paragraphs: string[] }) => (
  <div className="max-w-3xl text-center text-base leading-[1.6] sm:text-lg sm:leading-[1.75] md:text-xl">
    {paragraphs.map((paragraph, pIdx) => (
      <p key={pIdx} className={`wave-text ${pIdx > 0 ? 'mt-3 sm:mt-6' : ''}`.trim()}>
        {paragraph}
      </p>
    ))}
  </div>
);

type HeroIntroStageProps = {
  c: (typeof audienceContent)[AudienceRole];
  onIntroCta?: () => void;
  introCtaLabel?: string;
};

const PHONE_ASPECT = 9 / 19.5;

const getViewportSize = () => ({
  width: window.visualViewport?.width ?? window.innerWidth,
  height: window.visualViewport?.height ?? window.innerHeight,
});

const isMobileLikeHeroViewport = () => {
  if (typeof window === 'undefined') return false;
  const { width, height } = getViewportSize();
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  // Mobil-layout (stackad: text överst, telefon under) används endast på
  // riktiga små skärmar OCH på pekplattor i PORTRÄTT. På iPad i landskap
  // (bred + låg höjd) klipps rubriken — där använder vi istället den
  // delade desktop-vyn (text vänster, telefon höger) som är designad för
  // bredformat. Spline-runtime är samma komponent i båda layouts.
  if (width < 768) return true;
  if (isCoarse && height >= width && width <= 1024) return true;
  return false;
};

const getInlinePhonePlacement = (): 'mobile' | 'portraitTablet' | null => {
  if (typeof window === 'undefined') return null;
  const { width, height } = getViewportSize();
  if (isMobileLikeHeroViewport()) return 'mobile';
  if (width < 1180 && height > width) return 'portraitTablet';
  return null;
};

const useIsMobileLikeHeroLayout = () => {
  const [isMobileLike, setIsMobileLike] = useState(isMobileLikeHeroViewport);

  useEffect(() => {
    const sync = () => setIsMobileLike(isMobileLikeHeroViewport());
    sync();
    window.addEventListener('resize', sync, { passive: true });
    window.addEventListener('orientationchange', sync, { passive: true });
    window.visualViewport?.addEventListener('resize', sync, { passive: true });
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      window.visualViewport?.removeEventListener('resize', sync);
    };
  }, []);

  return isMobileLike;
};

/**
 * Mäter nav-pillrets verkliga bottenkant i runtime och returnerar en
 * padding-top i px som garanterar att hero-rubriken aldrig kan hamna
 * under pillret — oavsett enhet, orientering eller framtida nav-höjd.
 *
 * Resultatet kombineras med den responsiva clamp()-paddingen via
 * Math.max() på callsite, så utseendet är 100% oförändrat så länge
 * den befintliga clampen redan är tillräckligt stor. Är navet större
 * (t.ex. nya menyrader) tar mätvärdet över och håller rubriken fri.
 */
const useHeroSafeTopPadding = () => {
  // Lazy initializer: kör en synkron baseline-beräkning av den responsiva
  // clampen vid första render så vi aldrig får en frame utan padding.
  // Nav-mätningen läggs ovanpå i useLayoutEffect innan paint.
  const [topPx, setTopPx] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const w = window.innerWidth;
    const h = window.visualViewport?.height ?? window.innerHeight;
    const rem = 16;
    const clamp = (min: number, pref: number, max: number) =>
      Math.max(min, Math.min(max, pref));
    if (w >= 768) return Math.ceil(clamp(7.5 * rem, 0.16 * h, 9.5 * rem));
    if (w >= 640) return Math.ceil(clamp(6.5 * rem, 0.14 * h, 8 * rem));
    return Math.ceil(clamp(5.25 * rem, 0.12 * h, 6 * rem));
  });

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const GAP_PX = 16;
    const measure = () => {
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Huvudnavigation"]');
      const navBottom = nav ? nav.getBoundingClientRect().bottom : 0;
      const w = window.innerWidth;
      const h = window.visualViewport?.height ?? window.innerHeight;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      // Speglar Tailwind-clampen för att bevara nuvarande utseende:
      // base:  clamp(5.25rem, 12svh, 6rem)
      // sm:    clamp(6.5rem,  14svh, 8rem)
      // md:    clamp(7.5rem,  16svh, 9.5rem)
      const clamp = (min: number, pref: number, max: number) =>
        Math.max(min, Math.min(max, pref));
      let responsive: number;
      if (w >= 768) responsive = clamp(7.5 * rem, 0.16 * h, 9.5 * rem);
      else if (w >= 640) responsive = clamp(6.5 * rem, 0.14 * h, 8 * rem);
      else responsive = clamp(5.25 * rem, 0.12 * h, 6 * rem);
      setTopPx(Math.ceil(Math.max(responsive, navBottom + GAP_PX)));
    };
    measure();
    const ro = 'ResizeObserver' in window ? new ResizeObserver(measure) : null;
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Huvudnavigation"]');
    if (nav && ro) ro.observe(nav);
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('orientationchange', measure, { passive: true });
    window.visualViewport?.addEventListener('resize', measure, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

  return topPx;
};




const calculateInlinePhoneMetrics = () => {
  if (typeof window === 'undefined') {
    return { height: 320, width: 320 * PHONE_ASPECT, zoom: 0.44, yOffset: 28 };
  }

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const { width, height } = getViewportSize();
  const placement = getInlinePhonePlacement();
  const isPortraitTablet = placement === 'portraitTablet';
  const isWideInlineMobile = !isPortraitTablet && width >= 520;
  const mobileTextReserve = clamp(height * 0.49, 330, 430);
  const mobileBottomReserve = clamp(height * 0.09, 58, 86);
  const mobileAvailableHeight = Math.max(240, height - mobileTextReserve - mobileBottomReserve);
  const rawHeight = isPortraitTablet
    ? clamp(height * 0.54, 430, 680)
    : isWideInlineMobile
      ? clamp(Math.min(height * 0.54, mobileAvailableHeight + clamp(height * 0.18, 110, 180)), 360, 520)
      : clamp(Math.min(height * 0.43, mobileAvailableHeight + 32), 270, 370);
  const maxPhoneWidth = isPortraitTablet
    ? Math.min(width * 0.48, 380)
    : isWideInlineMobile
      ? Math.min(width * 0.5, 330)
      : Math.min(width * 0.62, 250);
  const safeHeight = Math.min(rawHeight, maxPhoneWidth / PHONE_ASPECT);

  // Extra vertical headroom inuti canvasen så att Spline-telefonens topp
  // (kamera/notch) aldrig klipps på små skärmar. Phonen renderas centrerat
  // i canvasen, så vi får lika mycket luft över som under – vi kompenserar
  // sedan marginTop med halva extra-höjden för att hålla samma position.
  const canvasVerticalPadding = isPortraitTablet ? clamp(height * 0.08, 72, 118) : clamp(height * 0.18, 96, 160);
  const canvasHeight = safeHeight + canvasVerticalPadding;
  const textAnchor = !isPortraitTablet
    ? document.querySelector('[data-mobile-hero-section] [data-hero-phone-anchor]') as HTMLElement | null
    : null;
  const mobileHero = !isPortraitTablet
    ? document.querySelector('[data-mobile-hero-section]') as HTMLElement | null
    : null;
  const textBottom = textAnchor && mobileHero
    ? textAnchor.getBoundingClientRect().bottom - mobileHero.getBoundingClientRect().top
    : mobileTextReserve;
  const centeredMobileGap = (height - textBottom - canvasHeight) / 2;
  const desiredMobileGap = Math.max(centeredMobileGap, clamp(height * 0.09, 58, 96));
  const mobileTopGap = Math.max(clamp(height * 0.035, 28, 46), desiredMobileGap - canvasVerticalPadding * 0.18);

  return {
    height: safeHeight,
    width: safeHeight * PHONE_ASPECT,
    canvasHeight,
    // Trimma bort en större andel av bottenpadding på ultra-små skärmar
    // (≤375px / låga höjder) så att nästa sektion kommer upp tätt under
    // telefonen utan att toppen klipps – topp-headroom är orörd.
    canvasBottomTrim: isPortraitTablet
      ? 0
      : canvasVerticalPadding * (width <= 375 || height <= 640 ? 0.78 : 0.5),
    zoom: isPortraitTablet
      ? clamp((safeHeight / 520) * 0.68, 0.5, 0.82)
      : clamp((safeHeight / 376) * (isWideInlineMobile ? 0.66 : 0.58), 0.42, isWideInlineMobile ? 0.82 : 0.68),
    topGap: isPortraitTablet ? clamp(height * 0.075, 64, 108) - canvasVerticalPadding / 2 : mobileTopGap,
  };
};

const InlineHeroPhone = ({ placement, className = '' }: { placement: 'mobile' | 'portraitTablet'; className?: string }) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(() => getInlinePhonePlacement() === placement);
  const [active, setActive] = useState(() => getInlinePhonePlacement() === placement);
  const [metrics, setMetrics] = useState(calculateInlinePhoneMetrics);
  

  useEffect(() => {
    const sync = () => {
      setEnabled(getInlinePhonePlacement() === placement);
      setMetrics(calculateInlinePhoneMetrics());
    };

    sync();
    window.addEventListener('resize', sync, { passive: true });
    window.visualViewport?.addEventListener('resize', sync, { passive: true });
    return () => {
      window.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('resize', sync);
    };
  }, [placement]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !enabled) {
      setActive(false);
      return;
    }

    const root = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting && entry.intersectionRatio > 0.01),
      { root, rootMargin: '180px 0px 180px 0px', threshold: [0, 0.01, 0.25] },
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className={`pointer-events-none relative z-0 mx-auto flex shrink-0 items-center justify-center overflow-visible ${className}`}
      style={{ height: `${metrics.canvasHeight ?? metrics.height}px`, width: `${metrics.width}px`, marginTop: `${metrics.topGap}px`, marginBottom: `-${metrics.canvasBottomTrim ?? 0}px` }}
    >
      <SplinePhone
        className="h-full w-full"
        zoom={metrics.zoom}
        active={enabled && active}
      />
    </div>
  );
};

const calculateMobileHeroMinHeight = () => {
  if (typeof window === 'undefined' || getInlinePhonePlacement() !== 'mobile') return null;

  const hero = document.querySelector('[data-mobile-hero-section]') as HTMLElement | null;
  const anchor = hero?.querySelector('[data-hero-phone-anchor]') as HTMLElement | null;
  if (!hero || !anchor) return null;

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const { height } = getViewportSize();
  const heroTop = hero.getBoundingClientRect().top;
  const anchorBottom = anchor.getBoundingClientRect().bottom - heroTop;
  const metrics = calculateInlinePhoneMetrics();
  const phoneBlockHeight = (metrics.canvasHeight ?? metrics.height) + (metrics.topGap ?? 0) - (metrics.canvasBottomTrim ?? 0);
  const bottomSafe = clamp(height * 0.02, 12, 24);

  return Math.ceil(anchorBottom + phoneBlockHeight + bottomSafe);
};

const useMobileHeroMinHeight = () => {
  const [minHeight, setMinHeight] = useState<number | null>(null);

  useEffect(() => {
    let frame = 0;

    const sync = () => {
      frame = 0;
      setMinHeight(calculateMobileHeroMinHeight());
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    schedule();
    const timers = [80, 180, 360, 720].map((delay) => window.setTimeout(schedule, delay));
    const anchor = document.querySelector('[data-mobile-hero-section] [data-hero-phone-anchor]') as HTMLElement | null;
    const observer = anchor ? new ResizeObserver(schedule) : null;
    if (anchor) observer?.observe(anchor);
    document.fonts?.ready.then(schedule).catch(() => undefined);
    window.addEventListener('resize', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, []);

  return minHeight;
};

const FixedPhoneLayer = () => {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  
  const lastHeroMetricsRef = useRef<{ isDesktop: boolean; isPortraitTablet?: boolean; top: number; height: number; zoom: number; yOffset: number } | null>(null);
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
    if (lastHeroMetricsRef.current && !document.querySelector('[data-hero-intro-stage]')) return lastHeroMetricsRef.current;
    const width = window.visualViewport?.width ?? window.innerWidth;
    const height = window.visualViewport?.height ?? window.innerHeight;

    const isCoarse = typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
    const isPortraitTablet = width >= 768 && width < 1180 && height > width;
    // iPad / surfplatta i LIGGANDE läge: bred touch-enhet med begränsad höjd.
    // Här vill vi fylla ut den högra ytan rejält så telefonen inte ser liten ut.
    const isLandscapeTablet = isCoarse && width >= 1024 && width <= 1400 && width > height;

    if (isLandscapeTablet) {
      const topPad = 132;
      const bottomPad = 88;
      const safeCanvasHeight = Math.max(360, height - topPad - bottomPad);
      // Telefonkolumnen tar nästan halva bredden så mockupen får ordentlig närvaro.
      const columnWidth = Math.min(width * 0.46, 620);
      const widthFitHeight = (columnWidth * 19.5) / 9;
      const safeHeight = Math.min(safeCanvasHeight, widthFitHeight, 760);
      const metrics = {
        isDesktop: true,
        top: 0,
        height: safeHeight,
        // Större zoom-cap för att telefonen ska kännas premium och fylla ytan.
        zoom: clamp((safeHeight / 460) * 0.6, 0.5, 0.86),
        yOffset: 18,
      };
      lastHeroMetricsRef.current = metrics;
      return metrics;
    }

    if (isPortraitTablet) {
      const anchor = getVisibleAnchor();
      const textBottom = anchor?.getBoundingClientRect().bottom ?? height * 0.52;
      const gap = clamp(height * 0.028, 24, 40);
      const bottomSafe = clamp(height * 0.055, 60, 88);
      const top = Math.min(textBottom + gap, height - bottomSafe - 320);
      const availableHeight = Math.max(320, height - top - bottomSafe);
      // Större mockup på surfplatta (portrait) — fyller mer av den lediga ytan
      const safeHeight = Math.min(availableHeight, 720);
      const metrics = {
        isDesktop: false,
        isPortraitTablet: true,
        top,
        height: safeHeight,
        zoom: clamp((safeHeight / 460) * 0.46, 0.34, 0.62),
        yOffset: 0,
      };
      lastHeroMetricsRef.current = metrics;
      return metrics;
    }


    if (width >= 768) {
      const isCompactLaptop = height <= 820;
      const isLargeDesktop = width >= 1280;
      const isXLDesktop = width >= 1536;
      const isUltraDesktop = width >= 1920;
      const desktopTopPadding = isCompactLaptop ? 148 : 142;
      const desktopBottomPadding = isCompactLaptop ? 104 : 96;
      const safeCanvasHeight = Math.max(300, height - desktopTopPadding - desktopBottomPadding);
      // Bredare telefonkolumn på stora skärmar så mockupen inte ser liten ut
      const columnRatio = isUltraDesktop ? 0.36 : isXLDesktop ? 0.32 : isLargeDesktop ? 0.30 : 0.22;
      const columnCap = isUltraDesktop ? 560 : isXLDesktop ? 500 : isLargeDesktop ? 450 : 390;
      const phoneColumnWidth = width * columnRatio;
      const widthFitHeight = (Math.min(phoneColumnWidth, columnCap) * 19.5) / 9;
      const minH = width < 900 ? 330 : isCompactLaptop ? 300 : 390;
      const maxH = isUltraDesktop ? 820 : isXLDesktop ? 740 : isLargeDesktop ? 660 : (width < 900 ? 420 : isCompactLaptop ? 430 : 570);
      const safeHeight = clamp(Math.min(safeCanvasHeight, widthFitHeight), minH, maxH);
      const viewportScale = clamp(width / 1440, 0.72, isUltraDesktop ? 1.3 : isXLDesktop ? 1.18 : isLargeDesktop ? 1.08 : 1);
      const yOffset = isCompactLaptop ? 12 : 26;
      const zoomCap = isUltraDesktop ? 0.82 : isXLDesktop ? 0.72 : isLargeDesktop ? 0.64 : (isCompactLaptop ? 0.43 : 0.56);
      const metrics = {
        isDesktop: true,
        top: 0,
        height: safeHeight,
        zoom: clamp((height / safeHeight) * (isCompactLaptop ? 0.35 : 0.42) * viewportScale, 0.32, zoomCap),
        yOffset,
      };
      lastHeroMetricsRef.current = metrics;
      return metrics;
    }

    const anchor = getVisibleAnchor();
    const textBottom = anchor?.getBoundingClientRect().bottom ?? height * 0.48;
    const tablet = width >= 700;
    // Proportional safe areas — scale with viewport height so phone never clips and breathes equally top/bottom.
    const gap = tablet ? clamp(height * 0.035, 28, 64) : clamp(height * 0.024, 16, 44);
    const topSafeGap = tablet ? clamp(height * 0.055, 40, 88) : clamp(height * 0.045, 30, 68);
    const bottomSafe = tablet ? clamp(height * 0.06, 44, 96) : clamp(height * 0.048, 34, 72);
    const canvasTopBreathingRoom = tablet ? clamp(height * 0.085, 60, 124) : clamp(height * 0.115, 76, 138);
    // Maximize canvas area between text and bottom safe area — no hard cap so phone uses all available space.
    const availableHeight = Math.max(220, height - textBottom - gap - bottomSafe);
    const maxCanvasHeight = Math.max(220, height - gap - bottomSafe);
    const visualHeight = availableHeight;
    const finalHeight = Math.min(visualHeight + canvasTopBreathingRoom, maxCanvasHeight);
    const yOffset = width >= 768 ? 18 : clamp(height * 0.024, 14, 28);
    const safeTop = textBottom + topSafeGap + (tablet ? 0 : yOffset);
    const bottomAnchoredTop = height - bottomSafe - visualHeight;
    const top = Math.max(gap, safeTop, bottomAnchoredTop);
    // Reference baseline: at 390×844 finalHeight ≈ 376, zoom 0.44 looks perfect.
    // Scale zoom directly with canvas height so phone fills available area proportionally without clipping.
    const referenceHeight = tablet ? 460 : 376;
    const baseZoom = tablet ? 0.66 : 0.4;
    // Width constraint: phone aspect ≈ 9:19.5. Ensure phone width fits canvas width.
    const canvasWidth = Math.min(width, tablet ? 560 : width);
    const widthLimitedZoom = baseZoom * (canvasWidth / (tablet ? 560 : 390));
    const heightLimitedZoom = baseZoom * (finalHeight / referenceHeight);
    const fluidZoom = Math.min(widthLimitedZoom, heightLimitedZoom);
    const metrics = {
      isDesktop: false,
      top,
      height: finalHeight,
      zoom: clamp(fluidZoom, 0.3, tablet ? 0.92 : 0.5),
      yOffset,
    };
    lastHeroMetricsRef.current = metrics;
    return metrics;
  };
  const [visible, setVisible] = useState(true);
  const [active, setActive] = useState(true);
  const [phoneMetrics, setPhoneMetrics] = useState(calculatePhoneMetrics);
  const [isInlinePhone, setIsInlinePhone] = useState(() => getInlinePhonePlacement() !== null);
  const lastVisibleRef = useRef(true);

  useEffect(() => {
    const syncPhoneMetrics = () => {
      setIsInlinePhone(getInlinePhonePlacement() !== null);
      setPhoneMetrics(calculatePhoneMetrics());
    };

    syncPhoneMetrics();
    const frame = window.requestAnimationFrame(syncPhoneMetrics);
    const timers = [80, 180, 360, 720, 1200].map((delay) => window.setTimeout(syncPhoneMetrics, delay));
    const anchor = document.querySelector('[data-hero-phone-anchor]') as HTMLElement | null;
    const observer = anchor ? new ResizeObserver(syncPhoneMetrics) : null;
    if (anchor) observer?.observe(anchor);
    const mutationObserver = new MutationObserver(syncPhoneMetrics);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    document.fonts?.ready.then(syncPhoneMetrics).catch(() => undefined);
    window.addEventListener('resize', syncPhoneMetrics, { passive: true });
    window.visualViewport?.addEventListener('resize', syncPhoneMetrics, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', syncPhoneMetrics);
      window.visualViewport?.removeEventListener('resize', syncPhoneMetrics);
    };
  }, []);

  const phoneWrapperRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const scrollRoot = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;
    const isHeroZone = () => {
      if (!scrollRoot) return true;
      const stage = document.querySelector('[data-hero-intro-stage]') as HTMLElement | null;
      if (!stage) return scrollRoot.scrollTop <= window.innerHeight * 0.65;
      const rect = stage.getBoundingClientRect();
      const isDesktop = window.innerWidth >= 1180;
      const bottomThreshold = isDesktop ? 0.78 : 0.92;
      return rect.top < window.innerHeight * 0.12 && rect.bottom > window.innerHeight * bottomThreshold;
    };

    const apply = (next: boolean) => {
      if (next === lastVisibleRef.current) return;
      lastVisibleRef.current = next;
      setVisible(next);
      setActive(next);
    };

    const syncDesktopVisibility = () => {
      rafId = 0;
      apply(getInlinePhonePlacement() ? false : isHeroZone());
    };

    let rafId = 0;
    const sync = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(syncDesktopVisibility);
    };

    sync();
    scrollRoot?.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync, { passive: true });
    window.visualViewport?.addEventListener('resize', sync, { passive: true });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      scrollRoot?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('resize', sync);
    };
  }, []);




  const phoneWidth = phoneMetrics.height * PHONE_ASPECT;

  if (isInlinePhone) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 flex h-[100svh] items-start justify-center overflow-hidden px-5 sm:px-6 md:items-center md:px-12 md:pb-16 md:pt-28 lg:px-24"
      aria-hidden="true"
    >
      <div
        ref={phoneWrapperRef}
        className={`relative mx-auto flex h-full w-full max-w-[1280px] items-start justify-center ${phoneMetrics.isPortraitTablet ? '' : 'md:grid md:h-auto md:grid-cols-[minmax(0,1.1fr)_minmax(220px,0.9fr)] md:items-start md:gap-10 lg:grid-cols-2 lg:gap-16'} 2xl:max-w-[1440px]`}
      >
        <div aria-hidden className="hidden md:block" />
        <div
          data-phone-scroll-forward
          className={`pointer-events-none transition-opacity duration-[700ms] ease-out ${visible ? 'opacity-100' : 'opacity-0'} ${phoneMetrics.isDesktop ? 'relative ml-auto mr-[clamp(2rem,8vw,8rem)] flex w-fit items-center justify-center' : 'absolute left-1/2 flex w-fit -translate-x-1/2 items-start justify-center'}`}
          style={phoneMetrics.isDesktop
            ? { height: `${phoneMetrics.height}px`, width: `${phoneWidth}px`, transform: `translateY(${phoneMetrics.yOffset}px)` }
            : { top: `${phoneMetrics.top}px`, height: `${phoneMetrics.height}px`, width: `${phoneWidth}px` }
          }
        >

          <SplinePhone
            className="h-full w-full"
            style={phoneMetrics.isDesktop ? undefined : { transform: `translateY(-${phoneMetrics.yOffset}px)` }}
            zoom={phoneMetrics.zoom}
            active={active}
          />
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HeroIntroStage — Native scroll, inga hijacks.
// Hero ligger som en vanlig 100svh-sektion. Intro ligger som en egen
// fullhöjds-sektion direkt under och fadar/slidar in via framer-motion
// `whileInView`. Telefonen (FixedPhoneLayer) hittar fortfarande hero via
// data-hero-intro-stage och döljs när användaren scrollar förbi.
// ─────────────────────────────────────────────────────────────────────────────
const HeroIntroStage = ({ c, onIntroCta, introCtaLabel }: HeroIntroStageProps) => {
  const mobileHeroMinHeight = useMobileHeroMinHeight();
  const isMobileLikeHeroLayout = useIsMobileLikeHeroLayout();
  const heroSafeTopPx = useHeroSafeTopPadding();


  return (
    <>
      {/* ─────────── HERO ─────────── */}
      <section
        data-hero-intro-stage
        className={`relative min-h-[100svh] w-full ${isMobileLikeHeroLayout ? 'overflow-visible' : 'overflow-visible md:h-[100svh] md:min-h-0 md:overflow-hidden'}`}
      >
        {/* Mobile hero */}
        <section
          data-mobile-hero-section
          className={`relative min-h-[100svh] w-screen overflow-hidden ${isMobileLikeHeroLayout ? 'block' : 'md:hidden'}`}
          style={{
            marginLeft: 'calc(50% - 50vw)',
            marginRight: 'calc(50% - 50vw)',
            minHeight: mobileHeroMinHeight ? `${mobileHeroMinHeight}px` : undefined,
          }}
          aria-labelledby="audience-hero-heading-mobile"
        >
          <motion.div
            data-hero-phone-anchor
            className="pointer-events-none relative z-10 mx-auto flex w-full max-w-[1180px] flex-col items-center px-5 text-center"
            style={heroSafeTopPx ? { paddingTop: `${heroSafeTopPx}px` } : undefined}
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.18, delayChildren: 0.2 } } }}
          >
            <HeroText
              eyebrow={c.eyebrow}
              headline={c.hero.headline}
              subtitle={c.hero.subtitle}
              variant="mobile"
              headingId="audience-hero-heading-mobile"
            />
          </motion.div>
          <InlineHeroPhone placement="mobile" className="mt-2" />
        </section>

        {/* Desktop / tablet hero */}
        <section className={`relative h-full items-center justify-center overflow-hidden pb-16 pt-28 ${isMobileLikeHeroLayout ? 'hidden' : 'hidden md:flex md:[@media_(orientation:portrait)]:items-start md:[@media_(orientation:portrait)]:pt-[clamp(7rem,12svh,9rem)] lg:[@media_(orientation:portrait)]:items-center lg:[@media_(orientation:portrait)]:pt-28'}`}>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -top-40 right-[-25%] h-[640px] w-[640px] rounded-full bg-secondary/[0.06] blur-[180px]"
            animate={{ opacity: [0.5, 0.75, 0.5] }}
            transition={{ duration: 9, ease: 'easeInOut', repeat: Infinity }}
          />
          <div className="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-[minmax(0,1.1fr)_minmax(220px,0.9fr)] items-start gap-10 px-3 sm:px-5 md:px-6 md:[@media_(orientation:portrait)]:block lg:grid-cols-2 lg:gap-16 lg:px-24 lg:[@media_(orientation:portrait)]:grid">
            <motion.div
              data-hero-phone-anchor
              className="-translate-y-8 pt-8 text-left md:[@media_(orientation:portrait)]:mx-auto md:[@media_(orientation:portrait)]:max-w-[min(92vw,54rem)] md:[@media_(orientation:portrait)]:translate-y-0 md:[@media_(orientation:portrait)]:pt-0 md:[@media_(orientation:portrait)]:text-center min-[1100px]:-translate-y-16 xl:pt-10 lg:[@media_(orientation:portrait)]:mx-0 lg:[@media_(orientation:portrait)]:max-w-none lg:[@media_(orientation:portrait)]:-translate-y-8 lg:[@media_(orientation:portrait)]:pt-8 lg:[@media_(orientation:portrait)]:text-left"
              style={{ paddingLeft: 'var(--logo-ring-offset, 26px)', paddingRight: 'var(--logo-ring-offset, 26px)' }}
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.18, delayChildren: 0.1 } } }}
            >
              <HeroText eyebrow={c.eyebrow} headline={c.hero.headline} subtitle={c.hero.subtitle} variant="desktop" />
            </motion.div>
            <div aria-hidden className="relative mx-auto flex w-full items-start justify-center pt-8 xl:pt-10">
              <InlineHeroPhone placement="portraitTablet" />
            </div>
          </div>
        </section>
      </section>

      {/* ─────────── INTRO ─────────── */}
      <section
        aria-label="Introduktion"
        className="relative flex w-full items-center justify-center overflow-hidden px-5 pb-8 pt-2 sm:px-6 sm:pb-10 sm:pt-10 md:px-12 md:pb-12 md:pt-16 lg:px-24"
      >
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
          transition={{ duration: 1, ease }}
          className="relative z-10 flex max-w-4xl flex-col items-center text-center"
        >
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
            transition={{ duration: 1.1, ease, delay: 0.05 }}
            className="wave-text mb-5 max-w-[min(92vw,52rem)] text-[3.25rem] font-black leading-[1.04] tracking-[-0.025em] sm:mb-8 sm:text-[clamp(2.75rem,4.4vw,4.75rem)]"
          >
            Vi har gjort det enkelt för alla!
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } } }}
          >
            <IntroText
              paragraphs={[
                'Med Parium hittar du jobbannonser från arbetsgivare över hela Sverige. Du ansöker snabbt och smidigt direkt i appen eller på webben.',
                'Ditt CV och din profil sparas på ett och samma ställe, vilket gör det enkelt att söka flera jobb utan att behöva fylla i samma information varje gång.',
                'I nästa sektion ser du olika exemplar på yrken som tar Sverige framåt!',
              ]}
            />
          </motion.div>
          {onIntroCta && (
            <motion.button
              type="button"
              onClick={onIntroCta}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
              transition={{ duration: 0.8, ease, delay: 0.15 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="mt-16 inline-flex items-center justify-center rounded-full bg-secondary px-8 py-4 text-base font-semibold text-white transition-colors duration-200 hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary sm:mt-20 sm:text-lg"
            >
              {introCtaLabel ?? 'Skapa min profil idag'}
            </motion.button>
          )}
        </motion.div>
      </section>
    </>
  );
};



const AudienceLanding = ({ audience }: AudienceLandingProps) => {
  const navigate = useNavigate();
  const c = audienceContent[audience];
  const isMobileFeatureMotion = useIsMobileLandingMotion();

  // Mobil: trigga `.landing-feature-mobile-in` när de scrollas in.
  // Header-elementen (eyebrow/h2/p) animeras direkt vid mount; korten
  // animeras när användaren faktiskt når sektionen så att slide-in
  // från sidorna upplevs i takt med scrollen.
  useEffect(() => {
    if (!isMobileFeatureMotion) return;
    const roots = document.querySelectorAll('[data-mobile-feature-prearm]');
    if (!roots.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in-view');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    );
    roots.forEach((root) => {
      const headers = root.querySelectorAll(':scope > .landing-feature-mobile-in');
      headers.forEach((el) => el.classList.add('is-in-view'));
      const cards = root.querySelectorAll('.landing-feature-card.landing-feature-mobile-in');
      cards.forEach((el) => io.observe(el));
    });
    return () => io.disconnect();
  }, [isMobileFeatureMotion]);

  useWaveAwareText();

  // Native scroll på /jobbsokare — inga scroll-hijacks, inga snap-låsningar.
  // Hjul/touch beter sig 1:1 som på en vanlig premium-sajt. Sektioners
  // entry-animationer drivs av framer-motion `whileInView`.



  // Premium-prefetch: när användaren landat och tråden är ledig, ladda
  // /auth-route-chunken i bakgrunden så att "Skapa min profil"-CTA känns instant.
  // Helt osynligt — bara modul-prefetch, ingen render, ingen state-mutation.
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idle: (cb: () => void) => number =
      typeof w.requestIdleCallback === 'function'
        ? (cb) => w.requestIdleCallback(cb, { timeout: 2500 })
        : (cb) => window.setTimeout(cb, 1800);
    const cancel: (id: number) => void =
      typeof w.cancelIdleCallback === 'function' ? w.cancelIdleCallback : window.clearTimeout;

    const handle = idle(() => {
      // Prefetcha /auth-chunken tyst. Fel slukas — det är ren optimering.
      import('@/pages/Auth').catch(() => {});
    });
    return () => cancel(handle);
  }, []);

  useEffect(() => {
    syncBrowserChrome(window.location.pathname);

    const isSeeker = audience === 'job_seeker';
    const title = isSeeker
      ? 'Hitta jobb som passar dig | Parium – för jobbsökare'
      : 'Hitta rätt kandidater snabbt | Parium – för arbetsgivare';
    const description = isSeeker
      ? 'Slipp långa formulär. Bygg en profil som visar mer än ett CV och få relevanta jobb först. Gratis för jobbsökare i Sverige.'
      : 'Hitta rätt kandidater på sekunder. Publicera jobb, matcha smart och anställ snabbare med Parium – rekrytering i en ny generation.';
    const url = isSeeker ? 'https://parium.se/jobbsokare' : 'https://parium.se/arbetsgivare';

    document.title = title;

    const setMeta = (name: string, content: string, attr = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('description', description);
    setMeta('og:title', title, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:url', url, 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;
  }, [audience]);

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };
  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role: audience } });
  };

  const navLinks: LandingNavLink[] = [
    { label: 'Så funkar det', href: '#sa-funkar-det' },
    { label: 'Funktioner', href: '#funktioner' },
    { label: 'Priser', href: '#priser' },
    { label: 'Vanliga frågor', href: '#faq' },
    { label: 'Kontakt', href: '#kontakt' },
  ];

  return (
    <>
    <AudienceSEO audience={audience} />
    <div
      data-landing-scroll-root
      className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden bg-primary text-primary-foreground"
      style={{
        overscrollBehavior: 'none',
        // -webkit-overflow-scrolling: touch ger iOS Safari momentum-scroll
        // i fixed-containrar; utan denna känns 2↔3-overgången "stelare" på
        // iPhone/iPad jämfört med desktop. scrollBehavior: 'smooth' säkrar
        // att Android Chrome och Firefox använder samma native easing som
        // Safari för scrollTo(..., {behavior: 'smooth'}).
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'smooth',
        backgroundImage:
          'linear-gradient(180deg, hsl(215 80% 22%) 0%, hsl(var(--primary)) 100%)',
        backgroundAttachment: 'scroll',
        backgroundSize: '100% 100svh',
        backgroundRepeat: 'no-repeat',
        backgroundColor: 'hsl(var(--primary))',
      }}
    >
      <AnimatedBackground showGlow={true} />
      <FixedPhoneLayer />
      <div className="relative z-10 min-h-full">
        <LandingNav onLoginClick={handleLogin} links={navLinks} />


        <main>
          <HeroIntroStage c={c} onIntroCta={handleStart} introCtaLabel="Skapa min profil idag" />


          {/* ──────────────── 2. SÅ FUNKAR DET (pinned headline → horisontell mediestrip) ──────────────── */}
          <section id="sa-funkar-det" aria-labelledby="sa-funkar-det-heading" className="scroll-mt-24">
            <h2 id="sa-funkar-det-heading" className="sr-only">Så funkar det</h2>
            <PinnedHorizontalGallery />
          </section>

          {/* ──────────────── 3. STATEMENT ──────────────── */}
          <section className="relative overflow-hidden px-5 py-8 sm:px-6 sm:py-12 md:px-12 md:py-16 lg:px-24">
            <div className="mx-auto grid max-w-[1180px] gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-end">
              <motion.h2
                initial={{ opacity: 0, x: -80 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                transition={{ duration: 1, ease }}
                className="wave-text text-4xl font-black leading-[1.02] tracking-[0] sm:text-5xl md:text-6xl lg:text-[4.75rem]"
              >
                En lugnare väg till nästa steg.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, x: 80 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                transition={{ duration: 1, ease, delay: 0.1 }}
                className="wave-text text-base leading-8 opacity-70 sm:text-lg"
              >
                Platshållartext. Här kan en lugnare brödtext landa efter den intensiva resan — rytm är viktigt.
              </motion.p>
            </div>
          </section>

          {/* ──────────────── FUNKTIONER ──────────────── */}
          {isMobileFeatureMotion && (
            <style>{`
              @keyframes landingFeatureMobileIn {
                0% { opacity: 0; transform: translate3d(var(--lf-x, 0), var(--lf-y, 18px), 0); filter: blur(6px); }
                100% { opacity: 1; transform: translate3d(0, 0, 0); filter: blur(0); }
              }
              [data-mobile-feature-prearm] .landing-feature-mobile-in {
                opacity: 0;
                transform: translate3d(var(--lf-x, 0), var(--lf-y, 18px), 0);
              }
              [data-mobile-feature-prearm] .landing-feature-mobile-in.is-in-view {
                animation: landingFeatureMobileIn 760ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
                animation-delay: var(--lf-delay, 0ms);
              }
              [data-mobile-feature-prearm] .landing-feature-card {
                backdrop-filter: none;
                -webkit-backdrop-filter: none;
              }
            `}</style>
          )}

          <section id="funktioner" aria-labelledby="funktioner-heading" className="relative scroll-mt-24 overflow-hidden px-5 py-14 sm:px-6 sm:py-16 md:px-12 md:py-20 lg:px-24">
            <div className="mx-auto max-w-[1180px]" data-mobile-feature-prearm={isMobileFeatureMotion ? true : undefined}>
              <motion.span
                initial={isMobileFeatureMotion ? false : { opacity: 0, x: -40 }}
                whileInView={isMobileFeatureMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                transition={{ duration: 0.7, ease }}
                className="landing-feature-mobile-in block text-xs font-bold uppercase tracking-[0.32em] text-secondary/85"
                style={isMobileFeatureMotion ? { ['--lf-x' as string]: '-40px', ['--lf-y' as string]: '0px', ['--lf-delay' as string]: '120ms' } : undefined}
              >
                Funktioner
              </motion.span>
              <motion.h2
                id="funktioner-heading"
                initial={isMobileFeatureMotion ? false : { opacity: 0, x: -60 }}
                whileInView={isMobileFeatureMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                transition={{ duration: 0.9, ease, delay: 0.05 }}
                className="landing-feature-mobile-in wave-text mt-4 max-w-3xl text-4xl font-black leading-[1.04] tracking-[0] sm:text-5xl md:text-6xl"
                style={isMobileFeatureMotion ? { ['--lf-x' as string]: '-60px', ['--lf-y' as string]: '0px', ['--lf-delay' as string]: '180ms' } : undefined}
              >
                Allt du behöver för att {audience === 'job_seeker' ? 'hitta rätt jobb' : 'hitta rätt person'}.
              </motion.h2>
              <motion.p
                initial={isMobileFeatureMotion ? false : { opacity: 0, x: 60 }}
                whileInView={isMobileFeatureMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                transition={{ duration: 0.9, ease, delay: 0.15 }}
                className="landing-feature-mobile-in wave-text mt-6 max-w-2xl text-base leading-8 opacity-70 sm:text-lg"
                style={isMobileFeatureMotion ? { ['--lf-x' as string]: '60px', ['--lf-y' as string]: '0px', ['--lf-delay' as string]: '260ms' } : undefined}
              >
                Platshållartext för funktionsöversikten — fyll med de viktigaste fördelarna.
              </motion.p>
              <motion.div
                initial={isMobileFeatureMotion ? false : "hidden"}
                whileInView={isMobileFeatureMotion ? undefined : "visible"}
                viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }}
                className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              >
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <motion.div
                    key={i}
                    variants={{
                      hidden: { opacity: 0, y: 18, filter: 'blur(6px)' },
                      visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.75, ease } },
                    }}
                    style={isMobileFeatureMotion ? { ['--lf-x' as string]: i % 2 === 1 ? '-48px' : '48px', ['--lf-y' as string]: '0px', ['--lf-delay' as string]: `${(i - 1) * 90}ms`, willChange: 'auto' } : { willChange: 'opacity, transform' }}
                    className="landing-feature-card landing-feature-mobile-in group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.035] p-7 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:border-white/[0.14] hover:bg-white/[0.06] hover:shadow-[0_30px_80px_-30px_hsl(var(--secondary)/0.4)]"
                  >
                    <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,hsl(var(--secondary)/0.12),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
                      <span className="text-sm font-bold">0{i}</span>
                    </div>
                    <h3 className="wave-text text-lg font-bold">Funktion {i}</h3>
                    <p className="wave-text mt-2 text-sm leading-7 opacity-70">
                      Platshållartext som beskriver funktionen kort och tydligt.
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          

          <div className="relative z-10 -mt-px text-white">
          {/* ──────────────── PRISER ──────────────── */}
          <section id="priser" aria-labelledby="priser-heading" className="relative scroll-mt-24 overflow-hidden px-5 pb-16 pt-12 sm:px-6 md:px-12 md:pb-20 md:pt-16 lg:px-24">
            <div className="mx-auto max-w-[1180px]" data-mobile-feature-prearm={isMobileFeatureMotion ? true : undefined}>
              <motion.span
                initial={isMobileFeatureMotion ? false : { opacity: 0, x: -40 }}
                whileInView={isMobileFeatureMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                transition={{ duration: 0.7, ease }}
                className="landing-feature-mobile-in block text-xs font-bold uppercase tracking-[0.32em] text-secondary/85"
                style={isMobileFeatureMotion ? { ['--lf-x' as string]: '-40px', ['--lf-y' as string]: '0px', ['--lf-delay' as string]: '120ms' } : undefined}
              >
                Priser
              </motion.span>
              <motion.h2
                id="priser-heading"
                initial={isMobileFeatureMotion ? false : { opacity: 0, x: -60 }}
                whileInView={isMobileFeatureMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                transition={{ duration: 0.9, ease, delay: 0.05 }}
                className="landing-feature-mobile-in mt-4 max-w-2xl text-4xl font-black leading-[1.04] tracking-[-0.03em] text-white sm:text-5xl md:text-6xl"
                style={isMobileFeatureMotion ? { ['--lf-x' as string]: '-60px', ['--lf-y' as string]: '0px', ['--lf-delay' as string]: '180ms' } : undefined}
              >
                {audience === 'job_seeker' ? 'Gratis för dig som söker jobb.' : 'Transparenta priser. Inga överraskningar.'}
              </motion.h2>
              <motion.p
                initial={isMobileFeatureMotion ? false : { opacity: 0, x: 60 }}
                whileInView={isMobileFeatureMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                transition={{ duration: 0.9, ease, delay: 0.15 }}
                className="landing-feature-mobile-in mt-6 max-w-xl text-base leading-8 text-white/70 sm:text-lg"
                style={isMobileFeatureMotion ? { ['--lf-x' as string]: '60px', ['--lf-y' as string]: '0px', ['--lf-delay' as string]: '260ms' } : undefined}
              >
                Platshållartext för prismodellen. Lägg in planer eller "från X kr/mån".
              </motion.p>
              <motion.div
                initial={isMobileFeatureMotion ? false : "hidden"}
                whileInView={isMobileFeatureMotion ? undefined : "visible"}
                viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }}
                className="mt-8 grid gap-5 md:grid-cols-2"
              >
                {['Start', 'Premium'].map((plan, i) => (
                  <motion.div
                    key={plan}
                    variants={{
                      hidden: { opacity: 0 },
                      visible: { opacity: 1, transition: { duration: 0.9, ease } },
                    }}
                    style={isMobileFeatureMotion ? { ['--lf-x' as string]: i % 2 === 1 ? '48px' : '-48px', ['--lf-y' as string]: '0px', ['--lf-delay' as string]: `${i * 90}ms`, willChange: 'auto' } : { willChange: 'opacity, transform' }}
                    className={`landing-feature-card landing-feature-mobile-in relative overflow-hidden rounded-3xl border p-8 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 ${
                      i === 1
                        ? 'border-secondary/40 bg-gradient-to-br from-secondary/20 to-white/5 shadow-[0_30px_80px_-30px_hsl(var(--secondary)/0.35)]'
                        : 'border-white/15 bg-white/5 hover:border-secondary/25'
                    }`}
                  >
                    {i === 1 && (
                      <span className="absolute right-6 top-6 rounded-full bg-secondary/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                        Populär
                      </span>
                    )}
                    <h3 className="text-xl font-bold text-white">{plan}</h3>
                    <p className="mt-2 text-3xl font-black text-white">— kr<span className="text-sm font-medium text-white/70">/mån</span></p>
                    <p className="mt-4 text-sm leading-7 text-white/70">Platshållare för planbeskrivning.</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          {/* ──────────────── FAQ ──────────────── */}
          <section id="faq" aria-labelledby="faq-heading" className="relative scroll-mt-24 overflow-hidden px-5 py-14 sm:px-6 sm:py-16 md:px-12 md:py-20 lg:px-24">
            <div className="mx-auto max-w-[880px]">
              <motion.div
                initial={{ opacity: 0, x: -60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                transition={{ duration: 0.9, ease }}
              >
                <span className="text-xs font-bold uppercase tracking-[0.32em] text-secondary/85">Vanliga frågor</span>
                <SplitHeadline
                  as="h2"
                  text="Frågor & svar"
                  className="mt-4 text-4xl font-black leading-[1.04] tracking-[-0.03em] text-white sm:text-5xl"
                />
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } } }}
                className="mt-10 space-y-3"
              >
                {['Hur fungerar Parium?', 'Vad kostar det?', 'Är mina uppgifter säkra?', 'Vilka företag finns här?'].map((q) => (
                  <motion.details
                    key={q}
                    variants={{
                      hidden: { opacity: 0, x: 60 },
                      visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease } },
                    }}
                    className="group rounded-2xl border border-white/15 bg-white/5 px-6 py-5 backdrop-blur-xl transition-colors hover:border-secondary/25"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between text-base font-semibold text-white">
                      {q}
                      <span className="ml-4 text-secondary transition-transform duration-300 group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-4 text-sm leading-7 text-white/70">
                      Platshållarsvar — fyll på med den faktiska informationen.
                    </p>
                  </motion.details>
                ))}
              </motion.div>
            </div>
          </section>

          {/* ──────────────── KONTAKT ──────────────── */}
          <section
            id="kontakt"
            aria-labelledby="kontakt-heading"
            className="relative scroll-mt-24 overflow-hidden px-5 py-14 sm:px-6 sm:py-16 md:px-12 md:py-20 lg:px-24"
            style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 600px' }}
          >
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
              transition={{ duration: 0.9, ease }}
              className="mx-auto max-w-[920px] text-center"
            >
              <span className="text-xs font-bold uppercase tracking-[0.32em] text-secondary/85">Kontakt</span>
              <SplitHeadline
                as="h2"
                text="Vi finns här för dig."
                emphasizeLast
                className="mt-4 text-4xl font-black leading-[1.04] tracking-[-0.03em] text-white sm:text-5xl"
              />
              <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-white/70 sm:text-lg">
                Hör av dig så svarar vi snabbt — vi hjälper både kandidater och arbetsgivare.
              </p>
              <a
                href="mailto:hej@parium.se"
                className="mt-8 inline-block text-lg font-semibold text-secondary underline-offset-4 hover:underline"
              >
                hej@parium.se
              </a>
            </motion.div>
          </section>
          </div>
            {/* ──────────────── 4. BOUNCY FOOTER CTA ──────────────── */}
            <BouncyFooter audience={audience} onCta={handleStart} />

        </main>
      </div>
    </div>
    </>
  );
};

export default AudienceLanding;
