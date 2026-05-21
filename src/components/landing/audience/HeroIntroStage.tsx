import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { audienceContent, type AudienceRole } from '@/components/landing/audience/content';
import { HeroText } from '@/components/landing/audience/HeroText';
import { IntroText } from '@/components/landing/audience/IntroText';

type HeroIntroStageProps = {
  c: (typeof audienceContent)[AudienceRole];
  isDesktopHero: boolean;
  onIntroCta?: () => void;
  introCtaLabel?: string;
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
          const stageBottom = stage.getBoundingClientRect().bottom;
          const wheelBack = e instanceof WheelEvent && e.deltaY < -8;
          const touch = e instanceof TouchEvent ? e.touches[0] : null;
          const touchBack = touch && galleryTouchY !== null ? galleryTouchY - touch.clientY < -6 : false;
          if (touch) galleryTouchY = touch.clientY;

          if (stageBottom >= -2 && (wheelBack || touchBack)) {
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
      const isTouchDevice = () => {
        if (typeof window === 'undefined') return false;
        return ('ontouchstart' in window) || (navigator.maxTouchPoints ?? 0) > 0;
      };
      const withScrollBehaviorAuto = ({ pulseOverflow = isTouchDevice() } = {}) => {
        if (!scrollRoot) return;
        restoreScrollBehavior?.();
        const previousScrollBehavior = scrollRoot.style.scrollBehavior;
        const previousOverflowY = scrollRoot.style.overflowY;
        scrollRoot.style.scrollBehavior = 'auto';
        // iOS-momentum tävlar annars med GSAP:s scrollTop-tween. Vi pulsar
        // overflow-y: hidden EN frame ENBART på touch — på desktop ger samma
        // puls ett synligt 1-frame-hack precis när tweenen startar.
        if (pulseOverflow) {
          scrollRoot.style.overflowY = 'hidden';
          requestAnimationFrame(() => {
            if (scrollRoot.style.overflowY === 'hidden') {
              scrollRoot.style.overflowY = previousOverflowY;
            }
          });
        }
        restoreScrollBehavior = () => {
          scrollRoot.style.scrollBehavior = previousScrollBehavior;
          scrollRoot.style.overflowY = previousOverflowY;
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
        // 🔑 Absolut offset — inte rect-delta. Garanterar att vi ALLTID
        // landar på galleriets exakta topp (progress=0 → första kortet)
        // oavsett om scrollroot har drift från tidigare programstyrda tweens.
        const targetScroll = (next as HTMLElement).offsetTop;
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
        programmaticReturn = true;
        animatingRef.current = true;
        releasedToGallery = false;
        releaseLockedRef.current = false;
        setObserverActive(false);
        // Intro ligger redan i "resting" state visuellt (synlig). Vi rör inte
        // text/heading/CTA-opacity — exakt som 1↔2 där hero-texten är synlig
        // hela tiden och bara åker med layern.
        setIntroResting();
        window.dispatchEvent(new Event('parium:gallery-leave'));
        // Absolut offset till intro-stagen — så vi alltid landar pixel-exakt
        // vid intro-toppen, vilket i sin tur gör nästa 2→3 till sectionTop.
        const target = Math.max(0, (stage as HTMLElement).offsetTop);

        lockNativeInput(950); // matchar return-tween (0.82s) + liten momentum-buffer
        withScrollBehaviorAuto();
        window.dispatchEvent(new CustomEvent('parium:hero-index', { detail: { index: 1, direction: 'prev' } }));

        const finishReturn = () => {
          scrollRoot.scrollTop = target;
          restoreScrollBehavior?.();
          restoreScrollBehavior = null;
          transitionBlockUntil = 0;
          programmaticReturn = false;
          animatingRef.current = false;
          prevScrollTop = scrollRoot.scrollTop;
          setObserverActive(true);
        };

        gsap.killTweensOf(scrollRoot);
        // Returen (3→2) använder power3.out istället för power2.inOut: snabb
        // start gör att gesten omedelbart översätts till rörelse (ingen "trög
        // halvsekund"), och en något kortare duration gör att landningen
        // möter användarens swipe-tempo. Forward (2→3) håller power2.inOut
        // för att kännas premium från en lugn intro.
        gsap.to(scrollRoot, {
          scrollTop: target,
          duration: 0.82,
          ease: 'power3.out',
          overwrite: true,
          onComplete: finishReturn,
          onInterrupt: finishReturn,
        });
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
          // Trigga direkt när stagens nederkant precis börjar tittas fram
          // underifrån — då ska 3→2-animationen sätta igång omedelbart och
          // användaren ska inte kunna scrolla vidare upp i galleriet manuellt.
          if (direction === 'up' && rect.bottom > 0) {
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

export default HeroIntroStage;
