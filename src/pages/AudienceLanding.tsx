import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useNavigationType } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import LandingNav, { type LandingNavLink } from '@/components/LandingNav';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { syncBrowserChrome } from '@/lib/browserChrome';

import WaveDivider from '@/components/landing/WaveDivider';
import SplitHeadline from '@/components/landing/audience/SplitHeadline';
import { audienceContent, type AudienceRole } from '@/components/landing/audience/content';
import { SplinePhone } from '@/components/landing/SplinePhone';
import EmployerJourney from '@/components/landing/audience/EmployerJourney';
import { HeroText } from '@/components/landing/audience/HeroText';
import { AudienceSEO } from '@/components/seo/AudienceSEO';
import pariumLogoRings from '@/assets/parium-logo-rings.png';
import { preloadAudienceLandingAssets } from '@/lib/audienceLandingPreload';
import { AppBadges } from '@/components/landing/AppBadges';
import { prefersStaticGlass } from '@/lib/videoPlatform';

// Under-fold sektioner — lata in för att korta första paint.
// Preloadas via requestIdleCallback så de är redo innan användaren scrollar dit.
const PinnedHorizontalGallery = lazy(() => import('@/components/landing/audience/PinnedHorizontalGallery'));
const BouncyFooter = lazy(() => import('@/components/landing/audience/BouncyFooter'));
const SiteFooter = lazy(() => import('@/components/landing/SiteFooter'));
const JobSeekerVideoShowcase = lazy(() => import('@/components/landing/audience/JobSeekerVideoShowcase'));




type AudienceLandingProps = {
  audience: AudienceRole;
};

const ease = [0.16, 1, 0.3, 1] as const;

function FaqAccordion({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/5 transition-colors hover:border-secondary/25 [@media_(hover:hover)]:backdrop-blur-xl">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[56px] cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left text-base font-semibold text-white"
      >
        <span>{q}</span>
        <motion.span
          className="ml-4 text-secondary text-xl leading-none flex-shrink-0"
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.35, ease }}
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.45, ease },
              opacity: { duration: 0.3, ease, delay: open ? 0.08 : 0 },
            }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-6 text-sm leading-7 text-white">
              <span className="font-semibold text-secondary">Svar: </span>
              {a.split('parium.se/dpa').map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <Link
                      to="/dpa"
                      className="font-semibold text-secondary underline underline-offset-2 transition hover:text-secondary/80"
                    >
                      parium.se/dpa
                    </Link>
                  )}
                </span>
              ))}
            </p>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlanFeatures({
  features,
  isActive,
  open: openProp,
  onToggle,
}: {
  features: string[];
  isActive: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const handleToggle = () => {
    // Håll det klickade kortet stilla i viewporten medan andra kort
    // ovanför/under expanderar eller fälls ihop.
    const card = buttonRef.current?.closest('.landing-feature-card') as HTMLElement | null;
    keepElementAnchored(card ?? buttonRef.current, 800);
    if (isControlled) {
      onToggle?.();
    } else {
      setInternalOpen((v) => !v);
    }
  };
  return (
    <div className="mt-6 border-t border-white/10 pt-5">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        onClick={handleToggle}
        className="flex w-full min-h-[44px] cursor-pointer items-center justify-between text-sm font-semibold text-white"
      >

        <span>Se alla funktioner</span>
        <motion.span
          className="ml-4 text-secondary"
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.35, ease }}
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.45, ease },
              opacity: { duration: 0.3, ease, delay: open ? 0.08 : 0 },
            }}
            className="overflow-hidden"
          >
            <motion.ul
              className="mt-4 space-y-3"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.045, delayChildren: 0.08 } },
              }}
            >
              {features.map((feature) => (
                <motion.li
                  key={feature}
                  variants={{
                    hidden: { opacity: 0, y: -6 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease } },
                  }}
                  className="flex items-start gap-3 text-sm leading-6 text-white"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className={`mt-0.5 h-4 w-4 flex-shrink-0 ${isActive ? 'text-secondary' : 'text-white/70'}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="4 10 8.5 14.5 16 6.5" />
                  </svg>
                  <span>{feature}</span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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

/**
 * Markerar dokumentet med data-glass="static" på plattformar där
 * backdrop-filter är dyrt (Windows/integrerad GPU). CSS:en i index.css byter
 * då ut blurren mot en tätare, statisk yta — samma glaskänsla, utan att
 * kompositorn måste räkna om suddningen varje scroll-frame.
 */
const useAdaptiveGlass = () => {
  useEffect(() => {
    if (!prefersStaticGlass()) return;
    document.documentElement.dataset.glass = 'static';
    return () => {
      delete document.documentElement.dataset.glass;
    };
  }, []);
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
  return window.matchMedia('(max-width: 767px), (pointer: coarse) and (orientation: portrait) and (max-width: 1024px)').matches;
};

const useIsMobileLandingMotion = () => {
  const [isMobile, setIsMobile] = useState(isMobileAnimationPrearmed);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px), (pointer: coarse) and (orientation: portrait) and (max-width: 1024px)');
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, []);

  return isMobile;
};



const IntroText = ({ paragraphs, align = 'center' }: { paragraphs: string[]; align?: 'center' | 'start' }) => (
  <div className={`max-w-3xl text-center text-base leading-[1.6] sm:text-lg sm:leading-[1.75] md:text-xl md:[@media_(orientation:portrait)]:text-2xl md:[@media_(orientation:portrait)]:leading-9 md:[@media_(orientation:portrait)]:max-w-[640px] ${align === 'start' ? 'md:text-left' : ''}`}>
    {paragraphs.map((paragraph, pIdx) => (
      <p key={pIdx} className={`wave-text ${pIdx > 0 ? 'mt-3 sm:mt-6' : ''}`.trim()}>
        {paragraph}
      </p>
    ))}
  </div>
);

type HeroIntroStageProps = {
  c: (typeof audienceContent)[AudienceRole];
  audience: AudienceRole;
  onIntroCta?: () => void;
  introCtaLabel?: string;
};

const PHONE_ASPECT = 9 / 19.5;

/**
 * Video-mockupens FAKTISKA höjd/bredd-förhållande (hela chassit, inte skärmen).
 *
 * Härlett ur JobSeekerVideoShowcase: skärmen är 9/19.5 (2.1667) och sitter i en
 * svart ram med 2.6 % padding, som i sin tur ligger i ett titanchassi.
 *   höjd ≈ bredd × 0.948 × 2.1667 + bredd × 0.052 ≈ bredd × 2.106
 *
 * Detta MÅSTE matcha komponenten exakt — är värdet för lågt räknas telefonen
 * som kortare än den ritas och överkanten/underkanten klipps av hero-boxen.
 */
const VIDEO_PHONE_BODY_RATIO = 2.106;

/** Deterministisk bredd på hero-videotelefonen (desktop/iPad). */
const heroVideoPhoneWidth = (viewportWidth: number) =>
  Math.round(Math.max(184, Math.min(viewportWidth * 0.185, 244)));


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




// Vilken telefonvariant hero använder just nu (video för jobbsökare, Spline för
// arbetsgivare). Sätts av HeroIntroStage så att alla mätfunktioner – även de som
// körs utanför React-trädet – räknar på rätt mockup.
let currentHeroPhoneVariant: 'spline' | 'video' = 'spline';

const calculateInlinePhoneMetrics = (variant: 'spline' | 'video' = currentHeroPhoneVariant) => {
  if (typeof window === 'undefined') {
    return { height: 320, width: 320 * PHONE_ASPECT, zoom: 0.44, yOffset: 28 };
  }

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const { width, height } = getViewportSize();
  const placement = getInlinePhonePlacement();
  const isPortraitTablet = placement === 'portraitTablet';

  // Video-mockupen är en ren DOM-telefon: den fyller hela sin box (ingen
  // Spline-canvas med luft runt om). Därför får den egna mått – annars blir den
  // dramatiskt större än Spline-telefonen och klipps mot viewportens botten.
  if (variant === 'video') {
    const bottomSafe = clamp(height * 0.05, 28, 60);
    if (isPortraitTablet) {
      const w = Math.round(clamp(width * 0.3, 200, 268));
      const h = w * VIDEO_PHONE_BODY_RATIO;
      return {
        height: h,
        width: w,
        canvasHeight: h,
        canvasBottomTrim: 0,
        zoom: 0,
        topGap: clamp(height * 0.03, 16, 40),
      };
    }
    const anchorEl = document.querySelector('[data-mobile-hero-section] [data-hero-phone-anchor]') as HTMLElement | null;
    const heroEl = document.querySelector('[data-mobile-hero-section]') as HTMLElement | null;
    const tBottom = anchorEl && heroEl
      ? anchorEl.getBoundingClientRect().bottom - heroEl.getBoundingClientRect().top
      : height * 0.45;
    const available = Math.max(220, height - tBottom - bottomSafe);
    // Bredden är deterministisk (samma viewport ⇒ samma telefon), höjden följer.
    let w = Math.round(clamp(width * 0.46, 150, 208));
    let h = w * VIDEO_PHONE_BODY_RATIO;
    if (h > available * 0.9) {
      h = available * 0.9;
      w = Math.round(h / VIDEO_PHONE_BODY_RATIO);
    }
    return {
      height: h,
      width: w,
      canvasHeight: h,
      canvasBottomTrim: 0,
      zoom: 0,
      topGap: Math.max(clamp(height * 0.025, 16, 34), (available - h) / 2),
    };
  }


  const isWideInlineMobile = !isPortraitTablet && width >= 520;

  const mobileTextReserve = clamp(height * 0.49, 330, 430);
  const mobileBottomReserve = clamp(height * 0.09, 58, 86);
  const mobileAvailableHeight = Math.max(240, height - mobileTextReserve - mobileBottomReserve);
  const rawHeight = isPortraitTablet
    ? clamp(height * 0.46, 380, 580)
    : isWideInlineMobile
      ? clamp(Math.min(height * 0.54, mobileAvailableHeight + clamp(height * 0.18, 110, 180)), 360, 520)
      : clamp(Math.min(height * 0.43, mobileAvailableHeight + 32), 270, 370);
  const maxPhoneWidth = isPortraitTablet
    ? Math.min(width * 0.40, 320)
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

const InlineHeroPhone = ({
  placement,
  className = '',
  variant = 'spline',
}: { placement: 'mobile' | 'portraitTablet'; className?: string; variant?: 'spline' | 'video' }) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(() => getInlinePhonePlacement() === placement);
  const [active, setActive] = useState(() => getInlinePhonePlacement() === placement);
  const [metrics, setMetrics] = useState(() => calculateInlinePhoneMetrics(variant));

  

  useEffect(() => {
    const sync = () => {
      setEnabled(getInlinePhonePlacement() === placement);
      setMetrics(calculateInlinePhoneMetrics(variant));
    };


    sync();
    window.addEventListener('resize', sync, { passive: true });
    window.visualViewport?.addEventListener('resize', sync, { passive: true });
    return () => {
      window.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('resize', sync);
    };
  }, [placement, variant]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !enabled) {
      setActive(false);
      return;
    }

    const root = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting && entry.intersectionRatio > 0.01),
      // rootMargin 0: WebGL-scenen ska inte rendera innan den faktiskt syns —
      // annars konkurrerar den med hero-videons avkodning på svaga GPU:er.
      { root, threshold: [0, 0.01, 0.25] },
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
      {variant === 'video' ? (
        <Suspense fallback={null}>
          <JobSeekerVideoShowcase instant widthPx={metrics.width} />
        </Suspense>
      ) : (
        <SplinePhone
          className="h-full w-full"
          zoom={metrics.zoom}
          active={enabled && active}
        />
      )}
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

type HeroPhoneMetrics = {
  isDesktop: boolean;
  isPortraitTablet?: boolean;
  pinToViewport?: boolean;
  /** Höjden är redan den exakta visuella höjden – ingen variant-nedskalning. */
  exactHeight?: boolean;
  right?: string;
  top: number;
  height: number;
  /** Explicit bredd (video-mockupen): sätts deterministiskt, inte via PHONE_ASPECT. */
  width?: number;

  canvasHeight?: number;
  zoom: number;
  yOffset: number;
};


const FixedPhoneLayer = ({ variant = 'spline' }: { variant?: 'spline' | 'video' }) => {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  
  const lastHeroMetricsRef = useRef<HeroPhoneMetrics | null>(null);
  const getVisibleAnchor = () => {
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const anchors = Array.from(document.querySelectorAll('[data-hero-phone-anchor]')) as HTMLElement[];
    return anchors.find((anchor) => {
      const rect = anchor.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < viewportHeight;
    }) ?? null;
  };
  const calculatePhoneMetrics = (): HeroPhoneMetrics => {
    if (typeof window === 'undefined') return { isDesktop: true, top: 0, height: 660, zoom: 0.68, yOffset: 0 };
    if (lastHeroMetricsRef.current && !document.querySelector('[data-hero-intro-stage]')) return lastHeroMetricsRef.current;
    const width = window.visualViewport?.width ?? window.innerWidth;
    const height = window.visualViewport?.height ?? window.innerHeight;

    const isCoarse = typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
    const isPortraitTablet = width >= 768 && width < 1180 && height > width;
    // iPad / surfplatta i LIGGANDE läge: bred touch-enhet med begränsad höjd.
    // Täcker iPad mini → iPad Pro 12.9" (1366×1024) samt Android-tablets upp
    // till ~1600px breda. Vi använder pointer:coarse + landskap som signal
    // så att vanliga laptops aldrig råkar in i den här grenen.
    const isLandscapeTablet = isCoarse && width >= 900 && width <= 1400 && width > height && height <= 1050;

    // ── Video-mockup på desktop/iPad: STORLEKEN är deterministisk (härledd ur
    // viewportbredden), inte mätt ur textblocket. Textmätning gav olika höjd
    // beroende på när fonter/radbrytningar landade → telefonen kunde "hoppa"
    // i storlek mellan laddningar. Nu är bredden alltid densamma för en given
    // viewport och höjden följer chassits verkliga proportion.
    if (variant === 'video' && width >= 768) {
      const anchor = getVisibleAnchor();
      const stageTop = (document.querySelector('[data-hero-intro-stage]') as HTMLElement | null)
        ?.getBoundingClientRect().top ?? 0;
      const firstChild = anchor?.firstElementChild as HTMLElement | null;
      const lastChild = anchor?.lastElementChild as HTMLElement | null;
      const contentTop = firstChild ? firstChild.getBoundingClientRect().top - stageTop : null;
      const contentBottom = lastChild ? lastChild.getBoundingClientRect().bottom - stageTop : null;
      const rect = anchor?.getBoundingClientRect();
      const anchorTop = contentTop ?? (rect ? rect.top - stageTop : clamp(height * 0.24, 130, 300));
      const anchorHeight = contentTop != null && contentBottom != null
        ? contentBottom - contentTop
        : rect?.height ?? height * 0.46;

      const bottomSafe = clamp(height * 0.06, 40, 90);
      const available = Math.max(260, height - anchorTop - bottomSafe);

      // Bredd först — höjden är en ren följd av den.
      let phoneWidth = heroVideoPhoneWidth(width);
      let visualHeight = phoneWidth * VIDEO_PHONE_BODY_RATIO;
      if (visualHeight > available) {
        visualHeight = available;
        phoneWidth = Math.round(visualHeight / VIDEO_PHONE_BODY_RATIO);
      }

      const metrics: HeroPhoneMetrics = {
        isDesktop: true,
        pinToViewport: true,
        exactHeight: true,
        top: Math.round(anchorTop + Math.max(0, (Math.min(anchorHeight, available) - visualHeight) / 2)),
        height: visualHeight,
        width: phoneWidth,
        canvasHeight: visualHeight,
        zoom: 0,
        yOffset: 0,
        right: 'clamp(2rem, 11vw, 17rem)',
      };
      lastHeroMetricsRef.current = metrics;
      return metrics;
    }



    if (isLandscapeTablet) {
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Huvudnavigation"]');
      const navBottom = nav?.getBoundingClientRect().bottom ?? clamp(height * 0.12, 78, 112);
      const top = Math.ceil(navBottom + clamp(height * 0.06, 46, 68));
      const bottomSafe = clamp(height * 0.085, 64, 96);
      const safeCanvasHeight = Math.max(340, height - top - bottomSafe);
      const columnWidth = Math.min(width * 0.48, 620);
      const widthFitHeight = (columnWidth * 19.5) / 9;
      const safeHeight = Math.min(safeCanvasHeight, widthFitHeight, 760);
      const canvasHeadroom = clamp(safeHeight * 0.2, 96, 150);
      const metrics = {
        isDesktop: true,
        pinToViewport: true,
        top,
        height: safeHeight,
        canvasHeight: safeHeight + canvasHeadroom,
        // Spline-scenen klipper sin egen topp om zoom går för högt även när
        // DOM-lagret har fri yta. Det här taket är därför konservativt: stor
        // iPad-närvaro, men alltid hela telefonens topp/notch synlig.
        zoom: clamp((safeHeight / 460) * 0.52, 0.48, 0.68),
        yOffset: 0,
        right: 'clamp(2.5rem, 13vw, 13rem)',
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
      const canvasHeadroom = clamp(safeHeight * 0.2, 88, 150);
      const viewportScale = clamp(width / 1440, 0.72, isUltraDesktop ? 1.3 : isXLDesktop ? 1.18 : isLargeDesktop ? 1.08 : 1);
      // Telefonens topp ska linjera med rubrikens topp ("Hitta jobb"). Skalar med viewport-höjd
      // så att det håller från liten laptop upp till stor iMac/5K-skärm.
      const yOffset = isCompactLaptop
        ? clamp(height * 0.075, 52, 110)
        : clamp(height * 0.11, 84, 200);
      const zoomCap = isUltraDesktop ? 0.7 : isXLDesktop ? 0.62 : isLargeDesktop ? 0.56 : (isCompactLaptop ? 0.4 : 0.5);
      const metrics = {
        isDesktop: true,
        top: 0,
        height: safeHeight,
        canvasHeight: safeHeight + canvasHeadroom,
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
    // Live-spåra navbarens höjd — om Logga in-knappen wrappar, fonten laddar
    // sent eller språk byts kan navbarens bottom-koordinat ändras utan att
    // window resizes. Då måste vi räkna om phone top så telefonen aldrig
    // kapas av navbaren på iPad landscape.
    const navEl = document.querySelector('nav[aria-label="Huvudnavigation"]') as HTMLElement | null;
    const navObserver = navEl ? new ResizeObserver(syncPhoneMetrics) : null;
    if (navEl) navObserver?.observe(navEl);
    const mutationObserver = new MutationObserver(syncPhoneMetrics);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    document.fonts?.ready.then(syncPhoneMetrics).catch(() => undefined);
    window.addEventListener('resize', syncPhoneMetrics, { passive: true });
    window.visualViewport?.addEventListener('resize', syncPhoneMetrics, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer?.disconnect();
      navObserver?.disconnect();
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




  // Video-mockupen fyller hela sin box (till skillnad från Spline-canvasen som
  // har luft runt telefonen). Utan nedskalning blir den därför dubbelt så stor
  // som Spline-telefonen och klipps på iPad/laptop.
  const isVideoPhone = variant === 'video';
  const phoneVisualHeight = isVideoPhone && !phoneMetrics.exactHeight
    ? phoneMetrics.height * 0.62
    : phoneMetrics.height;

  const phoneWidth = phoneMetrics.width ?? phoneVisualHeight * PHONE_ASPECT;
  const phoneCanvasHeight = isVideoPhone ? phoneVisualHeight : (phoneMetrics.canvasHeight ?? phoneMetrics.height);
  const phoneCanvasLift = Math.max(0, (phoneCanvasHeight - phoneMetrics.height) / 2);

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
          className={`pointer-events-none transition-opacity duration-[700ms] ease-out ${visible ? 'opacity-100' : 'opacity-0'} ${phoneMetrics.pinToViewport ? 'fixed flex w-fit items-start justify-center' : phoneMetrics.isDesktop ? 'relative ml-auto mr-[clamp(2rem,8vw,8rem)] flex w-fit items-center justify-center' : 'absolute left-1/2 flex w-fit -translate-x-1/2 items-start justify-center'}`}
          style={phoneMetrics.pinToViewport
            ? { top: `${phoneMetrics.top - phoneCanvasLift}px`, right: phoneMetrics.right, height: `${phoneCanvasHeight}px`, width: `${phoneWidth}px` }
            : phoneMetrics.isDesktop
              ? { height: `${phoneCanvasHeight}px`, width: `${phoneWidth}px`, transform: `translateY(${phoneMetrics.yOffset - phoneCanvasLift}px)` }
              : { top: `${phoneMetrics.top}px`, height: `${phoneCanvasHeight}px`, width: `${phoneWidth}px` }
          }
        >
          {variant === 'video' ? (
            <div
              className="flex h-full w-full items-center justify-center"
              style={phoneMetrics.isDesktop ? undefined : { transform: `translateY(-${phoneMetrics.yOffset}px)` }}
            >
              <Suspense fallback={null}>
                <JobSeekerVideoShowcase instant widthPx={phoneWidth} active={active} />
              </Suspense>
            </div>
          ) : (
            <SplinePhone
              className="h-full w-full"
              style={phoneMetrics.isDesktop ? undefined : { transform: `translateY(-${phoneMetrics.yOffset}px)` }}
              zoom={phoneMetrics.zoom}
              active={active}
            />
          )}

        </div>
      </div>
    </div>
  );
};

/**
 * Subtil, animerad sektionslinje.
 * - Ritas ut från mitten när den scrollas in i vy (scaleX 0 → 1).
 * - En liten glödande prick pulserar i mitten.
 * - Ren visuell paus mellan sektioner utan att bryta det mörka djupet.
 */
const SectionDivider = ({ className = '' }: { className?: string }) => {
  // Lätt animation som fungerar identiskt på desktop och mobil.
  // Endast transform (scaleX) + opacity — GPU-billigt, ingen blur, ingen scroll-progress.
  return (
    <div className={`relative mx-auto flex w-full max-w-[1180px] items-center justify-center px-5 sm:px-6 md:px-12 lg:px-24 ${className}`}>
      <div className="relative flex w-full items-center justify-center">
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="h-px w-full origin-center bg-gradient-to-r from-transparent via-secondary/40 to-transparent"
          style={{ willChange: 'transform, opacity' }}
        />
        <motion.span
          initial={{ opacity: 0, scale: 0.4 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.55, ease: 'easeOut', delay: 0.75 }}
          className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary shadow-[0_0_16px_2px_hsl(var(--secondary)/0.8)]"
          aria-hidden
        />
      </div>
    </div>
  );
};

/**
 * IntroSplinePhone — Spline-telefonen i intro-sektionen ("Vi har gjort det enkelt för alla").
 *
 * Spline-scenen har ingen fast pixelstorlek: telefonens visuella höjd styrs av
 * `zoom` i förhållande till canvasens höjd. Därför mäts containern här och
 * zoom räknas fram med samma baslinje som hero-metriken (h/376 * 0.58), så att
 * telefonen alltid får identiska proportioner oavsett breakpoint — och aldrig
 * blir högre än textkolumnen bredvid.
 */
const IntroSplinePhone = () => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);
  const [zoom, setZoom] = useState(0.4);
  const [isPortraitTablet, setIsPortraitTablet] = useState(false);
  // Spline-canvasen renderar telefonen centrerat med luft över/under. Den luften
  // kollapsas med negativa marginaler så att den SYNLIGA telefonen hamnar exakt
  // centrerad mellan rubriken och brödtexten – ingen död yta.
  const [trimPx, setTrimPx] = useState(0);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const measure = () => {
      const height = wrapper.getBoundingClientRect().height;
      if (!height) return;
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const portraitTablet = viewportWidth >= 768 && viewportWidth < 1180 && viewportHeight > viewportWidth;
      setIsPortraitTablet(portraitTablet);
      // Samma baslinje som hero-metriken: telefonens synliga höjd blir ca 74 %
      // av canvasens höjd vid den här zoomen (högre zoom klipper toppen).
      setZoom(clamp((height / 376) * (portraitTablet ? 0.42 : 0.46), 0.2, portraitTablet ? 0.54 : 0.58));
      setTrimPx(Math.round(height * 0.16));
    };



    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(wrapper);
    window.addEventListener('resize', measure, { passive: true });
    window.visualViewport?.addEventListener('resize', measure, { passive: true });

    const root = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting && entry.intersectionRatio > 0.01),
      // Ingen rootMargin: scenen startar först när sektionen är i bild.
      { root, threshold: [0, 0.01, 0.25] },
    );

    observer.observe(wrapper);

    return () => {
      resizeObserver.disconnect();
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <motion.div
      ref={wrapperRef}
      aria-hidden="true"
      initial={{ opacity: 0, y: 32, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 1, ease }}
      style={{ marginTop: 0, marginBottom: -Math.round(trimPx * 2) }}
      className={`pointer-events-none relative mx-auto aspect-[9/19.5] w-full ${
        isPortraitTablet
          ? 'max-w-[192px]'
          : 'max-w-[140px] sm:max-w-[152px] md:max-w-[162px] lg:max-w-[172px] xl:max-w-[184px]'
      }`}

    >
      <SplinePhone className="relative h-full w-full" zoom={zoom} active={active} />

    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HeroIntroStage — Native scroll, inga hijacks.
// Hero ligger som en vanlig 100svh-sektion. Intro ligger som en egen
// fullhöjds-sektion direkt under och fadar/slidar in via framer-motion
// `whileInView`. Telefonen (FixedPhoneLayer) hittar fortfarande hero via
// data-hero-intro-stage och döljs när användaren scrollar förbi.
// ─────────────────────────────────────────────────────────────────────────────
const HeroIntroStage = ({ c, audience, onIntroCta, introCtaLabel }: HeroIntroStageProps) => {
  const mobileHeroMinHeight = useMobileHeroMinHeight();
  const isMobileLikeHeroLayout = useIsMobileLikeHeroLayout();
  const heroSafeTopPx = useHeroSafeTopPadding();
  // Jobbsökare: swipe-videon i hero (ritas direkt), Spline i intro (hinner ladda i lugn och ro).
  const heroPhoneVariant: 'spline' | 'video' = audience === 'job_seeker' ? 'video' : 'spline';
  currentHeroPhoneVariant = heroPhoneVariant;




  return (
    <>
      {/* ─────────── HERO ─────────── */}
      <section
        id="start"
        data-hero-intro-stage
        className={`relative min-h-[100svh] w-full scroll-mt-24 ${isMobileLikeHeroLayout ? 'overflow-visible' : 'overflow-visible md:h-[100svh] md:min-h-0 md:overflow-hidden'}`}
      >
        {/* Mobile hero — renderas endast i mobil-layout så att enbart EN <h1>
            existerar i DOM samtidigt (SEO: undvik duplicate h1). */}
        {isMobileLikeHeroLayout && (
        <section
          data-mobile-hero-section
          className="relative min-h-[100svh] w-screen overflow-hidden block"
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
          <InlineHeroPhone placement="mobile" className="mt-2" variant={heroPhoneVariant} />
        </section>
        )}

        {/* Desktop / tablet hero — renderas endast i desktop-layout (samma anledning). */}
        {!isMobileLikeHeroLayout && (
        <section className="relative h-full items-center justify-center overflow-hidden pb-16 pt-28 hidden md:flex md:[@media_(orientation:portrait)]:items-start md:[@media_(orientation:portrait)]:pt-[clamp(7rem,12svh,9rem)] lg:[@media_(orientation:portrait)]:items-center lg:[@media_(orientation:portrait)]:pt-28">
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
              <InlineHeroPhone placement="portraitTablet" variant={heroPhoneVariant} />
            </div>
          </div>
        </section>
        )}
      </section>

      {/* Visuell paus mellan hero-telefonen och intro-sektionen */}
      <SectionDivider className="mt-7 mb-0 sm:mt-10 md:mt-14" />

      {/* ─────────── INTRO ─────────── */}
      <section
        aria-label="Introduktion"
        className="relative flex w-full items-center justify-center overflow-hidden px-5 pb-8 pt-16 sm:px-6 sm:pb-10 sm:pt-20 md:px-12 md:pb-12 md:pt-14 lg:px-24"
      >
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
          transition={{ duration: 1, ease }}
          className={`relative z-10 flex max-w-6xl flex-col ${
            audience === 'job_seeker'
              ? 'items-center text-center md:items-start md:text-left'
              : 'items-center text-center'
          }`}
        >
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
            transition={{ duration: 1.1, ease, delay: 0.05 }}
            className={`landing-h2 wave-text mb-5 sm:mb-8 max-w-[min(92vw,52rem)] ${
              audience === 'job_seeker' ? 'md:max-w-[min(100%,34rem)] lg:max-w-[min(100%,38rem)]' : ''
            }`}
          >
            {c.intro.title}
          </motion.h2>
          {audience === 'job_seeker' ? (
            <div className="grid w-full items-center gap-8 sm:gap-10 md:grid-cols-[minmax(0,1.6fr)_minmax(200px,240px)] md:gap-12 lg:grid-cols-[minmax(0,1.7fr)_minmax(230px,275px)] lg:gap-16 xl:gap-20 md:text-left">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } } }}
                className="order-2 md:order-1"
              >
                <IntroText paragraphs={c.intro.paragraphs} align="start" />
              </motion.div>
              <div className="order-1 flex justify-center md:order-2">
                <IntroSplinePhone />
              </div>

            </div>
          ) : (
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } } }}
            >
              <IntroText paragraphs={c.intro.paragraphs} />
            </motion.div>
          )}
          {onIntroCta && (
            <motion.button
              type="button"
              onClick={onIntroCta}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="mt-16 inline-flex self-center items-center justify-center rounded-full bg-secondary px-8 py-4 text-base font-semibold text-white transition-colors duration-200 hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary sm:mt-20 sm:text-lg"
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
  const navigationType = useNavigationType();
  const c = audienceContent[audience];
  const isMobileFeatureMotion = useIsMobileLandingMotion();
  const [selectedPlan, setSelectedPlan] = useState<'start' | 'premium' | 'growth' | 'pro'>(
    audience === 'employer' ? 'pro' : 'premium',
  );
  const [employerFeaturesOpen, setEmployerFeaturesOpen] = useState(false);
  const [seekerFeaturesOpen, setSeekerFeaturesOpen] = useState(false);


  const commonEmployerFeatures = [
    'Skapa annons på minuter',
    'Kandidatpresentation med bild, video och egna ord — där kandidaten själv väljer vad som visas',
    'Överblick över alla sökande — flytta kandidater mellan steg: ny, intressant, intervju, erbjudande m.m.',
    'Chatt direkt med kandidater i plattformen',
    'Automatiska svar till alla sökande — ingen lämnas utan besked',
    'Fungerar lika bra i mobilen som på datorn',
  ];

  const employerPlans = [
    {
      id: 'start' as const,
      name: 'Start',
      price: '5 000',
      priceSuffix: '/mån',
      tagline: 'För dig som rekryterar regelbundet.',
      features: [
        '1 användare',
        'Upp till 40 aktiva annonser per månad',
        ...commonEmployerFeatures,
      ],
      cta: 'Välj Start',
      highlight: false,
    },
    {
      id: 'growth' as const,
      name: 'Växa',
      price: '7 500',
      priceSuffix: '/mån',
      tagline: 'När teamet växer och volymen ökar.',
      features: [
        '2 användare',
        'Obegränsat antal annonser',
        ...commonEmployerFeatures,
      ],
      cta: 'Välj Växa',
      highlight: false,
    },
    {
      id: 'pro' as const,
      name: 'Pro',
      price: '10 000',
      priceSuffix: '/mån',
      tagline: 'För organisationer utan gränser.',
      features: [
        'Obegränsat antal användare',
        'Obegränsat antal annonser',
        'Roller och behörigheter för hela teamet',
        'Dedikerad kontaktperson',
        ...commonEmployerFeatures,
      ],
      cta: 'Välj Pro',
      highlight: true,
    },
  ];

  // Mobil: trigga `.landing-feature-mobile-in` först när varje element faktiskt
  // scrollas in. Tidigare markerades rubriker i alla sektioner som visade direkt
  // vid mount, vilket gjorde att t.ex. Pris-rubriken saknade animation på mobil.
  useLayoutEffect(() => {
    if (!isMobileFeatureMotion) return;

    let cancelled = false;
    let raf = 0;
    const timers: number[] = [];
    const cleanupFns: Array<() => void> = [];

    const reveal = (el: Element) => {
      el.setAttribute('data-lf-shown', 'true');
      el.classList.add('is-in-view');
    };

    const start = () => {
      if (cancelled) return;
      const scrollRoot = document.querySelector<HTMLElement>('[data-landing-scroll-root]');
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>('[data-mobile-feature-prearm] .landing-feature-mobile-in'),
      );
      if (!elements.length) return;

      elements.forEach((el) => {
        el.classList.remove('is-in-view');
        el.setAttribute('data-lf-shown', 'false');
      });

      const isVisible = (el: HTMLElement) => {
        const rootRect = scrollRoot?.getBoundingClientRect() ?? {
          top: 0,
          bottom: window.innerHeight || document.documentElement.clientHeight,
        };
        const rect = el.getBoundingClientRect();
        const rootHeight = rootRect.bottom - rootRect.top;
        // Trigga när elementet faktiskt är väl inne i viewporten (topp ovanför
        // 82% av höjden), inte så fort dess kant tittar fram. Annars hinner
        // flera intilliggande element passera tröskeln samtidigt på liten
        // skärm och animationen ser statisk ut.
        return rect.bottom > rootRect.top + 16 && rect.top < rootRect.top + rootHeight * 0.82;
      };

      const syncVisible = () => {
        if (cancelled) return;
        elements.forEach((el) => {
          if (isVisible(el)) reveal(el);
        });
      };

      const schedule = () => {
        if (raf) return;
        raf = window.requestAnimationFrame(() => {
          raf = 0;
          syncVisible();
        });
      };

      schedule();
      timers.push(window.setTimeout(syncVisible, 80), window.setTimeout(syncVisible, 260), window.setTimeout(syncVisible, 900));

      scrollRoot?.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule, { passive: true });
      window.addEventListener('orientationchange', schedule, { passive: true });
      window.visualViewport?.addEventListener('resize', schedule, { passive: true });
      cleanupFns.push(() => {
        if (raf) window.cancelAnimationFrame(raf);
        scrollRoot?.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        window.removeEventListener('orientationchange', schedule);
        window.visualViewport?.removeEventListener('resize', schedule);
      });
    };

    start();

    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
      cleanupFns.forEach((fn) => fn());
    };
  }, [isMobileFeatureMotion, audience]);


  useWaveAwareText();
  useAdaptiveGlass();

  // Ingen wheel-hijack här. Landing-rooten scrollar nativt (samma känsla som
  // resten av OS:et/Apple) — all egen interpolering gjorde scrollen seg.



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

  // High-priority preload + Spline prefetch — så /jobbsokare och /arbetsgivare
  // får identisk LCP-känsla.
  useEffect(() => {
    preloadAudienceLandingAssets();
  }, []);

  // Gate endast Spline-relaterade detaljer bakom "parium:spline-ready".
  // Själva gradient/glow får ligga på direkt, annars upplevs refresh som en
  // platt/blå flash. Bubblorna tonas in efter telefonen så de inte poppar som
  // en ensam punkt före resten av hero:n.
  const [heroBgReady, setHeroBgReady] = useState(false);
  useEffect(() => {
    setHeroBgReady(false);
    let done = false;
    const trigger = () => {
      if (done) return;
      done = true;
      setHeroBgReady(true);
    };
    window.addEventListener('parium:spline-ready', trigger, { once: true });
    const fallback = window.setTimeout(trigger, 1400);
    return () => {
      window.removeEventListener('parium:spline-ready', trigger);
      window.clearTimeout(fallback);
    };
  }, [audience]);

  // 🔧 Ny framåtnavigering mellan /jobbsokare ↔ /arbetsgivare börjar högst upp.
  // Back/forward får däremot behålla exakt sparad position via ScrollRestoration.
  useLayoutEffect(() => {
    if (navigationType === 'POP') return;

    try {
      const root = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;
      if (root) root.scrollTop = 0;
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {
      // tyst — får aldrig störa UX
    }
  }, [audience, navigationType]);

  // 🛟 Safety net: om någon whileInView-trigger av oförklarlig anledning inte
  // fyrar (IntersectionObserver missar pga display:none-toggling i parent,
  // browser-bugg, race condition), tvingar vi alla element som är i viewport
  // men fortfarande osynliga (opacity 0) att fade:a in efter 1500ms.
  // Garanterar att innehåll ALDRIG kan fastna osynligt.
  useEffect(() => {
    const forceVisibleIfStuck = () => {
      try {
        const root = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;
        if (!root) return;
        const rootRect = root.getBoundingClientRect();
        const candidates = root.querySelectorAll<HTMLElement>(
          '[data-lf-shown="false"], [data-journey-shown="false"]',
        );
        candidates.forEach((el) => {
          // Rör aldrig Spline/WebGL-telefonen här. Den har en egen readiness-gate
          // för att förhindra vit canvas/splash vid refresh; safety-neten får inte
          // tvinga fram dess host/canvas innan WebGL-materialen är stabila.
          if (el.closest('[data-spline-phone]')) return;
          const rect = el.getBoundingClientRect();
          const inView = rect.bottom > rootRect.top && rect.top < rootRect.bottom;
          if (!inView) return;
          if (el.getAttribute('data-lf-shown') === 'false') {
            el.setAttribute('data-lf-shown', 'true');
            el.classList.add('is-in-view');
          }
          if (el.getAttribute('data-journey-shown') === 'false') {
            el.setAttribute('data-journey-shown', 'true');
          }
        });
      } catch {
        // tyst — får aldrig störa UX
      }
    };

    const root = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        forceVisibleIfStuck();
      });
    };

    const timer = window.setTimeout(forceVisibleIfStuck, 1500);
    root?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      window.clearTimeout(timer);
      if (raf) window.cancelAnimationFrame(raf);
      root?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [audience]);








  useEffect(() => {
    syncBrowserChrome(window.location.pathname);

    const isSeeker = audience === 'job_seeker';
    const title = isSeeker
      ? 'Hitta jobb som passar dig | Parium – för jobbsökare'
      : 'Hitta rätt kandidater snabbt | Parium – för arbetsgivare';
    const description = isSeeker
      ? 'Slipp långa formulär. Bygg en profil som visar mer än ett CV och få relevanta jobb först. Gratis för jobbsökare i Sverige.'
      : 'Hitta rätt kandidater på sekunder. Publicera jobb, se video och CV direkt och anställ snabbare med Parium – rekrytering i en ny generation.';
    const url = isSeeker ? 'https://www.parium.se/jobbsokare' : 'https://www.parium.se/arbetsgivare';

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
    { label: 'Start', href: '#start' },
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
        // i fixed-containrar. scrollBehavior lämnas 'auto' — annars animerar
        // browsern VARJE mushjulstick, vilket gör desktop-scrollen seg och
        // hackig. Programmatiska hopp anger behavior: 'smooth' explicit.
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'auto',

        backgroundImage:
          'linear-gradient(180deg, hsl(215 80% 22%) 0%, hsl(var(--primary)) 65svh, hsl(var(--primary)) 100%)',
        backgroundAttachment: 'scroll',
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundColor: 'hsl(var(--primary))',
      }}
    >
      <div className="pointer-events-none absolute inset-0 z-0">
        <AnimatedBackground showBubbles={false} showGlow={true} />
      </div>
      <div className="pointer-events-none absolute inset-0 z-0">
        <AnimatedBackground showBubbles={true} showGlow={false} />
      </div>
      <FixedPhoneLayer variant={audience === 'job_seeker' ? 'video' : 'spline'} />
      <div className="relative z-10 min-h-full">
        <LandingNav onLoginClick={handleLogin} links={navLinks} />


        <div>
          <HeroIntroStage c={c} audience={audience} onIntroCta={handleStart} introCtaLabel={c.hero.cta} />

          <SectionDivider className="mt-[34px] mb-2 md:my-20" />


          {audience === 'job_seeker' && (
            <>
              <section id="sa-funkar-det" aria-labelledby="sa-funkar-det-heading" className="scroll-mt-24">
                <h2 id="sa-funkar-det-heading" className="sr-only">Så funkar det</h2>
                <Suspense fallback={null}>
                  <PinnedHorizontalGallery />
                </Suspense>
              </section>

              <SectionDivider className="my-2 md:my-20" />

            </>
          )}


          {/* ──────────────── FUNKTIONER ──────────────── */}
          {isMobileFeatureMotion && (
            <style>{`
              [data-mobile-feature-prearm] .landing-feature-mobile-in {
                opacity: 0;
                transform: translate3d(var(--lf-x, 0), var(--lf-y, 18px), 0);
                transform-origin: center;
                will-change: opacity, transform;
                transition:
                  opacity 820ms cubic-bezier(0.16, 1, 0.3, 1) var(--lf-delay, 0ms),
                  transform 820ms cubic-bezier(0.16, 1, 0.3, 1) var(--lf-delay, 0ms),
                  border-color 300ms ease,
                  background-color 300ms ease,
                  box-shadow 300ms ease;
              }
              [data-mobile-feature-prearm] .landing-feature-mobile-in.is-in-view,
              [data-mobile-feature-prearm] .landing-feature-mobile-in[data-lf-shown="true"] {
                opacity: 1;
                transform: translate3d(0, 0, 0);
              }
              [data-mobile-feature-prearm] .landing-feature-mobile-in[data-lf-shown="false"] {
                pointer-events: none;
              }
              [data-mobile-feature-prearm] .landing-feature-card,
              [data-mobile-feature-prearm] .landing-faq-card {
                backdrop-filter: none;
                -webkit-backdrop-filter: none;
              }
            `}</style>
          )}

          <section id="funktioner" aria-labelledby="funktioner-heading" className="relative scroll-mt-24 overflow-visible px-5 pb-12 pt-8 sm:px-6 sm:pb-14 sm:pt-12 md:px-12 md:py-20 md:[@media_(orientation:portrait)]:pt-8 lg:px-24 lg:[@media_(orientation:portrait)]:pt-20">
            <div className="mx-auto max-w-[1180px]" data-mobile-feature-prearm={isMobileFeatureMotion ? true : undefined}>
              <motion.span
                initial={isMobileFeatureMotion ? false : { opacity: 0, x: -40 }}
                whileInView={isMobileFeatureMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                transition={{ duration: 0.7, ease }}
                className="landing-feature-mobile-in block text-xs font-bold uppercase tracking-[0.32em] text-secondary/85 md:[@media_(orientation:portrait)]:text-sm md:[@media_(orientation:portrait)]:tracking-[0.36em]"
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
                className="landing-h2 landing-feature-mobile-in wave-text mt-4 max-w-3xl md:[@media_(orientation:portrait)]:mt-6"
                style={isMobileFeatureMotion ? { ['--lf-x' as string]: '-60px', ['--lf-y' as string]: '0px', ['--lf-delay' as string]: '180ms' } : undefined}
              >
                Allt du behöver för att {audience === 'job_seeker' ? 'hitta rätt jobb' : 'hitta rätt person'}.
              </motion.h2>
              <motion.p
                initial={isMobileFeatureMotion ? false : { opacity: 0, x: 60 }}
                whileInView={isMobileFeatureMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                transition={{ duration: 0.9, ease, delay: 0.15 }}
                className="landing-feature-mobile-in wave-text mt-6 max-w-2xl text-base leading-8 text-white sm:text-lg md:[@media_(orientation:portrait)]:mt-8 md:[@media_(orientation:portrait)]:text-2xl md:[@media_(orientation:portrait)]:leading-9 md:[@media_(orientation:portrait)]:max-w-[640px]"
                style={isMobileFeatureMotion ? { ['--lf-x' as string]: '60px', ['--lf-y' as string]: '0px', ['--lf-delay' as string]: '260ms' } : undefined}
              >
                {c.featuresIntro}
              </motion.p>
              {audience === 'employer' ? (
                <EmployerJourney mobileClassMode={isMobileFeatureMotion} />
              ) : (
                <EmployerJourney
                  mobileClassMode={isMobileFeatureMotion}
                  steps={c.features.map((f) => ({
                    title: f.title,
                    body: f.description,
                    icon: f.icon,
                  }))}
                />
              )}


            </div>
          </section>

          <SectionDivider className="my-12 md:my-20" />

          <div className="relative z-10 -mt-px text-white">
          {/* ──────────────── PRISER ──────────────── */}
          <section id="priser" aria-labelledby="priser-heading" className="relative scroll-mt-24 overflow-visible px-5 pb-20 pt-12 sm:px-6 md:px-12 md:pb-28 md:pt-16 lg:px-24">

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
                className="landing-h2 landing-feature-mobile-in mt-4 max-w-2xl text-white"
                style={isMobileFeatureMotion ? { ['--lf-x' as string]: '-60px', ['--lf-y' as string]: '0px', ['--lf-delay' as string]: '180ms' } : undefined}
              >
                {audience === 'job_seeker' ? 'Gratis för dig som söker jobb.' : 'Byggt för att växa tillsammans.'}
              </motion.h2>
              <motion.p
                initial={isMobileFeatureMotion ? false : { opacity: 0, x: 60 }}
                whileInView={isMobileFeatureMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                transition={{ duration: 0.9, ease, delay: 0.15 }}
                className="landing-feature-mobile-in mt-6 max-w-xl text-base leading-8 text-white sm:text-lg"
                style={isMobileFeatureMotion ? { ['--lf-x' as string]: '60px', ['--lf-y' as string]: '0px', ['--lf-delay' as string]: '260ms' } : undefined}
              >
                {audience === 'job_seeker'
                  ? 'Kom igång helt gratis. Uppgradera till Premium när du vill ta nästa steg — säg upp när du vill.'
                  : 'Välj paket efter dagens behov. Skala upp när behoven växer — resten sköter vi.'}
              </motion.p>
              {audience === 'job_seeker' ? (
                <div className="relative mt-8 grid gap-5 md:grid-cols-2">
                  {[
                    {
                      id: 'start' as const,
                      name: 'Start',
                      price: '0',
                      priceSuffix: '/mån',
                      tagline: 'Allt du behöver för att börja söka jobb.',
                      features: [
                        'Skapa profil med CV och videopresentation',
                        'Bläddra bland alla jobb',
                        'Sökfilter på plats, roll och erfarenhet',
                        'Visa intresse för upp till 3 jobb i veckan',
                        'Spara upp till 3 jobb samtidigt',
                        'Chatta med arbetsgivare',
                      ],
                      cta: 'Kom igång gratis',
                      highlight: false,
                    },
                    {
                      id: 'premium' as const,
                      name: 'Premium',
                      price: '29',
                      priceSuffix: '/mån',
                      tagline: 'För dig som menar allvar med jobbsökandet.',
                      features: [
                        'Skapa profil med CV och videopresentation',
                        'Bläddra bland alla jobb',
                        'Sökfilter på plats, roll och erfarenhet',
                        'Visa intresse för hur många jobb du vill',
                        'Spara obegränsat antal jobb',
                        'Chatta med arbetsgivare',
                        'Se vilka företag som tittat på din profil',
                        'Direktkontakt till arbetsgivaren via mejl',
                        'Statistik över profilvisningar senaste 30 dagarna',
                      ],
                      cta: 'Bli Premium',
                      highlight: true,
                    },
                  ].map((plan, i) => {
                    const isActive = selectedPlan === plan.id;
                    return (
                      <motion.div
                        key={plan.name}
                        initial={isMobileFeatureMotion ? false : { opacity: 0, y: 18, filter: 'blur(6px)' }}
                        whileInView={isMobileFeatureMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
                        viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.01, margin: '100% 0px 100% 0px' }}
                        transition={{ duration: 0.85, ease, delay: 0.1 + i * 0.08 }}
                        onPointerDownCapture={() => setSelectedPlan(plan.id)}
                        onFocusCapture={() => setSelectedPlan(plan.id)}
                        onClick={() => setSelectedPlan(plan.id)}
                        role="button"
                        tabIndex={0}
                        data-allow-focus-shadow="true"
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPlan(plan.id); } }}
                         style={isMobileFeatureMotion ? { ['--lf-x' as string]: i % 2 === 0 ? '-46px' : '46px', ['--lf-y' as string]: '0px', ['--lf-delay' as string]: `${120 + i * 120}ms`, willChange: 'opacity, transform' } : { willChange: 'opacity, transform' }}
                        className={`landing-feature-card landing-feature-mobile-in relative isolate cursor-pointer rounded-3xl border p-8 transition-all duration-300 hover:-translate-y-1 [@media_(hover:hover)]:backdrop-blur-xl ${
                          isActive ? 'border-secondary bg-white/5' : 'border border-white/15 bg-white/5 hover:border-secondary/25'
                        }`}
                      >
                        {plan.highlight && (
                          <span className="absolute right-6 top-6 rounded-full bg-secondary/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                            Populär
                          </span>
                        )}
                        <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                        <p className="mt-2 text-4xl font-black text-white">
                          {plan.price} kr<span className="text-sm font-medium text-white">{plan.priceSuffix}</span>
                        </p>
                        <p className="mt-4 text-sm leading-7 text-white">{plan.tagline}</p>
                        <PlanFeatures
                          features={plan.features}
                          isActive={isActive}
                          open={seekerFeaturesOpen}
                          onToggle={() => setSeekerFeaturesOpen((v) => !v)}
                        />
                        <button
                          type="button"
                          onPointerDown={(e) => { e.stopPropagation(); }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/auth', { state: { mode: 'register', role: audience, plan: plan.id } });
                          }}
                          className={`mt-7 flex w-full min-h-[52px] items-center justify-center rounded-2xl px-6 text-sm font-bold tracking-wide transition-all duration-300 active:scale-[0.98] ${
                            plan.highlight
                              ? 'bg-secondary text-white shadow-[0_18px_45px_-18px_hsl(var(--secondary)/0.9)] hover:shadow-[0_22px_55px_-18px_hsl(var(--secondary))] hover:-translate-y-0.5'
                              : 'bg-white/10 text-white border border-white/20 hover:bg-white/15 hover:border-white/30'
                          }`}
                        >
                          {plan.cta}
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <>
                  {/* 3 månadspaket för arbetsgivare */}
                  <div className="relative mt-8 grid gap-5 md:grid-cols-3">
                    {employerPlans.map((plan, i) => {
                      const isActive = selectedPlan === plan.id;
                      return (
                        <motion.div
                          key={plan.name}
                          initial={isMobileFeatureMotion ? false : { opacity: 0, y: 18, filter: 'blur(6px)' }}
                          whileInView={isMobileFeatureMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
                          viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.01, margin: '100% 0px 100% 0px' }}
                          transition={{ duration: 0.85, ease, delay: 0.1 + i * 0.08 }}
                          onPointerDownCapture={() => setSelectedPlan(plan.id)}
                          onFocusCapture={() => setSelectedPlan(plan.id)}
                          onClick={() => setSelectedPlan(plan.id)}
                          role="button"
                          tabIndex={0}
                          data-allow-focus-shadow="true"
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPlan(plan.id); } }}
                          style={isMobileFeatureMotion ? { ['--lf-x' as string]: i % 2 === 0 ? '-46px' : '46px', ['--lf-y' as string]: '0px', ['--lf-delay' as string]: `${120 + i * 120}ms`, willChange: 'opacity, transform' } : { willChange: 'opacity, transform' }}
                          className={`landing-feature-card landing-feature-mobile-in relative isolate cursor-pointer overflow-hidden rounded-3xl border p-8 transition-all duration-300 hover:scale-[1.02] hover:border-secondary/40 [@media_(hover:hover)]:backdrop-blur-xl ${
                            isActive ? 'border-secondary bg-white/5' : 'border border-white/15 bg-white/5'
                          }`}
                        >
                          {plan.highlight && (
                            <span className="absolute right-6 top-6 z-10 rounded-full bg-secondary/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                              Populär
                            </span>
                          )}
                          <motion.div
                            animate={{ y: isActive ? -12 : 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                            className={isActive ? 'drop-shadow-[0_24px_40px_rgba(0,0,0,0.25)]' : ''}
                          >
                            <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                            <p className="mt-2 text-4xl font-black text-white">
                              {plan.price} kr<span className="text-sm font-medium text-white">{plan.priceSuffix}</span>
                            </p>
                            <p className="mt-1 text-xs font-medium text-white">exkl. moms</p>
                            <p className="mt-4 text-sm leading-7 text-white">{plan.tagline}</p>
                            <PlanFeatures
                              features={plan.features}
                              isActive={isActive}
                              open={employerFeaturesOpen}
                              onToggle={() => setEmployerFeaturesOpen((v) => !v)}
                            />
                          </motion.div>
                        </motion.div>
                      );
                    })}
                  </div>


                  {/* Universell 14-dagars-rad */}
                  <motion.p
                    initial={isMobileFeatureMotion ? false : { opacity: 0, y: 12 }}
                    whileInView={isMobileFeatureMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.2 }}
                    transition={{ duration: 0.6, ease, delay: 0.1 }}
                    className="mt-6 text-center text-sm text-white"
                  >
                    Alla annonser är aktiva i 14 dagar. Inga bindningstider — säg upp när ni vill.
                  </motion.p>

                  {/* Gemensam CTA som följer det valda paketet */}
                  {(() => {
                    const selectedEmployerPlan = employerPlans.find((p) => p.id === selectedPlan) ?? employerPlans[2];
                    return (
                      <motion.button
                        type="button"
                        initial={isMobileFeatureMotion ? false : { opacity: 0, y: 12 }}
                        whileInView={isMobileFeatureMotion ? undefined : { opacity: 1, y: 0 }}
                        viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.2 }}
                        transition={{ duration: 0.6, ease, delay: 0.2 }}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/auth', { state: { mode: 'register', role: audience, plan: selectedPlan } })}
                        className="mx-auto mt-8 flex w-full max-w-sm min-h-[56px] items-center justify-center rounded-2xl bg-secondary px-8 text-sm font-bold text-white shadow-[0_18px_45px_-18px_hsl(var(--secondary)/0.9)] transition-all duration-300 hover:shadow-[0_22px_55px_-18px_hsl(var(--secondary))]"
                      >
                        {selectedEmployerPlan.cta}
                      </motion.button>
                    );
                  })()}


                  {/* Engångspaket — separat block */}
                  <motion.div
                    initial={isMobileFeatureMotion ? false : { opacity: 0, y: 24, filter: 'blur(6px)' }}
                    whileInView={isMobileFeatureMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
                    viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.05, margin: '0px 0px -10% 0px' }}
                    transition={{ duration: 0.85, ease, delay: 0.1 }}
                    className="mt-14"
                  >
                    <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-white/5 p-8 md:flex md:items-center md:justify-between md:gap-8 [@media_(hover:hover)]:backdrop-blur-xl">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-secondary/85">
                          Behöver ni bara rekrytera en gång?
                        </span>
                        <h3 className="mt-3 text-2xl font-bold text-white">Enkelannons</h3>
                        <p className="mt-3 max-w-md text-sm leading-7 text-white">
                          Publicera en enskild annons som ligger uppe i 14 dagar. Perfekt när ni bara söker en person och inte behöver ett löpande abonnemang.
                        </p>
                        <p className="mt-4 text-3xl font-black text-white">
                          799 kr<span className="ml-1 text-sm font-medium text-white">/annons</span>
                        </p>
                        <p className="mt-1 text-xs font-medium text-white">exkl. moms</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/auth', { state: { mode: 'register', role: audience, plan: 'single' } })}
                        className="mt-6 w-full min-h-[56px] rounded-2xl bg-secondary px-8 text-sm font-bold text-white shadow-[0_18px_45px_-18px_hsl(var(--secondary)/0.9)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_-18px_hsl(var(--secondary))] active:scale-[0.98] md:mt-0 md:w-auto md:min-w-[220px]"
                      >
                        Publicera annons
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          </section>

          <SectionDivider className="my-12 md:my-20" />

          {/* ──────────────── FAQ ──────────────── */}
          <section id="faq" aria-labelledby="faq-heading" className="relative scroll-mt-24 overflow-hidden px-5 py-14 sm:px-6 sm:py-16 md:px-12 md:py-20 lg:px-24">
            <div className={audience === 'employer' ? "mx-auto max-w-[1180px]" : "mx-auto max-w-[880px]"} data-mobile-feature-prearm={isMobileFeatureMotion ? true : undefined}>

              <motion.div
                initial={isMobileFeatureMotion ? false : { opacity: 0, x: -60 }}
                whileInView={isMobileFeatureMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
                transition={{ duration: 0.9, ease }}
                className="landing-feature-mobile-in"
                style={isMobileFeatureMotion ? { ['--lf-x' as string]: '-60px', ['--lf-y' as string]: '0px', ['--lf-delay' as string]: '80ms' } : undefined}
              >
                <span className="text-xs font-bold uppercase tracking-[0.32em] text-secondary/85">Vanliga frågor</span>
                <SplitHeadline
                  as="h2"
                  text="Frågor & svar"
                  className="landing-h2 mt-4 text-white"
                />
              </motion.div>
              <div className={audience === 'employer' ? "mt-10 grid gap-3 md:grid-cols-2" : "mt-10 space-y-3"}>
                {(audience === 'job_seeker'
                  ? [
                      {
                        q: 'Hur fungerar Parium?',
                        a: 'Parium kopplar ihop arbetsgivare och jobbsökare direkt i samma plattform. En arbetsgivare publicerar en annons som är aktiv i 14 dagar. Swipa sedan bland aktuella jobb och visa intresse för de roller som passar dig.',
                      },
                      {
                        q: 'Vad kostar det?',
                        a: 'Parium är helt gratis att använda. Vill du ta nästa steg kan du uppgradera till Premium för 29 kr/mån — då får du obegränsat antal intresseanmälningar, obegränsat antal sparade jobb, direktkontakt via bolagets mejl. Du säger upp när du vill, utan bindningstid.',
                      },
                      {
                        q: 'Är mina uppgifter säkra?',
                        a: 'Ja. All data lagras i EU (våra servrar ligger i Paris) och krypteras under överföring. Din fullständiga profil visas bara för arbetsgivare du aktivt visat intresse för. I inställningarna kan du när som helst ladda ner alla dina uppgifter eller radera hela ditt konto direkt — utan att kontakta oss. Har du inte loggat in på 24 månader mejlar vi en varning, påminner dig tre gånger till (180, 90 och 7 dagar kvar), och raderar kontot först ett år senare.',

                      },
                      {
                        q: 'Vilka företag finns här?',
                        a: 'Allt från lokala restauranger och butiker till växande techbolag och etablerade arbetsgivare runt om i Sverige. Vi lägger till nya företag löpande och prioriterar arbetsgivare som svarar snabbt och håller hög kvalitet på sina annonser.',
                      },
                      {
                        q: 'Vad händer när jag visat intresse för ett jobb?',
                        a: 'Arbetsgivaren ser din profil, profilbild eller video och svar på deras frågor. Om de också är intresserade öppnas en chatt direkt i appen där ni kan prata vidare, ställa frågor och boka intervju.',
                      },
                      {
                        q: 'Måste jag ha CV och video?',
                        a: 'Nej, men vi rekommenderar det starkt. En video på 30–60 sekunder gör att du sticker ut på ett sätt som ingen text kan ge, och arbetsgivare svarar snabbare på profiler där de får en känsla för personen bakom orden.',
                      },
                      {
                        q: 'Hur får jag notiser om nya jobb?',
                        a: 'Spara en sökning med dina önskemål kring roll, ort och erfarenhet. När en ny annons stämmer med sökningen får du en notis — så missar du aldrig ett relevant jobb.',
                      },
                      {
                        q: 'Hur ökar jag mina chanser att bli kontaktad?',
                        a: 'Komplettera profilen med video, ett tydligt CV och skriv några rader om vad du söker. Håll önskemål kring roll, ort och tillgänglighet uppdaterade.',
                      },
                    ]
                  : [
                      {
                        q: 'Hur fungerar Parium för arbetsgivare?',
                        a: 'Ni publicerar jobb på minuter, kandidater visar intresse direkt i appen och ni får en överblick med video, CV och svar på era egna frågor. När ni visar intresse tillbaka öppnas en chatt — inga mejltrådar, inga betalda annonser som försvinner.',
                      },
                      {
                        q: 'Vad kostar det hos oss?',
                        a: 'Vi har tre månadspaket: Start på 5 000 kr/mån (1 användare, upp till 40 annonser i månaden), Växa på 7 500 kr/mån (2 användare, obegränsat antal annonser) och Pro på 10 000 kr/mån (obegränsat antal användare och annonser). Behöver ni bara rekrytera en gång kan ni publicera en enskild annons för 799 kr som ligger uppe i 14 dagar. Alla annonser är aktiva i 14 dagar och det är inga bindningstider.',
                      },
                      {
                        q: 'Finns det någon bindningstid?',
                        a: 'Nej. Alla månadspaket löper månadsvis och ni säger upp när ni vill från era kontoinställningar. Ingen uppsägningstid, inga dolda avgifter. Betalar ni för en enkelannons gäller den i 14 dagar och avslutas automatiskt.',
                      },
                      {
                        q: 'Hur snabbt kommer vi igång?',
                        a: 'På under 10 minuter. Ni skapar ett arbetsgivarkonto, verifierar organisationen och publicerar er första annons direkt. Har ni företagslogga och en rollbeskrivning redo är annonsen live samma dag.',
                      },
                      {
                        q: 'Hur kvalitetssäkras kandidaterna?',
                        a: 'Varje kandidat har en verifierad profil med video, erfarenhet och tydliga önskemål kring roll, ort och lön. Ni ser allt innan ni går vidare, vilket minimerar tiden ni lägger på irrelevanta ansökningar.',
                      },
                      {
                        q: 'Kan vi vara flera i kontot?',
                        a: 'Ja. På Växa bjuder ni in en kollega, på Pro får ni obegränsat antal användare. Ni delar kandidater i en gemensam Kanban-vy, kommenterar och fattar beslut tillsammans — utan att någon information faller mellan stolarna.',
                      },
                      {
                        q: 'Hur länge ligger annonsen uppe?',
                        a: 'Varje annons är aktiv i 14 dagar. När den går ut ligger den kvar bland era utgångna annonser och kan återpubliceras med ett klick — alla kandidater, chattar och noteringar följer med.',
                      },
                      {
                        q: 'Kan vi rekrytera i hela Sverige?',
                        a: 'Ja. Ni når kandidater i hela landet och väljer själva ort, kommun och om rollen är på plats, hybrid eller distans. Samma pris oavsett var ni rekryterar.',
                      },

                      {
                        q: 'Hur hanteras GDPR och kandidatdata?',
                        a: 'Kandidatdata lagras i EU (våra servrar ligger i Paris, Frankrike). Kandidaten äger sin egen data och delar sin fullständiga profil med er först när hen aktivt ansökt eller visat intresse. Ni ser bara kandidater kopplade till era egna annonser. Vårt personuppgiftsbiträdesavtal (DPA) enligt GDPR art. 28 ingår som bilaga i användarvillkoren och accepteras när ni registrerar kontot — inget separat dokument behöver signeras. Läs det på parium.se/dpa.',
                      },
                      {
                        q: 'Hur länge sparas kandidatdata?',
                        a: 'Vi raderar gammal data automatiskt varje natt. Ansökningar och tillhörande chattar raderas 24 månader efter ansökan (diskrimineringslagens preskriptionstid), aktivitetslogg efter 24 månader, visningsstatistik efter 12 månader och notiser efter 6 månader. Konton som inte använts på 24 månader får en varning via mejl, tre påminnelser (180, 90 och 7 dagar kvar) och raderas först ett år senare. Era annonser ligger kvar så länge ni vill — det är kandidatuppgifterna i dem som gallras. Ni kan alltid ta bort en kandidat eller annons tidigare, och kandidaten kan radera hela sitt konto själv när som helst. Hela rutinen finns i vårt personuppgiftsbiträdesavtal.',
                      },
                      {
                        q: 'Vilken support får vi som kund?',
                        a: 'Ni når oss på hej@parium.se alla vardagar. Vi hjälper till med allt från annonsupplägg och kandidattips till fakturafrågor — svar inom 24 timmar, oftast samma dag. På Pro får ni dessutom en dedikerad kontaktperson.',
                      },
                      {
                        q: 'Vad händer om vi inte förnyar?',
                        a: 'Allt sparas — kandidatbank, chattar och gamla annonser ligger kvar. Det enda som pausas är möjligheten att publicera nya annonser tills ni aktiverar en plan igen.',
                      },
                      {
                        q: 'Kan vi byta plan?',
                        a: 'Ja, ni kan uppgradera eller nedgradera när som helst från Inställningar → Plan. Ändringen träder i kraft omedelbart och vi justerar debiteringen proportionerligt.',
                      },
                      {
                        q: 'Ingår moms?',
                        a: 'Priserna är exklusive moms. 25 % moms läggs på i checkouten och specificeras på fakturan. Momsregistrerade företag drar av den som ingående moms som vanligt.',
                      },

                    ]
                ).map(({ q, a }, i) => (
                  <motion.div
                    key={`${q}-${i}`}
                    initial={isMobileFeatureMotion ? false : { opacity: 0, x: 60 }}
                    whileInView={isMobileFeatureMotion ? undefined : { opacity: 1, x: 0 }}
                    viewport={isMobileFeatureMotion ? undefined : { once: true, amount: 0.01, margin: "100% 0px 100% 0px" }}
                    transition={{ duration: 0.7, ease, delay: 0.12 + i * 0.06 }}
                    className="landing-faq-card landing-feature-mobile-in"
                    style={isMobileFeatureMotion ? { ['--lf-x' as string]: '60px', ['--lf-y' as string]: '0px', ['--lf-delay' as string]: `${120 + i * 45}ms` } : undefined}
                  >
                    <FaqAccordion q={q} a={a} />
                  </motion.div>
                ))}


              </div>
            </div>
          </section>

          <SectionDivider className="my-12 md:my-20" />

          {/* ──────────────── APP BADGES ──────────────── */}
          <section
            aria-label="Ladda ner Parium-appen"
            className="relative overflow-hidden px-5 py-10 sm:px-6 sm:py-12 md:px-12 md:py-14 lg:px-24"
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, ease }}
              className="mx-auto max-w-[720px] text-center"
            >
              <AppBadges />
            </motion.div>
          </section>

          <SectionDivider className="my-12 md:my-20" />

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
                className="landing-h2 mt-4 text-white"
              />
              <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-white sm:text-lg">
                Kontakta oss gärna om du har någon fundering.
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
            <Suspense fallback={null}>
              <BouncyFooter audience={audience} onCta={handleStart} />
            </Suspense>

            {/* ──────────────── 5. SITE FOOTER (SEO + navigation) ──────────────── */}
            <Suspense fallback={null}>
              <SiteFooter />
            </Suspense>


        </div>
      </div>
    </div>
    </>
  );
};

export default AudienceLanding;
