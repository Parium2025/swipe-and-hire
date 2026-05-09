import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import LandingNav from '@/components/LandingNav';
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
    document.title =
      audience === 'job_seeker' ? 'Parium – För jobbsökare' : 'Parium – För arbetsgivare';
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

  return (
    <div className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden bg-parium-navy text-primary-foreground">
      <AnimatedBackground />
      <div className="relative z-10 min-h-full">
        <LandingNav onLoginClick={handleLogin} />

        <motion.main
          initial={{ x: audience === 'job_seeker' ? '100vw' : '-100vw', opacity: 0, filter: 'blur(12px)' }}
          animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* ──────────────── 1. HERO (vertikal) ──────────────── */}
          <section className="relative flex min-h-[100svh] items-center overflow-hidden px-5 pb-16 pt-28 sm:px-6 md:px-12 lg:px-24">
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -top-32 right-[-10%] h-[520px] w-[520px] rounded-full bg-secondary/15 blur-[140px]"
              animate={{ y: [0, -24, 0], opacity: [0.45, 0.7, 0.45] }}
              transition={{ duration: 8, ease: 'easeInOut', repeat: Infinity }}
            />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute bottom-[-15%] left-[-10%] h-[420px] w-[420px] rounded-full bg-primary-glow/20 blur-[120px]"
              animate={{ y: [0, 18, 0], opacity: [0.4, 0.6, 0.4] }}
              transition={{ duration: 10, ease: 'easeInOut', repeat: Infinity, delay: 1 }}
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

          {/* ──────────────── 2. HORISONTELL SCROLL-JACKED SEKTION ──────────────── */}
          <HorizontalScrollSection panels={panels} panelScrollVh={1} />

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
