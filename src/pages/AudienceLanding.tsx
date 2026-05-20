import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import LandingNav, { type LandingNavLink } from '@/components/LandingNav';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { syncBrowserChrome } from '@/lib/browserChrome';
import PinnedHorizontalGallery from '@/components/landing/audience/PinnedHorizontalGallery';
import BouncyFooter from '@/components/landing/audience/BouncyFooter';
import { audienceContent, type AudienceRole } from '@/components/landing/audience/content';
import { SplinePhone } from '@/components/landing/SplinePhone';
import { HeroText } from '@/components/landing/audience/HeroText';

type AudienceLandingProps = {
  audience: AudienceRole;
};

const ease = [0.16, 1, 0.3, 1] as const;

const IntroText = ({ paragraphs }: { paragraphs: string[] }) => (
  <div className="max-w-3xl text-center text-base leading-[1.75] text-white sm:text-lg md:text-xl">
    {paragraphs.map((paragraph, pIdx) => (
      <p key={pIdx} className={pIdx > 0 ? 'mt-6' : undefined}>
        {paragraph}
      </p>
    ))}
  </div>
);

type HeroIntroStageProps = {
  c: (typeof audienceContent)[AudienceRole];
  isDesktopHero: boolean;
  onIntroCta?: () => void;
  introCtaLabel?: string;
};

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
    // Proportional safe areas — scale with viewport height so phone never clips and breathes equally top/bottom.
    const gap = tablet ? clamp(height * 0.055, 44, 96) : clamp(height * 0.06, 40, 88);
    const topSafeGap = tablet ? clamp(height * 0.075, 56, 120) : clamp(height * 0.082, 54, 110);
    const bottomSafe = tablet ? clamp(height * 0.095, 70, 140) : clamp(height * 0.11, 76, 132);
    const canvasTopBreathingRoom = tablet ? clamp(height * 0.07, 50, 110) : clamp(height * 0.095, 64, 120);
    // Maximize canvas area between text and bottom safe area — no hard cap so phone uses all available space.
    const availableHeight = Math.max(220, height - textBottom - gap - bottomSafe);
    const maxCanvasHeight = Math.max(220, height - gap - bottomSafe);
    const visualHeight = availableHeight;
    const finalHeight = Math.min(visualHeight + canvasTopBreathingRoom, maxCanvasHeight);
    const yOffset = width >= 768 ? 18 : clamp(height * 0.038, 28, 42);
    const safeTop = textBottom + topSafeGap + (tablet ? 0 : yOffset);
    const bottomAnchoredTop = height - bottomSafe - visualHeight;
    const top = Math.max(gap, safeTop, bottomAnchoredTop);
    // Reference baseline: at 390×844 finalHeight ≈ 376, zoom 0.44 looks perfect.
    // Scale zoom directly with canvas height so phone fills available area proportionally without clipping.
    const referenceHeight = tablet ? 460 : 376;
    const baseZoom = tablet ? 0.46 : 0.44;
    // Width constraint: phone aspect ≈ 9:19.5. Ensure phone width fits canvas width.
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
      // Dölj direkt, men vänta ~900ms innan vi visar igen så att
      // bild 1 hinner lägga sig på plats innan telefonen fade:as in.
      if (next) {
        if (showTimerRef.current) return; // redan inplanerad
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

    // 🔁 Spline-canvasen fångar wheel/touch internt (för 3D-rotation/zoom),
    // vilket gör att GSAP Observer inte ser scrollen och sidan "fastnar".
    // Vi forwarder därför scroll-gester från telefonens wrapper till scrollRoot
    // så att Hero → Intro-animationen triggas precis som utanför telefonen.
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
      // Skicka motsvarande wheel så Observer plockar upp riktningen
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

// ─────────────────────────────────────────────────────────────────────────────
// HeroIntroStage — GSAP Observer
// Två lager (Hero + Intro) i samma 100svh-yta. Wheel/touch fångas av Observer
// och animerar lagren in/ut (Intro kommer UPPIFRÅN). När man redan är på Intro
// och scrollar nedåt igen släpps kontrollen och sidan scrollar vidare normalt.
// Inga scroll-snap, ingen sticky, inga konkurrerande wheel-locks.
// ─────────────────────────────────────────────────────────────────────────────
const HeroIntroStage = ({ c, isDesktopHero, onIntroCta, introCtaLabel }: HeroIntroStageProps) => {
  const stageRef = useRef<HTMLElement | null>(null);
  const heroOuterRef = useRef<HTMLDivElement | null>(null);
  const heroInnerRef = useRef<HTMLDivElement | null>(null);
  const introOuterRef = useRef<HTMLDivElement | null>(null);
  const introInnerRef = useRef<HTMLDivElement | null>(null);
  const heroTextRef = useRef<HTMLDivElement | null>(null);
  const introTextRef = useRef<HTMLDivElement | null>(null);
  const indexRef = useRef(0); // 0 = hero, 1 = intro
  const animatingRef = useRef(false);
  const releaseLockedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let observer: { kill: () => void; enable?: () => void; disable?: () => void; isEnabled?: boolean } | null = null;
    let returnFrame: number | null = null;
    let returnTimer: number | null = null;
    let forwardTimer: number | null = null;
    let setupTeardown: (() => void) | undefined;

    const setup = async () => {
      const [{ default: gsap }, { Observer }] = await Promise.all([
        import('gsap'),
        import('gsap/Observer'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(Observer);

      const heroOuter = heroOuterRef.current;
      const heroInner = heroInnerRef.current;
      const introOuter = introOuterRef.current;
      const introInner = introInnerRef.current;
      const introText = introTextRef.current;
      const stage = stageRef.current;
      const scrollRoot = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;
      if (!heroOuter || !heroInner || !introOuter || !introInner || !stage) return;

      // OBS: heroTextItems plockas INTE — framer-motion (HeroText) äger
      // hero-textens opacitet helt. GSAP rör bara layer-transformerna.
      const gallerySection = document.getElementById('sa-funkar-det');
      const introTextItems = introText ? gsap.utils.toArray<HTMLElement>(introText.querySelectorAll('p')) : [];
      const introCtaEl = introText?.querySelector<HTMLElement>('[data-intro-anim]') ?? null;
      const introHeadingEl = introText?.querySelector<HTMLElement>('[data-intro-heading]') ?? null;
      let releasedToGallery = false;
      let programmaticReturn = false;
      let prevScrollTop = scrollRoot?.scrollTop ?? 0;
      let restoreScrollBehavior: (() => void) | null = null;

      let observerActive = false;
      const setObserverActive = (active: boolean) => {
        if (!observer || active === observerActive) return;
        observerActive = active;
        if (active) observer.enable?.();
        else observer.disable?.();
      };

      const clearReturnWork = () => {
        if (scrollRoot) gsap.killTweensOf(scrollRoot);
        restoreScrollBehavior?.();
        restoreScrollBehavior = null;
        if (returnFrame) {
          window.cancelAnimationFrame(returnFrame);
          returnFrame = null;
        }
        if (returnTimer) {
          window.clearTimeout(returnTimer);
          returnTimer = null;
        }
        if (forwardTimer) {
          window.clearTimeout(forwardTimer);
          forwardTimer = null;
        }
      };

      const snapStageToTop = () => {
        if (!scrollRoot) return;
        const top = scrollRoot.scrollTop + stage.getBoundingClientRect().top;
        if (Math.abs(scrollRoot.scrollTop - top) > 1) {
          scrollRoot.scrollTo({ top, behavior: 'auto' });
        }
      };

      // VIKTIGT: Vi rör INTE heroTextItems via GSAP. Hero-texten ägs av
      // framer-motion (HeroText) som har en lång premium-fade (~3s totalt).
      // Om GSAP gör `gsap.set(...opacity:1)` eller tween:ar opacity här
      // kapas framer-motions pågående animation mitt i → text "hackar"
      // eller "försvinner fel" vid första scrollen efter refresh.
      // Hero-text-layern (heroOuter) skiftar yPercent → texten lämnar
      // viewporten visuellt utan att vi behöver röra textens opacity.
      const setHeroStart = () => {
        gsap.killTweensOf([heroOuter, heroInner, introOuter, introInner, introText, introCtaEl, introHeadingEl, ...introTextItems].filter(Boolean));
        gsap.set(heroOuter, { yPercent: 0, autoAlpha: 1 });
        gsap.set(heroInner, { yPercent: 0 });
        gsap.set(introOuter, { yPercent: 100, autoAlpha: 0 });
        gsap.set(introInner, { yPercent: -100 });
        if (introText) gsap.set(introText, { opacity: 1, clearProps: 'transform' });
        gsap.set(introTextItems, { y: 44, opacity: 0 });
        if (introCtaEl) gsap.set(introCtaEl, { opacity: 0 });
        if (introHeadingEl) gsap.set(introHeadingEl, { opacity: 0 });
        indexRef.current = 0;
      };

      const setIntroResting = () => {
        gsap.killTweensOf([heroOuter, heroInner, introOuter, introInner, introText, introCtaEl, introHeadingEl, ...introTextItems].filter(Boolean));
        gsap.set(heroOuter, { yPercent: -100, autoAlpha: 1 });
        gsap.set(heroInner, { yPercent: 100 });
        gsap.set(introOuter, { yPercent: 0, autoAlpha: 1 });
        gsap.set(introInner, { yPercent: 0 });
        if (introText) gsap.set(introText, { opacity: 1, clearProps: 'transform' });
        // När intro ligger stilla ska texten inte längre ligga på ett GSAP-
        // transformlager. På hård scroll mot 3:an kunde compositing annars ge
        // en ghost/dubblett-frame av texten i Chrome/Lovable-preview.
        gsap.set(introTextItems, { opacity: 1, clearProps: 'transform' });
        if (introCtaEl) gsap.set(introCtaEl, { opacity: 1, clearProps: 'transform' });
        if (introHeadingEl) gsap.set(introHeadingEl, { opacity: 1, clearProps: 'transform' });
        indexRef.current = 1;
      };

      setHeroStart();

      const goToIntro = ({ snap = true } = {}) => {
        if (animatingRef.current || indexRef.current === 1) return;
        clearReturnWork();
        animatingRef.current = true;
        indexRef.current = 1;
        if (snap) snapStageToTop();
        window.dispatchEvent(new CustomEvent('parium:hero-index', { detail: { index: 1, direction: 'next' } }));

        const tl = gsap.timeline({
          defaults: { duration: 1.08, ease: 'power2.inOut' },
          onComplete: () => {
            setIntroResting();
            animatingRef.current = false;
            releaseLockedRef.current = false;
            programmaticReturn = false;
            window.dispatchEvent(new Event('parium:gallery-warm'));
            if (!releasedToGallery) setObserverActive(true);
          },
        });
        // heroTextItems-tween borttagen — framer-motion äger hero-textens
        // opacitet. Layern (heroOuter) translateY tar texten ur viewporten.
        tl.to(heroOuter, { yPercent: -100 }, 0);
        tl.to(heroInner, { yPercent: 100 }, 0);
        tl.set(introOuter, { autoAlpha: 1 }, 0);
        tl.fromTo(introOuter, { yPercent: 100 }, { yPercent: 0 }, 0);
        tl.fromTo(introInner, { yPercent: -100 }, { yPercent: 0 }, 0);
        if (introHeadingEl) {
          // Rubriken matchar hero-h1: opacity-only premium fade, lugn och lång.
          tl.fromTo(introHeadingEl, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power3.out' }, 0.3);
        }
        tl.fromTo(introTextItems, { y: 44, opacity: 0 }, { y: 0, opacity: 1, duration: 0.62, stagger: 0.08, ease: 'power2.out' }, 0.62);
        if (introCtaEl) {
          // CTA fadar bara in (ingen y-translate) så den inte "sticker upp" i slutet.
          tl.fromTo(introCtaEl, { opacity: 0 }, { opacity: 1, duration: 0.62, ease: 'power2.out' }, 0.62 + introTextItems.length * 0.08);
        }
      };

      const goToHero = () => {
        if (animatingRef.current || indexRef.current === 0) return;
        clearReturnWork();
        releasedToGallery = false;
        programmaticReturn = false;
        animatingRef.current = true;
        indexRef.current = 0;
        snapStageToTop();
        window.dispatchEvent(new CustomEvent('parium:hero-index', { detail: { index: 0, direction: 'prev' } }));

        const tl = gsap.timeline({
          defaults: { duration: 1.08, ease: 'power2.inOut' },
          onComplete: () => {
            setHeroStart();
            animatingRef.current = false;
            releaseLockedRef.current = false;
            setObserverActive(true);
          },
        });
        tl.to(introTextItems, { y: 44, opacity: 0, duration: 0.42, stagger: 0.055, ease: 'power2.in' }, 0);
        if (introCtaEl) tl.to(introCtaEl, { opacity: 0, duration: 0.32, ease: 'power2.in' }, 0);
        if (introHeadingEl) tl.to(introHeadingEl, { opacity: 0, duration: 0.42, ease: 'power2.in' }, 0);
        tl.to(introOuter, { yPercent: 100 }, 0);
        tl.to(introInner, { yPercent: -100 }, 0);
        tl.set(introOuter, { autoAlpha: 0 });
        tl.fromTo(heroOuter, { yPercent: -100 }, { yPercent: 0 }, 0);
        tl.fromTo(heroInner, { yPercent: 100 }, { yPercent: 0 }, 0);
        // heroTextItems-tween borttagen — framer-motion ägde entrén och
        // återkomst-fade hanteras visuellt via layerns yPercent-slide.
      };

      // 2↔3 måste vara en låst premium-transition, inte native momentum-scroll.
      // På touch kunde iOS/Chrome annars fortsätta scrolla mellan sektionerna
      // innan returen hann trigga. Därför äger GSAP scrollTop under själva
      // tröskelpassagen, medan galleriets egen progress är fryst tills landning.
      let transitionBlockUntil = 0;
      let galleryTouchY: number | null = null;
      const blockNativeInput = (e: Event) => {
        if (performance.now() < transitionBlockUntil) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        if (releasedToGallery && !programmaticReturn && !animatingRef.current && scrollRoot) {
          const wheelBack = e instanceof WheelEvent && e.deltaY < -8;
          const touch = e instanceof TouchEvent ? e.touches[0] : null;
          const touchBack = touch && galleryTouchY !== null ? galleryTouchY - touch.clientY < -6 : false;
          if (touch) galleryTouchY = touch.clientY;

          // VIKTIGT: Endast intercepta upp-gesten när galleri-sektionen fortfarande
          // är pinnad (top nära 0). Om användaren har scrollat förbi galleriet och
          // är på t.ex. "Priser" ska native scroll få ta dem tillbaka in i galleriet
          // utan att kastas hela vägen till intro.
          const galleryTop = gallerySection ? gallerySection.getBoundingClientRect().top : 0;
          const galleryIsAtStart = galleryTop >= -4;

          if ((wheelBack || touchBack) && galleryIsAtStart) {
            e.preventDefault();
            e.stopPropagation();
            returnFromGalleryToIntro();
          }
        }

      };
      const trackTouchStart = (e: TouchEvent) => {
        galleryTouchY = e.touches[0]?.clientY ?? null;
      };
      const clearTouchTrack = () => {
        galleryTouchY = null;
      };
      const lockNativeInput = (ms: number) => {
        transitionBlockUntil = performance.now() + ms;
      };
      const withScrollBehaviorAuto = () => {
        if (!scrollRoot) return;
        restoreScrollBehavior?.();
        const previousScrollBehavior = scrollRoot.style.scrollBehavior;
        scrollRoot.style.scrollBehavior = 'auto';
        restoreScrollBehavior = () => {
          scrollRoot.style.scrollBehavior = previousScrollBehavior;
        };
      };
      scrollRoot?.addEventListener('wheel', blockNativeInput, { passive: false, capture: true });
      scrollRoot?.addEventListener('touchstart', trackTouchStart, { passive: true, capture: true });
      scrollRoot?.addEventListener('touchmove', blockNativeInput, { passive: false, capture: true });
      scrollRoot?.addEventListener('touchend', clearTouchTrack, { passive: true, capture: true });

      const isStageDocked = () => {
        const rect = stage.getBoundingClientRect();
        const vh = window.innerHeight;
        return Math.abs(rect.top) < 4 && rect.bottom > vh * 0.9;
      };

      const isPastStage = () => stage.getBoundingClientRect().bottom <= 4;

      // 2↔3 ska kännas EXAKT som 1↔2 (goToIntro/goToHero):
      // - Samma duration (1.08s) och ease (power2.inOut)
      // - INGEN konkurrerande text-fade — intro-texten åker bara med via
      //   layer-translateY (samma princip som hero-texten i 1↔2).
      // - Komplett input-lock under HELA transition-fönstret så att varken
      //   wheel-momentum eller iOS touch-momentum kan rubba scrollen.
      const TRANSITION_DURATION = 1.08;
      const TRANSITION_LOCK_MS = 1200; // 1.08s + buffer för momentum
      const GALLERY_REWIND_MIN_DURATION = 0.34;
      const GALLERY_REWIND_MAX_DURATION = 0.72;

      const releaseAndScrollNext = () => {
        const root = scrollRoot;
        const next = gallerySection;
        if (!root || !next) return;
        if (animatingRef.current) return;
        releasedToGallery = true;
        programmaticReturn = true;
        animatingRef.current = true;
        setObserverActive(false);
        window.dispatchEvent(new CustomEvent('parium:hero-index', { detail: { index: 2, direction: 'next' } }));
        window.dispatchEvent(new Event('parium:gallery-leave'));
        const startScroll = root.scrollTop;
        const targetScroll = startScroll + next.getBoundingClientRect().top;
        prevScrollTop = startScroll;
        lockNativeInput(TRANSITION_LOCK_MS);
        withScrollBehaviorAuto();

        const finishForward = () => {
          root.scrollTop = targetScroll;
          restoreScrollBehavior?.();
          restoreScrollBehavior = null;
          transitionBlockUntil = 0;
          programmaticReturn = false;
          animatingRef.current = false;
          prevScrollTop = root.scrollTop;
          releaseLockedRef.current = false;
          forwardTimer = null;
          window.dispatchEvent(new Event('parium:gallery-enter'));
        };

        gsap.killTweensOf(root);
        gsap.to(root, {
          scrollTop: targetScroll,
          duration: TRANSITION_DURATION,
          ease: 'power2.inOut',
          overwrite: true,
          onComplete: finishForward,
          onInterrupt: finishForward,
        });
      };

      const returnFromGalleryToIntro = () => {
        if (!scrollRoot || programmaticReturn || animatingRef.current) return;
        const root = scrollRoot;
        programmaticReturn = true;
        animatingRef.current = true;
        releasedToGallery = false;
        releaseLockedRef.current = false;
        setObserverActive(false);

        // Mississippi-finessen: om användaren vänder mitt i kortresan får den
        // INTE hoppa direkt upp till intro. Först låser vi input och låter
        // galleriets egen scroll-progress åka hela vägen tillbaka till vänster
        // (Träning). Först därefter fryser vi galleriet och kör 3→2-returen.
        const galleryTop = gallerySection
          ? Math.max(0, root.scrollTop + gallerySection.getBoundingClientRect().top)
          : root.scrollTop;
        const target = Math.max(0, root.scrollTop + stage.getBoundingClientRect().top);
        const rewindDistance = Math.max(0, root.scrollTop - galleryTop);
        const galleryDistance = gallerySection ? Math.max(1, gallerySection.offsetHeight - root.clientHeight) : Math.max(1, rewindDistance);
        const rewindProgress = Math.min(1, rewindDistance / galleryDistance);
        const rewindDuration = rewindDistance > 2
          ? GALLERY_REWIND_MIN_DURATION + (GALLERY_REWIND_MAX_DURATION - GALLERY_REWIND_MIN_DURATION) * rewindProgress
          : 0;

        // Intro ligger redan i "resting" state visuellt (synlig). Vi rör inte
        // text/heading/CTA-opacity — exakt som 1↔2 där hero-texten är synlig
        // hela tiden och bara åker med layern.
        setIntroResting();

        lockNativeInput(TRANSITION_LOCK_MS + Math.ceil(rewindDuration * 1000));
        withScrollBehaviorAuto();

        const finishReturn = () => {
          root.scrollTop = target;
          restoreScrollBehavior?.();
          restoreScrollBehavior = null;
          transitionBlockUntil = 0;
          programmaticReturn = false;
          animatingRef.current = false;
          prevScrollTop = root.scrollTop;
          setObserverActive(true);
        };

        const startIntroReturn = () => {
          root.scrollTop = galleryTop;
          window.dispatchEvent(new Event('parium:gallery-reset-start'));
          window.dispatchEvent(new Event('parium:gallery-leave'));
          window.dispatchEvent(new CustomEvent('parium:hero-index', { detail: { index: 1, direction: 'prev' } }));

          gsap.killTweensOf(root);
          gsap.to(root, {
            scrollTop: target,
            duration: TRANSITION_DURATION,
            ease: 'power2.inOut',
            overwrite: true,
            onComplete: finishReturn,
            onInterrupt: finishReturn,
          });
        };

        gsap.killTweensOf(root);
        if (rewindDuration > 0) {
          gsap.to(root, {
            scrollTop: galleryTop,
            duration: rewindDuration,
            ease: 'power2.out',
            overwrite: true,
            onComplete: startIntroReturn,
            onInterrupt: startIntroReturn,
          });
        } else {
          startIntroReturn();
        }
      };

      observer = Observer.create({
        target: scrollRoot ?? window,
        type: 'wheel,touch',
        wheelSpeed: -1,
        tolerance: 16,
        preventDefault: true,
        onUp: () => {
          if (releasedToGallery || programmaticReturn || animatingRef.current) return;
          if (!isStageDocked() || isPastStage()) {
            setObserverActive(false);
            return;
          }
          if (indexRef.current === 0) {
            goToIntro();
            return;
          }
          if (releaseLockedRef.current) return;
          releaseLockedRef.current = true;
          releaseAndScrollNext();
        },
        onDown: () => {
          if (releasedToGallery || programmaticReturn || animatingRef.current) return;
          if (!isStageDocked() || isPastStage()) {
            setObserverActive(false);
            return;
          }
          if (indexRef.current === 1) goToHero();
        },
      });
      observer.disable?.();
      observerActive = false;

      const onScrollWatch = () => {
        if (!scrollRoot) return;
        // Bail TIDIGT så vi inte gör layout-läsningar (getBoundingClientRect)
        // varje frame medan programstyrda scrolls eller GSAP-animationer pågår.
        if (programmaticReturn || animatingRef.current) return;

        const cur = scrollRoot.scrollTop;
        const direction = cur < prevScrollTop ? 'up' : 'down';
        prevScrollTop = cur;
        const rect = stage.getBoundingClientRect();
        const vh = window.innerHeight;

        if (releasedToGallery) {
          setObserverActive(false);
          // Backup-trigger: om native scroll hann ske före input-capture ska
          // första uppåtrörelsen ändå direkt tas över och börja från Träning.
          if (direction === 'up') {
            returnFromGalleryToIntro();
          }
          return;
        }

        const stageIsDocked = Math.abs(rect.top) < 4 && rect.bottom > vh * 0.9;
        if (stageIsDocked) {
          setObserverActive(true);
          if (indexRef.current !== 0 && indexRef.current !== 1) setIntroResting();
        } else if (rect.bottom <= 0 || rect.top >= vh) {
          setObserverActive(false);
        }
      };

      scrollRoot?.addEventListener('scroll', onScrollWatch, { passive: true });
      onScrollWatch();

      // När navigationen (dropdown/pill) hoppar till en sektion bortom
      // hero/intro behöver vi släppa orchestreringens lås — annars fortsätter
      // Observer + blockNativeInput att äga wheel/touch och scroll genom
      // pinned-galleriet känns "låst". Vi sätter intro till sitt resting state
      // så att 3→2-returen fortfarande ser korrekt ut, och tinar galleriets
      // frysta scroll-progress.
      const handleNavJump = () => {
        clearReturnWork();
        releasedToGallery = true;
        programmaticReturn = false;
        animatingRef.current = false;
        releaseLockedRef.current = false;
        transitionBlockUntil = 0;
        setObserverActive(false);
        setIntroResting();
        window.dispatchEvent(new Event('parium:gallery-enter'));
        window.dispatchEvent(new CustomEvent('parium:hero-index', { detail: { index: 2, direction: 'next' } }));
      };
      window.addEventListener('parium:nav-jump', handleNavJump);

      setupTeardown = () => {
        clearReturnWork();
        scrollRoot?.removeEventListener('scroll', onScrollWatch);
        scrollRoot?.removeEventListener('wheel', blockNativeInput, true);
        scrollRoot?.removeEventListener('touchstart', trackTouchStart, true);
        scrollRoot?.removeEventListener('touchmove', blockNativeInput, true);
        scrollRoot?.removeEventListener('touchend', clearTouchTrack, true);
        window.removeEventListener('parium:nav-jump', handleNavJump);
      };
    };

    setup();

    return () => {
      cancelled = true;
      if (returnFrame) { window.cancelAnimationFrame(returnFrame); returnFrame = null; }
      if (returnTimer) { window.clearTimeout(returnTimer); returnTimer = null; }
      if (forwardTimer) { window.clearTimeout(forwardTimer); forwardTimer = null; }
      observer?.kill();
      setupTeardown?.();
    };
  }, []);

  return (
    <section
      ref={stageRef}
      data-hero-intro-stage
      className="relative h-[100svh] w-full overflow-hidden"
    >
      {/* HERO LAGER */}
      <div ref={heroOuterRef} className="absolute inset-0 overflow-hidden">
        <div ref={heroInnerRef} className="absolute inset-0 overflow-hidden">
          {/* Mobile hero — endast text. Telefonen renderas i FixedPhoneLayer (samma som desktop) så den aldrig kan scrollas iväg eller klippas. */}
          <section
            className="relative h-full w-screen overflow-hidden lg:hidden"
            style={{ marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }}
            aria-labelledby="audience-hero-heading-mobile"
          >
            <motion.div
              data-hero-phone-anchor
              className="pointer-events-none relative z-10 mx-auto flex w-full max-w-[1180px] flex-col items-center px-5 pt-[clamp(5.25rem,12svh,6rem)] text-center"
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
          </section>

          {/* Desktop hero */}
          <section className="relative hidden h-full items-center justify-center overflow-hidden px-5 pb-16 pt-28 sm:px-6 md:px-12 lg:flex lg:px-24">
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -top-40 right-[-25%] h-[640px] w-[640px] rounded-full bg-secondary/[0.06] blur-[180px]"
              animate={{ opacity: [0.5, 0.75, 0.5] }}
              transition={{ duration: 9, ease: 'easeInOut', repeat: Infinity }}
            />
            <div className="relative z-10 mx-auto grid w-full max-w-[1280px] items-start gap-12 md:grid-cols-2 lg:gap-16 2xl:max-w-[1440px]">
              <motion.div
                ref={heroTextRef}
                className="-translate-y-16 pt-8 text-left xl:pt-10"
                initial="hidden"
                animate="visible"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.18, delayChildren: 0.1 } } }}
              >
                <HeroText eyebrow={c.eyebrow} headline={c.hero.headline} subtitle={c.hero.subtitle} variant="desktop" />
              </motion.div>
              <div aria-hidden className="relative mx-auto flex w-full items-start justify-center pt-8 xl:pt-10" />
            </div>
          </section>
        </div>
      </div>

      {/* INTRO LAGER (kommer uppifrån) */}
      {/* Inline opacity:0 håller intro-lagret osynligt innan GSAP hinner ladda
          dynamiskt — annars syns "Söka jobb…" en bråkdel av en sekund och täcker
          hero-texten, vilket upplevs som en flash. GSAP tar över via autoAlpha
          så fort den laddats och kan animera in lagret normalt vid scroll. */}
      <div
        ref={introOuterRef}
        className="absolute inset-0 z-30 overflow-hidden"
        style={{ opacity: 0 }}
      >
        <div ref={introInnerRef} className="absolute inset-0 overflow-hidden">
          <section
            aria-label="Introduktion"
            className="relative flex h-full w-full items-center justify-center overflow-hidden px-5 py-24 sm:px-6 md:px-12 lg:px-24"
            style={{
              backgroundImage:
                'linear-gradient(180deg, hsl(215 80% 22%) 0%, hsl(var(--primary)) 100%)',
              backgroundAttachment: 'scroll',
              backgroundSize: '100% 100svh',
              backgroundRepeat: 'no-repeat',
              backgroundColor: 'hsl(var(--primary))',
            }}
          >
            {/* Samma bubblor som hero — så de inte "försvinner" när intro-lagret täcker bakgrunden */}
            <AnimatedBackground variant="card" />
            <div ref={introTextRef} className="relative z-10 flex max-w-4xl flex-col items-center text-center will-change-transform">
              <h2
                data-intro-heading
                className="mb-8 max-w-4xl text-[3.25rem] font-black leading-[1.04] tracking-[-0.025em] text-white sm:text-[4rem] md:text-[5rem] lg:text-[6rem] 2xl:text-[7rem]"
              >
                Vi har gjort det enkelt för alla!
              </h2>
              <IntroText
                paragraphs={[
                  'Med Parium hittar du jobbannonser från arbetsgivare över hela Sverige. Du ansöker snabbt och smidigt direkt i appen eller på webben.',
                  'Ditt CV och din profil sparas på ett och samma ställe, vilket gör det enkelt att söka flera jobb utan att behöva fylla i samma information varje gång.',
                  'I nästa sektion ser du olika exemplar på yrken som tar Sverige framåt!',
                ]}
              />
              {onIntroCta && (
                <button
                  type="button"
                  data-intro-anim
                  onClick={onIntroCta}
                  className="mt-10 inline-flex items-center justify-center rounded-full bg-secondary px-8 py-4 text-base font-semibold text-white shadow-[0_10px_40px_-12px_hsl(var(--secondary)/0.6)] transition-colors duration-200 hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary sm:text-lg"
                >
                  {introCtaLabel ?? 'Skapa min profil idag'}
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
};


const AudienceLanding = ({ audience }: AudienceLandingProps) => {
  const navigate = useNavigate();
  const c = audienceContent[audience];

  // Matchar Tailwinds `md`-breakpoint (768px) så vi monterar bara EN SplinePhone
  // åt gången — annars initieras Spline-runtime två gånger på desktop.
  // Mobil-hero används för telefon OCH surfplattor (< 1024px) så iPad/Android-tabs
  // får samma full-bleed-Spline-upplevelse som telefon. Desktop-split tar över ≥ 1024px.
  const [isDesktopHero, setIsDesktopHero] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 1024px)').matches;
  });
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktopHero(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // (Tidigare scroll-jack med IntersectionObserver + tvingad scrollTop togs bort —
  // den slogs mot CSS scroll-snap och orsakade lagg/jitter. CSS scroll-snap
  // (scrollSnapType: 'y mandatory' + scrollSnapStop: 'always') sköter snappet.)

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
      <AnimatedBackground />
      <FixedPhoneLayer />
      <div className="relative z-10 min-h-full">
        <LandingNav onLoginClick={handleLogin} links={navLinks} />


        <main>
          <HeroIntroStage c={c} isDesktopHero={isDesktopHero} onIntroCta={handleStart} introCtaLabel="Skapa min profil idag" />


          {/* ──────────────── 2. SÅ FUNKAR DET (pinned headline → horisontell mediestrip) ──────────────── */}
          <section id="sa-funkar-det" aria-labelledby="sa-funkar-det-heading" className="scroll-mt-24">
            <h2 id="sa-funkar-det-heading" className="sr-only">Så funkar det</h2>
            <PinnedHorizontalGallery />
          </section>

          {/* ──────────────── 3. STATEMENT ──────────────── */}
          <section className="relative overflow-hidden px-5 py-12 sm:px-6 sm:py-20 md:px-12 md:py-28 lg:px-24">
            <div className="mx-auto grid max-w-[1180px] gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-end">
              <motion.h2
                initial={{ opacity: 0, x: -80 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 1, ease }}
                className="text-4xl font-black leading-[1.02] tracking-[-0.025em] text-white sm:text-5xl md:text-6xl lg:text-[4.75rem]"
              >
                En lugnare väg till nästa steg.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, x: 80 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 1, ease, delay: 0.1 }}
                className="text-base leading-8 text-white/60 sm:text-lg"
              >
                Platshållartext. Här kan en lugnare brödtext landa efter den intensiva resan — rytm är viktigt.
              </motion.p>
            </div>
          </section>

          {/* ──────────────── FUNKTIONER ──────────────── */}
          <section id="funktioner" aria-labelledby="funktioner-heading" className="relative scroll-mt-24 overflow-hidden px-5 py-28 sm:px-6 md:px-12 lg:px-24">
            <div className="mx-auto max-w-[1180px]">
              <motion.span
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.7, ease }}
                className="block text-xs font-bold uppercase tracking-[0.32em] text-secondary/85"
              >
                Funktioner
              </motion.span>
              <motion.h2
                id="funktioner-heading"
                initial={{ opacity: 0, x: -60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.9, ease, delay: 0.05 }}
                className="mt-4 max-w-3xl text-4xl font-black leading-[1.04] tracking-[-0.025em] text-white sm:text-5xl md:text-6xl"
              >
                Allt du behöver för att {audience === 'job_seeker' ? 'hitta rätt jobb' : 'hitta rätt person'}.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, x: 60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.9, ease, delay: 0.15 }}
                className="mt-6 max-w-2xl text-base leading-8 text-white/60 sm:text-lg"
              >
                Platshållartext för funktionsöversikten — fyll med de viktigaste fördelarna.
              </motion.p>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.15 }}
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }}
                className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              >
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <motion.div
                    key={i}
                    variants={{
                      hidden: { opacity: 0 },
                      visible: { opacity: 1, transition: { duration: 0.9, ease } },
                    }}
                    className="group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.035] p-7 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:border-white/[0.14] hover:bg-white/[0.06] hover:shadow-[0_30px_80px_-30px_hsl(var(--secondary)/0.4)]"
                  >
                    <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,hsl(var(--secondary)/0.12),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
                      <span className="text-sm font-bold">0{i}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white">Funktion {i}</h3>
                    <p className="mt-2 text-sm leading-7 text-white/60">
                      Platshållartext som beskriver funktionen kort och tydligt.
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          {/* ──────────────── PRISER ──────────────── */}
          <section id="priser" aria-labelledby="priser-heading" className="relative scroll-mt-24 overflow-hidden px-5 py-28 sm:px-6 md:px-12 lg:px-24">
            <div className="mx-auto max-w-[1180px]">
              <motion.div
                initial={{ opacity: 0, x: -60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.9, ease }}
                className="max-w-2xl"
              >
                <span className="text-xs font-bold uppercase tracking-[0.32em] text-secondary/85">Priser</span>
                <h2 id="priser-heading" className="mt-4 text-4xl font-black leading-[1.04] tracking-[-0.025em] text-white sm:text-5xl md:text-6xl">
                  {audience === 'job_seeker' ? 'Gratis för dig som söker jobb.' : 'Transparenta priser. Inga överraskningar.'}
                </h2>
                <p className="mt-6 max-w-xl text-base leading-8 text-white/60 sm:text-lg">
                  Platshållartext för prismodellen. Lägg in planer eller "från X kr/mån".
                </p>
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }}
                className="mt-12 grid gap-5 md:grid-cols-2"
              >
                {['Start', 'Premium'].map((plan, i) => (
                  <motion.div
                    key={plan}
                    variants={{
                      hidden: { opacity: 0 },
                      visible: { opacity: 1, transition: { duration: 0.9, ease } },
                    }}
                    className={`relative overflow-hidden rounded-3xl border p-8 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 ${
                      i === 1
                        ? 'border-secondary/40 bg-gradient-to-br from-secondary/10 to-white/[0.04] shadow-[0_30px_80px_-30px_hsl(var(--secondary)/0.5)]'
                        : 'border-white/[0.08] bg-white/[0.04] hover:border-white/[0.16]'
                    }`}
                  >
                    {i === 1 && (
                      <span className="absolute right-6 top-6 rounded-full bg-secondary/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                        Populär
                      </span>
                    )}
                    <h3 className="text-xl font-bold text-white">{plan}</h3>
                    <p className="mt-2 text-3xl font-black text-white">— kr<span className="text-sm font-medium text-white/50">/mån</span></p>
                    <p className="mt-4 text-sm leading-7 text-white/60">Platshållare för planbeskrivning.</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          {/* ──────────────── FAQ ──────────────── */}
          <section id="faq" aria-labelledby="faq-heading" className="relative scroll-mt-24 overflow-hidden px-5 py-28 sm:px-6 md:px-12 lg:px-24">
            <div className="mx-auto max-w-[880px]">
              <motion.div
                initial={{ opacity: 0, x: -60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.9, ease }}
              >
                <span className="text-xs font-bold uppercase tracking-[0.32em] text-secondary/85">Vanliga frågor</span>
                <h2 id="faq-heading" className="mt-4 text-4xl font-black leading-[1.04] tracking-[-0.025em] text-white sm:text-5xl">
                  Frågor & svar
                </h2>
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.15 }}
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
                    className="group rounded-2xl border border-white/[0.07] bg-white/[0.035] px-6 py-5 backdrop-blur-xl transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between text-base font-semibold text-white">
                      {q}
                      <span className="ml-4 text-secondary transition-transform duration-300 group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-4 text-sm leading-7 text-white/60">
                      Platshållarsvar — fyll på med den faktiska informationen.
                    </p>
                  </motion.details>
                ))}
              </motion.div>
            </div>
          </section>

          {/* ──────────────── KONTAKT ──────────────── */}
          <section id="kontakt" aria-labelledby="kontakt-heading" className="relative scroll-mt-24 overflow-hidden px-5 py-28 sm:px-6 md:px-12 lg:px-24">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.9, ease }}
              className="mx-auto max-w-[920px] text-center"
            >
              <span className="text-xs font-bold uppercase tracking-[0.32em] text-secondary/85">Kontakt</span>
              <h2 id="kontakt-heading" className="mt-4 text-4xl font-black leading-[1.04] tracking-[-0.025em] text-white sm:text-5xl">
                Vi finns här för dig.
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-white/60 sm:text-lg">
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


          {/* ──────────────── 4. BOUNCY FOOTER CTA ──────────────── */}
          <BouncyFooter audience={audience} onCta={handleStart} />

        </main>
      </div>
    </div>
  );
};

export default AudienceLanding;
