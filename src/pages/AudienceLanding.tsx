import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import LandingNav, { type LandingNavLink } from '@/components/LandingNav';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { syncBrowserChrome } from '@/lib/browserChrome';
import HorizontalScrollSection from '@/components/landing/audience/HorizontalScrollSection';
import { audienceContent, type AudienceRole } from '@/components/landing/audience/content';

type AudienceLandingProps = {
  audience: AudienceRole;
};

const ease = [0.16, 1, 0.3, 1] as const;

const AudienceLanding = ({ audience }: AudienceLandingProps) => {
  const navigate = useNavigate();
  const c = audienceContent[audience];

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
    },
    {
      eyebrow: 'Steg 01',
      title: <>Berätta vad du <span className="text-secondary">söker</span>.</>,
      body: 'Platshållartext. Förklarar steg 1 i flödet.',
    },
    {
      eyebrow: 'Steg 02',
      title: <>Vi matchar <span className="text-secondary">automatiskt</span>.</>,
      body: 'Platshållartext. Förklarar matchnings­logiken på ett enkelt sätt.',
    },
    {
      eyebrow: 'Steg 03',
      title: <>Ta kontakt på <span className="text-secondary">sekunder</span>.</>,
      body: 'Platshållartext. Sista steget — handling, dialog, nästa steg.',
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
    <div className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden bg-parium-navy text-primary-foreground">
      <AnimatedBackground />
      <div className="relative z-10 min-h-full">
        <LandingNav onLoginClick={handleLogin} links={navLinks} />


        <motion.main
          initial={{ opacity: 0, y: 24, filter: 'blur(14px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* ──────────────── 1. HERO (vertikal) ──────────────── */}
          <section className="relative flex min-h-[100svh] items-center overflow-hidden px-5 pb-16 pt-28 sm:px-6 md:px-12 lg:px-24">
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -top-40 right-[-25%] h-[640px] w-[640px] rounded-full bg-secondary/[0.06] blur-[180px]"
              animate={{ opacity: [0.5, 0.75, 0.5] }}
              transition={{ duration: 9, ease: 'easeInOut', repeat: Infinity }}
            />

            <motion.div
              className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-col"
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.18, delayChildren: 0.1 } } }}
            >
              <motion.span
                variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease } } }}
                className="text-xs font-bold uppercase tracking-[0.28em] text-secondary/80"
              >
                {c.eyebrow}
              </motion.span>

              <h1 className="mt-6 max-w-4xl text-[3.25rem] font-black leading-[0.94] tracking-[-0.03em] text-white sm:text-[5rem] lg:text-[7rem]">
                {c.hero.headline.map((line, i) => (
                  <motion.span
                    key={i}
                    variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease } } }}
                    className="block"
                  >
                    {line}
                  </motion.span>
                ))}
              </h1>

              <motion.p
                variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease } } }}
                className="mt-7 max-w-xl text-base leading-8 text-white/65 sm:text-lg"
              >
                {c.hero.subtitle}
              </motion.p>

              <motion.div
                variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease } } }}
                className="mt-10"
              >
                <button
                  type="button"
                  onPointerDown={handleStart}
                  className="group inline-flex min-h-touch items-center justify-center gap-3 rounded-full bg-secondary px-7 py-3.5 text-sm font-bold text-secondary-foreground shadow-[0_18px_55px_hsl(var(--secondary)/0.32)] transition-shadow hover:shadow-[0_22px_70px_hsl(var(--secondary)/0.45)]"
                >
                  {c.hero.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </motion.div>
            </motion.div>

            {/* scroll cue */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 0.55, y: 0 }}
              transition={{ delay: 1.6, duration: 0.8, ease }}
              className="pointer-events-none absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55"
            >
              <span>Scrolla</span>
              <motion.span
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity }}
                className="h-6 w-px bg-white/40"
              />
            </motion.div>
          </section>

          {/* ──────────────── 2. SÅ FUNKAR DET (horisontell scroll-jacked) ──────────────── */}
          <section id="sa-funkar-det" aria-labelledby="sa-funkar-det-heading" className="scroll-mt-24">
            <h2 id="sa-funkar-det-heading" className="sr-only">Så funkar det</h2>
            <HorizontalScrollSection panels={panels} panelScrollVh={1} />
          </section>

          {/* ──────────────── 3. STATEMENT (vertikal, lugn paus) ──────────────── */}
          <section className="relative overflow-hidden px-5 py-32 sm:px-6 md:px-12 lg:px-24">
            <div className="mx-auto grid max-w-[1180px] gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-end">
              <motion.h2
                initial={{ opacity: 0, x: -80 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 1, ease }}
                className="text-4xl font-black leading-[0.98] tracking-[-0.025em] text-white sm:text-5xl md:text-6xl lg:text-[5rem]"
              >
                Platshållare för en stor statement-rubrik.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, x: 80 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 1, ease, delay: 0.1 }}
                className="text-base leading-8 text-white/55 sm:text-lg"
              >
                Platshållartext. Här kan en lugnare brödtext landa efter den intensiva horisontella resan — rytm är viktigt.
              </motion.p>
            </div>
          </section>

          {/* ──────────────── FUNKTIONER ──────────────── */}
          <section id="funktioner" aria-labelledby="funktioner-heading" className="relative scroll-mt-24 overflow-hidden px-5 py-28 sm:px-6 md:px-12 lg:px-24">
            <div className="mx-auto max-w-[1180px]">
              <span className="text-xs font-bold uppercase tracking-[0.28em] text-secondary/80">Funktioner</span>
              <h2 id="funktioner-heading" className="mt-4 max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.025em] text-white sm:text-5xl md:text-6xl">
                Allt du behöver för att {audience === 'job_seeker' ? 'hitta rätt jobb' : 'hitta rätt person'}.
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/55 sm:text-lg">
                Platshållartext för funktionsöversikten — fyll med de viktigaste fördelarna.
              </p>
              <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-7 backdrop-blur-xl transition-colors hover:border-white/[0.12] hover:bg-white/[0.05]"
                  >
                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
                      <span className="text-sm font-bold">0{i}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white">Funktion {i}</h3>
                    <p className="mt-2 text-sm leading-7 text-white/55">
                      Platshållartext som beskriver funktionen kort och tydligt.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ──────────────── PRISER ──────────────── */}
          <section id="priser" aria-labelledby="priser-heading" className="relative scroll-mt-24 overflow-hidden px-5 py-28 sm:px-6 md:px-12 lg:px-24">
            <div className="mx-auto max-w-[1180px] text-center">
              <span className="text-xs font-bold uppercase tracking-[0.28em] text-secondary/80">Priser</span>
              <h2 id="priser-heading" className="mt-4 text-4xl font-black leading-[1.02] tracking-[-0.025em] text-white sm:text-5xl md:text-6xl">
                {audience === 'job_seeker' ? 'Gratis för dig som söker jobb.' : 'Transparenta priser. Inga överraskningar.'}
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-white/55 sm:text-lg">
                Platshållartext för prismodellen. Lägg in planer eller "från X kr/mån".
              </p>
              <div className="mx-auto mt-12 grid max-w-3xl gap-5 sm:grid-cols-2">
                {['Start', 'Premium'].map((plan) => (
                  <div
                    key={plan}
                    className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 text-left backdrop-blur-xl"
                  >
                    <h3 className="text-xl font-bold text-white">{plan}</h3>
                    <p className="mt-2 text-3xl font-black text-white">— kr<span className="text-sm font-medium text-white/50">/mån</span></p>
                    <p className="mt-4 text-sm leading-7 text-white/55">Platshållare för planbeskrivning.</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ──────────────── FAQ ──────────────── */}
          <section id="faq" aria-labelledby="faq-heading" className="relative scroll-mt-24 overflow-hidden px-5 py-28 sm:px-6 md:px-12 lg:px-24">
            <div className="mx-auto max-w-[880px]">
              <span className="text-xs font-bold uppercase tracking-[0.28em] text-secondary/80">Vanliga frågor</span>
              <h2 id="faq-heading" className="mt-4 text-4xl font-black leading-[1.02] tracking-[-0.025em] text-white sm:text-5xl">
                Frågor & svar
              </h2>
              <div className="mt-10 space-y-3">
                {['Hur fungerar Parium?', 'Vad kostar det?', 'Är mina uppgifter säkra?', 'Vilka företag finns här?'].map((q) => (
                  <details
                    key={q}
                    className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] px-6 py-5 backdrop-blur-xl transition-colors hover:border-white/[0.12]"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between text-base font-semibold text-white">
                      {q}
                      <span className="ml-4 text-secondary transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-4 text-sm leading-7 text-white/60">
                      Platshållarsvar — fyll på med den faktiska informationen.
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* ──────────────── KONTAKT ──────────────── */}
          <section id="kontakt" aria-labelledby="kontakt-heading" className="relative scroll-mt-24 overflow-hidden px-5 py-28 sm:px-6 md:px-12 lg:px-24">
            <div className="mx-auto max-w-[920px] text-center">
              <span className="text-xs font-bold uppercase tracking-[0.28em] text-secondary/80">Kontakt</span>
              <h2 id="kontakt-heading" className="mt-4 text-4xl font-black leading-[1.02] tracking-[-0.025em] text-white sm:text-5xl">
                Vi finns här för dig.
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-white/55 sm:text-lg">
                Hör av dig så svarar vi snabbt — vi hjälper både kandidater och arbetsgivare.
              </p>
              <a
                href="mailto:hej@parium.se"
                className="mt-8 inline-block text-lg font-semibold text-secondary underline-offset-4 hover:underline"
              >
                hej@parium.se
              </a>
            </div>
          </section>


          {/* ──────────────── 4. FINAL CTA ──────────────── */}
          <section className="relative overflow-hidden px-5 pb-32 pt-16 sm:px-6 md:px-12 lg:px-24">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-0 h-[400px] -translate-y-1/2 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--secondary)/0.18),transparent_70%)]" />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 1, ease }}
              className="relative mx-auto max-w-[920px] overflow-hidden rounded-[2.5rem] border border-white/12 bg-white/[0.04] p-10 text-center backdrop-blur-2xl sm:p-16"
            >
              <h2 className="mx-auto max-w-2xl text-4xl font-black leading-[1.02] tracking-[-0.025em] text-white sm:text-5xl md:text-6xl">
                {c.finalCta.title}
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-white/60 sm:text-lg">
                {c.finalCta.body}
              </p>
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onPointerDown={handleStart}
                  className="group inline-flex min-h-touch items-center justify-center gap-3 rounded-full bg-secondary px-8 py-4 text-sm font-bold text-secondary-foreground shadow-[0_22px_70px_hsl(var(--secondary)/0.36)] transition-shadow hover:shadow-[0_28px_90px_hsl(var(--secondary)/0.5)]"
                >
                  {c.finalCta.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </motion.div>
          </section>
        </motion.main>
      </div>
    </div>
  );
};

export default AudienceLanding;
