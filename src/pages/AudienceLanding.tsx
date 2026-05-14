import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
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
  onStart: () => void;
};

const DesktopPhoneLayer = ({
  active,
  resetToken,
  layerRef,
}: {
  active: boolean;
  resetToken: number;
  layerRef: React.RefObject<HTMLDivElement>;
}) => (
  <div
    ref={layerRef}
    className={`${active ? 'visible' : 'invisible'} pointer-events-none fixed inset-0 z-20 hidden h-[100svh] items-center justify-center overflow-hidden px-5 pb-16 pt-28 sm:px-6 md:px-12 lg:flex lg:px-24`}
    aria-hidden="true"
    style={{ willChange: 'opacity, transform' }}
  >
    <div className="mx-auto grid w-full max-w-[1280px] items-start gap-12 md:grid-cols-2 lg:gap-16 2xl:max-w-[1440px]">
      <div aria-hidden />
      <div
        className="pointer-events-auto relative mx-auto flex w-fit items-start justify-center pt-8 xl:pt-10"
        style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
      >
        <SplinePhone
          className="h-[min(68svh,660px)] w-auto aspect-[9/19.5]"
          zoom={0.78}
          lockPageScroll
          resetToken={resetToken}
        />
      </div>
    </div>
  </div>
);

const HeroIntroStage = ({ c, onStart }: HeroIntroStageProps) => {
  const heroRef = useRef<HTMLElement | null>(null);
  const introRef = useRef<HTMLElement | null>(null);
  const heroTextRef = useRef<HTMLDivElement | null>(null);
  const introContentRef = useRef<HTMLDivElement | null>(null);
  const phoneLayerRef = useRef<HTMLDivElement | null>(null);
  const wasAwayFromHeroRef = useRef(false);
  const [phoneActive, setPhoneActive] = useState(true);
  const [resetToken, setResetToken] = useState(0);

  useEffect(() => {
    const scrollRoot = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;
    const hero = heroRef.current;
    if (!hero) return;

    const isHeroInView = () => {
      const rect = hero.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      return rect.top < vh * 0.55 && rect.bottom > vh * 0.45;
    };

    const syncPhone = () => {
      const nextActive = isHeroInView();
      setPhoneActive(nextActive);

      if (!nextActive) {
        wasAwayFromHeroRef.current = true;
        return;
      }

      if (wasAwayFromHeroRef.current) {
        wasAwayFromHeroRef.current = false;
        setResetToken((token) => token + 1);
      }
    };

    syncPhone();
    scrollRoot?.addEventListener('scroll', syncPhone, { passive: true });
    window.addEventListener('resize', syncPhone);

    return () => {
      scrollRoot?.removeEventListener('scroll', syncPhone);
      window.removeEventListener('resize', syncPhone);
    };
  }, []);

  return (
    <>
      <section
        ref={heroRef}
        data-hero-intro-stage
        className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden px-5 pb-16 pt-28 sm:px-6 md:px-12 lg:px-24"
        aria-labelledby="audience-hero-heading"
      >
        <div className="absolute inset-0 -z-0 flex items-center justify-center lg:hidden">
          <SplinePhone className="h-[80svh] w-full max-w-[520px]" resetToken={resetToken} />
        </div>

        <motion.div
          aria-hidden
          className="pointer-events-none absolute -top-40 right-[-25%] hidden h-[640px] w-[640px] rounded-full bg-secondary/[0.06] blur-[180px] lg:block"
          animate={{ opacity: [0.5, 0.75, 0.5] }}
          transition={{ duration: 9, ease: 'easeInOut', repeat: Infinity }}
        />

        <DesktopPhoneLayer active={phoneActive} resetToken={resetToken} layerRef={phoneLayerRef} />

        <div className="relative z-10 mx-auto grid w-full max-w-[1280px] items-start gap-12 md:grid-cols-2 lg:gap-16 2xl:max-w-[1440px]">
          <motion.div
            ref={heroTextRef}
            className="pointer-events-none mx-auto flex h-full max-w-[1180px] flex-col items-center justify-center text-center lg:pointer-events-auto lg:mx-0 lg:block lg:-translate-y-16 lg:pt-8 lg:text-left xl:pt-10"
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.18, delayChildren: 0.1 } } }}
            style={{ willChange: 'opacity, transform' }}
          >
            <HeroText
              eyebrow={c.eyebrow}
              headline={c.hero.headline}
              subtitle={c.hero.subtitle}
              variant="desktop"
              headingId="audience-hero-heading"
            />
          </motion.div>
          <div aria-hidden className="hidden lg:block" />
        </div>
      </section>

      <section
        aria-label="Introduktion"
        className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden bg-primary px-5 py-24 sm:px-6 md:px-12 lg:px-24"
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
    </>
  );
};


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
      <div className="relative z-10 min-h-full">
        <LandingNav onLoginClick={handleLogin} links={navLinks} />


        <motion.main
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <HeroIntroStage c={c} onStart={handleStart} />


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
