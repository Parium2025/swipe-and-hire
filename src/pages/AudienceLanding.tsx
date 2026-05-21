import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import LandingNav, { type LandingNavLink } from '@/components/LandingNav';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { syncBrowserChrome } from '@/lib/browserChrome';
import PinnedHorizontalGallery from '@/components/landing/audience/PinnedHorizontalGallery';
import BouncyFooter from '@/components/landing/audience/BouncyFooter';
import { audienceContent, type AudienceRole } from '@/components/landing/audience/content';

import { HeroText } from '@/components/landing/audience/HeroText';
import FixedPhoneLayer from '@/components/landing/audience/FixedPhoneLayer';
import { IntroText } from '@/components/landing/audience/IntroText';

type AudienceLandingProps = {
  audience: AudienceRole;
};

const ease = [0.16, 1, 0.3, 1] as const;




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
