import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useAnimationControls } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import LandingNav, { type LandingNavLink } from '@/components/LandingNav';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { syncBrowserChrome } from '@/lib/browserChrome';
import PinnedHorizontalGallery from '@/components/landing/audience/PinnedHorizontalGallery';
import BouncyFooter from '@/components/landing/audience/BouncyFooter';
import { audienceContent, type AudienceRole } from '@/components/landing/audience/content';
import panelImg1 from '@/assets/landing/jobseeker-placeholder-1.jpg';
import panelImg2 from '@/assets/landing/jobseeker-placeholder-2.jpg';
import panelImg3 from '@/assets/landing/jobseeker-placeholder-3.jpg';
import panelImg4 from '@/assets/landing/jobseeker-placeholder-4.jpg';
import { SplinePhone } from '@/components/landing/SplinePhone';
import { HeroText } from '@/components/landing/audience/HeroText';

// 🖼️ Provisional placeholder images for the 4 horizontal scroll panels.
// Swap these out via the imports above when final brand photography is ready.
const panelImages = [panelImg1, panelImg2, panelImg3, panelImg4];

const PanelImage = ({ src, alt }: { src: string; alt: string }) => (
  <div className="relative mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.03] shadow-[0_40px_120px_hsl(var(--background)/0.6)]">
    <img
      src={src}
      alt={alt}
      width={768}
      height={1280}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
    />
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
  </div>
);

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
  onStart: () => void;
};

const FixedPhoneLayer = () => {
  const phoneFrameRef = useRef<HTMLDivElement | null>(null);
  const phoneControls = useAnimationControls();
  const [hidden, setHidden] = useState(false);

  // Telefonen är bara dekorativ här: den får aldrig fånga wheel/touch och låsa
  // scrollen. Animationsstate styrs imperativt så den inte "poppar" tillbaka.
  useEffect(() => {
    const onIndex = (e: Event) => {
      const detail = (e as CustomEvent<{ index: number; direction?: 'next' | 'prev' }>).detail;

      if (detail?.index === 1) {
        setHidden(true);
        phoneControls.start({
          opacity: 0,
          y: -64,
          scale: 0.965,
          transition: { duration: 0.72, ease },
        });
        return;
      }

      setHidden(false);
      phoneControls.stop();
      phoneControls.set({ opacity: 0, x: 0, y: 72, scale: 0.965 });
      phoneControls.start({
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        transition: { duration: 0.82, ease, delay: 0.08 },
      });
    };

    phoneControls.start({
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: { duration: 1.1, ease },
    });

    window.addEventListener('parium:hero-index', onIndex);
    return () => window.removeEventListener('parium:hero-index', onIndex);
  }, [phoneControls]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 hidden h-[100svh] items-center justify-center overflow-hidden px-5 pb-16 pt-28 sm:px-6 md:px-12 lg:flex lg:px-24"
      aria-hidden={hidden}
    >
      <div className="mx-auto grid w-full max-w-[1280px] items-start gap-12 md:grid-cols-2 lg:gap-16 2xl:max-w-[1440px]">
        <div aria-hidden />
        <motion.div
          ref={phoneFrameRef}
          initial={{ opacity: 0, x: 60, scale: 0.96 }}
          animate={phoneControls}
          className="pointer-events-none relative mx-auto flex w-fit items-start justify-center pt-8 will-change-transform xl:pt-10"
          style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
        >
          <SplinePhone className="h-[min(68svh,660px)] w-auto aspect-[9/19.5]" zoom={0.78} />
        </motion.div>
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
const HeroIntroStage = ({ c, isDesktopHero, onStart }: HeroIntroStageProps) => {
  const stageRef = useRef<HTMLElement | null>(null);
  const heroOuterRef = useRef<HTMLDivElement | null>(null);
  const heroInnerRef = useRef<HTMLDivElement | null>(null);
  const introOuterRef = useRef<HTMLDivElement | null>(null);
  const introInnerRef = useRef<HTMLDivElement | null>(null);
  const indexRef = useRef(0); // 0 = hero, 1 = intro
  const animatingRef = useRef(false);
  const armedForNextRef = useRef(false);
  const releaseTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let observer: { kill: () => void } | null = null;
    let intersectObs: IntersectionObserver | null = null;
    let inView = true;

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
      const stage = stageRef.current;
      const scrollRoot = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;
      if (!heroOuter || !heroInner || !introOuter || !introInner || !stage) return;

      const clearReleaseTimer = () => {
        if (releaseTimerRef.current) {
          window.clearTimeout(releaseTimerRef.current);
          releaseTimerRef.current = null;
        }
      };

      const armAfterGestureStops = () => {
        clearReleaseTimer();
        releaseTimerRef.current = window.setTimeout(() => {
          if (indexRef.current === 1 && !animatingRef.current) {
            armedForNextRef.current = true;
          }
        }, 420);
      };

      // Initial state: hero synlig, intro gömd UNDER skärmen.
      gsap.set(heroOuter, { yPercent: 0, autoAlpha: 1 });
      gsap.set(heroInner, { yPercent: 0 });
      gsap.set(introOuter, { yPercent: 100, autoAlpha: 0 });
      gsap.set(introInner, { yPercent: -100 });

      const goToIntro = () => {
        if (animatingRef.current || indexRef.current === 1) return;
        animatingRef.current = true;
        armedForNextRef.current = false;
        clearReleaseTimer();
        indexRef.current = 1;
        window.dispatchEvent(new CustomEvent('parium:hero-index', { detail: { index: 1, direction: 'next' } }));

        const tl = gsap.timeline({
          defaults: { duration: 1.1, ease: 'power2.inOut' },
          onComplete: () => {
            animatingRef.current = false;
            armAfterGestureStops();
          },
        });
        // Hero åker UPP och ut
        tl.to(heroOuter, { yPercent: -100 }, 0);
        tl.to(heroInner, { yPercent: 100 }, 0);
        // Intro kommer UPP nerifrån
        tl.set(introOuter, { autoAlpha: 1 }, 0);
        tl.fromTo(introOuter, { yPercent: 100 }, { yPercent: 0 }, 0);
        tl.fromTo(introInner, { yPercent: -100 }, { yPercent: 0 }, 0);
      };

      const goToHero = () => {
        if (animatingRef.current || indexRef.current === 0) return;
        animatingRef.current = true;
        armedForNextRef.current = false;
        clearReleaseTimer();
        indexRef.current = 0;
        window.dispatchEvent(new CustomEvent('parium:hero-index', { detail: { index: 0, direction: 'prev' } }));

        const tl = gsap.timeline({
          defaults: { duration: 1.1, ease: 'power2.inOut' },
          onComplete: () => { animatingRef.current = false; },
        });
        // Intro åker NED och ut
        tl.to(introOuter, { yPercent: 100 }, 0);
        tl.to(introInner, { yPercent: -100 }, 0);
        tl.set(introOuter, { autoAlpha: 0 });
        // Hero kommer tillbaka uppifrån
        tl.fromTo(heroOuter, { yPercent: -100 }, { yPercent: 0 }, 0);
        tl.fromTo(heroInner, { yPercent: 100 }, { yPercent: 0 }, 0);
      };

      const releaseAndScrollNext = () => {
        if (!armedForNextRef.current) {
          armAfterGestureStops();
          return;
        }
        armedForNextRef.current = false;
        clearReleaseTimer();
        // Användaren är på Intro och scrollar ner igen → släpp kontrollen.
        const root = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;
        if (!root) return;
        const next = document.getElementById('sa-funkar-det');
        if (!next) return;
        const rect = next.getBoundingClientRect();
        const target = root.scrollTop + rect.top;
        root.scrollTo({ top: target, behavior: 'smooth' });
      };

      observer = Observer.create({
        target: scrollRoot ?? window,
        type: 'wheel,touch',
        wheelSpeed: -1,
        tolerance: 32,
        preventDefault: true,
        onUp: () => {
          if (!inView) return;
          if (animatingRef.current) return;
          if (indexRef.current === 0) goToIntro();
          else releaseAndScrollNext();
        },
        onDown: () => {
          if (!inView) return;
          if (animatingRef.current) return;
          if (indexRef.current === 1) goToHero();
        },
      });

      // Stäng av Observer när stage inte är i viewport (så resten av sidan kan scrollas fritt).
      intersectObs = new IntersectionObserver(
        (entries) => {
          for (const e of entries) inView = e.isIntersecting && e.intersectionRatio > 0.4;
          if (observer) {
            // @ts-expect-error gsap Observer har enable/disable
            inView ? observer.enable?.() : observer.disable?.();
          }
        },
        { root: scrollRoot, threshold: [0, 0.4, 0.6, 1] }
      );
      intersectObs.observe(stage);
    };

    setup();

    return () => {
      cancelled = true;
      observer?.kill();
      intersectObs?.disconnect();
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
      <div ref={introOuterRef} className="absolute inset-0 z-30 overflow-hidden">
        <div ref={introInnerRef} className="absolute inset-0 overflow-hidden">
          <section
            aria-label="Introduktion"
            className="relative flex h-full w-full items-center justify-center overflow-hidden bg-primary px-5 py-24 sm:px-6 md:px-12 lg:px-24"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-white/15" />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(900px 600px at 100% 110%, hsl(var(--secondary) / 0.14), transparent 65%), linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(215 80% 22%) 50%, hsl(var(--primary)) 100%)',
              }}
            />
            <div className="relative z-10 flex max-w-4xl flex-col items-center">
              <IntroText
                paragraphs={[
                  'Söka jobb ska vara enkelt, oavsett vilken typ av tjänst du letar efter. Med Parium hittar du jobbannonser från arbetsgivare över hela Sverige. Du ansöker snabbt och smidigt direkt i appen eller på webben.',
                  'Ditt CV och din profil sparas på ett och samma ställe, vilket gör det enkelt att söka flera jobb utan att behöva fylla i samma information varje gång.',
                ]}
              />
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onPointerDown={onStart}
                  className="group inline-flex min-h-touch items-center justify-center gap-3 rounded-full border border-white/20 bg-white/10 px-7 py-3.5 text-sm font-bold text-white shadow-[0_18px_55px_hsl(var(--background)/0.4)] transition-all hover:bg-white/15 hover:shadow-[0_22px_70px_hsl(var(--background)/0.5)]"
                >
                  {c.hero.cta}
                  <ArrowRight className="h-4 w-4 text-white transition-transform group-hover:translate-x-1" />
                </button>
              </div>
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

  // 4-panel scroll-jacked horizontal section. Texterna är platshållare.
  const panels = [
    {
      eyebrow: c.eyebrow,
      title: <>Något som <span className="text-secondary">fångar</span> direkt.</>,
      body: 'Platshållartext. Här ska första budskapet ligga — det som hookar besökaren.',
      visual: <PanelImage src={panelImages[0]} alt="Person som arbetar fokuserat vid laptop" />,
    },
    {
      eyebrow: 'Steg 01',
      title: <>Berätta vad du <span className="text-secondary">söker</span>.</>,
      body: 'Platshållartext. Förklarar steg 1 i flödet.',
      visual: <PanelImage src={panelImages[1]} alt="Person som ler och tittar på sin telefon" />,
    },
    {
      eyebrow: 'Steg 02',
      title: <>Vi matchar <span className="text-secondary">automatiskt</span>.</>,
      body: 'Platshållartext. Förklarar matchnings­logiken på ett enkelt sätt.',
      visual: <PanelImage src={panelImages[2]} alt="Två kollegor i samtal på ett modernt kontor" />,
    },
    {
      eyebrow: 'Steg 03',
      title: <>Ta kontakt på <span className="text-secondary">sekunder</span>.</>,
      body: 'Platshållartext. Sista steget — handling, dialog, nästa steg.',
      visual: <PanelImage src={panelImages[3]} alt="Hantverkare som arbetar i en ljus verkstad" />,
    },
  ];

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
        backgroundImage:
          'radial-gradient(1200px 700px at 12% -10%, hsl(var(--secondary) / 0.18), transparent 60%), radial-gradient(900px 600px at 100% 110%, hsl(var(--secondary) / 0.14), transparent 65%), linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(215 80% 22%) 50%, hsl(var(--primary)) 100%)',
      }}
    >
      <AnimatedBackground />
      {isDesktopHero && <FixedPhoneLayer />}
      <div className="relative z-10 min-h-full">
        <LandingNav onLoginClick={handleLogin} links={navLinks} />


        <motion.main
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <HeroIntroStage c={c} isDesktopHero={isDesktopHero} onStart={handleStart} />


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

        </motion.main>
      </div>
    </div>
  );
};

export default AudienceLanding;
