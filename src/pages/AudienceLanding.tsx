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
  <div className="max-w-3xl text-center text-base leading-[1.75] text-white/80 sm:text-lg md:text-xl">
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
};

const FixedPhoneLayer = () => {
  const [visible, setVisible] = useState(true);
  const [active, setActive] = useState(true);
  const [phoneReady, setPhoneReady] = useState(false);
  const heroIndexRef = useRef(0);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVisibleRef = useRef(true);

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

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 hidden h-[100svh] items-center justify-center overflow-hidden px-5 pb-16 pt-28 sm:px-6 md:px-12 lg:flex lg:px-24"
      aria-hidden="true"
    >
      <div className="mx-auto grid w-full max-w-[1280px] items-start gap-12 md:grid-cols-2 lg:gap-16 2xl:max-w-[1440px]">
        <div aria-hidden />
        <div
          data-phone-scroll-forward
          className={`${visible && phoneReady ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'} relative mx-auto flex w-fit items-start justify-center pt-8 transition-opacity duration-500 ease-out xl:pt-10`}
          style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
        >
          <SplinePhone
            className="h-[min(68svh,660px)] w-auto aspect-[9/19.5]"
            zoom={0.78}
            active={active}
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
const HeroIntroStage = ({ c, isDesktopHero }: HeroIntroStageProps) => {
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
      const introTextItems = introText ? gsap.utils.toArray<HTMLElement>(introText.querySelectorAll('p')) : [];
      let releasedToGallery = false;
      let programmaticReturn = false;
      let prevScrollTop = scrollRoot?.scrollTop ?? 0;

      let observerActive = false;
      const setObserverActive = (active: boolean) => {
        if (!observer || active === observerActive) return;
        observerActive = active;
        if (active) observer.enable?.();
        else observer.disable?.();
      };

      const clearReturnWork = () => {
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
        gsap.killTweensOf([heroOuter, heroInner, introOuter, introInner, introText, ...introTextItems].filter(Boolean));
        gsap.set(heroOuter, { yPercent: 0, autoAlpha: 1 });
        gsap.set(heroInner, { yPercent: 0 });
        gsap.set(introOuter, { yPercent: 100, autoAlpha: 0 });
        gsap.set(introInner, { yPercent: -100 });
        if (introText) gsap.set(introText, { opacity: 1, clearProps: 'transform' });
        gsap.set(introTextItems, { y: 44, opacity: 0 });
        indexRef.current = 0;
      };

      const setIntroResting = () => {
        gsap.killTweensOf([heroOuter, heroInner, introOuter, introInner, introText, ...introTextItems].filter(Boolean));
        gsap.set(heroOuter, { yPercent: -100, autoAlpha: 1 });
        gsap.set(heroInner, { yPercent: 100 });
        gsap.set(introOuter, { yPercent: 0, autoAlpha: 1 });
        gsap.set(introInner, { yPercent: 0 });
        if (introText) gsap.set(introText, { opacity: 1, clearProps: 'transform' });
        // När intro ligger stilla ska texten inte längre ligga på ett GSAP-
        // transformlager. På hård scroll mot 3:an kunde compositing annars ge
        // en ghost/dubblett-frame av texten i Chrome/Lovable-preview.
        gsap.set(introTextItems, { opacity: 1, clearProps: 'transform' });
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
        tl.fromTo(introTextItems, { y: 44, opacity: 0 }, { y: 0, opacity: 1, duration: 0.62, stagger: 0.08, ease: 'power2.out' }, 0.48);
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
        tl.to(introOuter, { yPercent: 100 }, 0);
        tl.to(introInner, { yPercent: -100 }, 0);
        tl.set(introOuter, { autoAlpha: 0 });
        tl.fromTo(heroOuter, { yPercent: -100 }, { yPercent: 0 }, 0);
        tl.fromTo(heroInner, { yPercent: 100 }, { yPercent: 0 }, 0);
        // heroTextItems-tween borttagen — framer-motion ägde entrén och
        // återkomst-fade hanteras visuellt via layerns yPercent-slide.
      };

      // 2↔3 = NATURLIG scroll. Inget GSAP-driv av scrollTop, inga
      // programstyrda transitions. Anledningen: 1↔2 är smooth eftersom
      // det är en ren CSS-transform utan scroll inblandat. När vi i 2↔3
      // körde GSAP som skrev scrollTop varje frame SAMTIDIGT som galleriet
      // läste scrollTop för att rita kortens transform fick vi två källor
      // till sanning per frame → synligt skak/hopp. Lösning: släpp scrollen
      // helt till browsern, så följer både intro-lagret (i normalt flöde)
      // och galleriets sticky-progress samma scroll-position automatiskt.
      // Kort wheel/touch-block (~700ms) under 2→3 smooth-scroll så att
      // användarens kvarvarande wheel-momentum inte konkurrerar med
      // browserns native smooth-scroll → annars syns "hack" vid hård scroll.
      let transitionBlockUntil = 0;
      const blockNativeInput = (e: Event) => {
        if (performance.now() < transitionBlockUntil) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      scrollRoot?.addEventListener('wheel', blockNativeInput, { passive: false, capture: true });
      scrollRoot?.addEventListener('touchmove', blockNativeInput, { passive: false, capture: true });

      const releaseAndScrollNext = () => {
        const root = scrollRoot;
        const next = document.getElementById('sa-funkar-det');
        if (!root || !next) return;
        if (animatingRef.current) return;
        releasedToGallery = true;
        programmaticReturn = true;
        setObserverActive(false);
        window.dispatchEvent(new CustomEvent('parium:hero-index', { detail: { index: 2, direction: 'next' } }));
        const startScroll = root.scrollTop;
        const targetScroll = startScroll + next.getBoundingClientRect().top;
        gsap.killTweensOf([introText, ...introTextItems].filter(Boolean));
        gsap.set(introTextItems, { opacity: 1, clearProps: 'transform' });
        if (introText) {
          gsap.fromTo(
            introText,
            { y: 0, opacity: 1 },
            { y: -24, opacity: 0, duration: 0.42, ease: 'power2.out', force3D: true },
          );
        }
        prevScrollTop = startScroll;
        transitionBlockUntil = performance.now() + 700;
        root.scrollTo({ top: targetScroll, behavior: 'smooth' });
        window.dispatchEvent(new Event('parium:gallery-enter'));
        forwardTimer = window.setTimeout(() => {
          programmaticReturn = false;
          const moved = Math.abs(root.scrollTop - startScroll);
          if (moved < 24) {
            root.scrollTo({ top: targetScroll, behavior: 'auto' });
          }
          prevScrollTop = root.scrollTop;
          // Säkerhetsnät: släpp ALLTID releaseLockedRef efter att 2→3 är klart,
          // även om scroll-positionen inte hann triggra normalisering. Annars
          // kunde låset bli "kvar i true" om användaren scrollar snabbt 20-30
          // gånger och en gest kapas av nästa innan onScrollWatch hann reagera.
          releaseLockedRef.current = false;
          forwardTimer = null;
        }, 900);
      };

      const returnFromGalleryToIntro = () => {
        if (!scrollRoot || programmaticReturn || animatingRef.current) return;
        programmaticReturn = true;
        releasedToGallery = false;
        releaseLockedRef.current = false;
        setObserverActive(true);
        setIntroResting();
        window.dispatchEvent(new Event('parium:gallery-leave'));
        const target = scrollRoot.scrollTop + stage.getBoundingClientRect().top;
        scrollRoot.scrollTo({ top: target, behavior: 'smooth' });
        window.dispatchEvent(new CustomEvent('parium:hero-index', { detail: { index: 1, direction: 'prev' } }));
        window.setTimeout(() => {
          programmaticReturn = false;
          prevScrollTop = scrollRoot.scrollTop;
        }, 700);
      };

      observer = Observer.create({
        target: scrollRoot ?? window,
        type: 'wheel,touch',
        wheelSpeed: -1,
        tolerance: 16,
        preventDefault: true,
        onUp: () => {
          if (releasedToGallery || programmaticReturn || animatingRef.current) return;
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
          if (indexRef.current === 1) goToHero();
        },
      });
      observerActive = true;

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
          if (direction === 'up' && rect.bottom > vh * 0.18 && rect.top < vh * 0.82) {
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

      setupTeardown = () => {
        clearReturnWork();
        scrollRoot?.removeEventListener('scroll', onScrollWatch);
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
          {/* Mobile hero */}
          <section
            className="relative flex h-full w-screen overflow-hidden lg:hidden"
            style={{ marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }}
            aria-labelledby="audience-hero-heading-mobile"
          >
            <div className="absolute inset-0 -z-0 flex items-center justify-center">
              {!isDesktopHero && <SplinePhone className="h-[80svh] w-full max-w-[520px]" />}
            </div>
            <motion.div
              className="pointer-events-none relative z-10 mx-auto flex h-full max-w-[1180px] flex-col items-center justify-center px-5 pb-20 pt-28 text-center"
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
            <div ref={introTextRef} className="relative z-10 flex max-w-4xl flex-col items-center will-change-transform">
              <IntroText
                paragraphs={[
                  'Söka jobb ska vara enkelt, oavsett vilken typ av tjänst du letar efter. Med Parium hittar du jobbannonser från arbetsgivare över hela Sverige. Du ansöker snabbt och smidigt direkt i appen eller på webben.',
                  'Ditt CV och din profil sparas på ett och samma ställe, vilket gör det enkelt att söka flera jobb utan att behöva fylla i samma information varje gång.',
                ]}
              />
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
      {isDesktopHero && <FixedPhoneLayer />}
      <div className="relative z-10 min-h-full">
        <LandingNav onLoginClick={handleLogin} links={navLinks} />


        <main>
          <HeroIntroStage c={c} isDesktopHero={isDesktopHero} />


          {/* ──────────────── 2. SÅ FUNKAR DET (pinned headline → horisontell mediestrip) ──────────────── */}
          <section id="sa-funkar-det" aria-labelledby="sa-funkar-det-heading" className="scroll-mt-24">
            <h2 id="sa-funkar-det-heading" className="sr-only">Så funkar det</h2>
            <PinnedHorizontalGallery />
          </section>

          {/* ──────────────── 3. STATEMENT ──────────────── */}
          <section className="relative overflow-hidden px-5 py-28 sm:px-6 md:px-12 lg:px-24">
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
