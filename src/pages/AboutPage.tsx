import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import LandingNav from '@/components/LandingNav';
import SiteFooter from '@/components/landing/SiteFooter';
import SeoBubbles from '@/components/seo/SeoBubbles';
import SeoCTAButton from '@/components/seo/SeoCTAButton';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { ABOUT_BANNER_URL, preloadAboutPageAssets } from '@/lib/aboutPagePreload';

const CANONICAL = 'https://parium.se/om-oss';
const TITLE = 'Om Parium – Jobbappen som samlar allt på ett ställe';
const DESCRIPTION =
  'Parium bygger jobbsökandet från grunden — för både arbetsgivare och kandidater. Ett enda flöde. Inga genvägar. Läs om vår vision, vad vi tror på och hur vi jobbar.';

const visionPoints = [
  'Sveriges ledande jobbsökarapp',
  'Sveriges ledande rekryteringsapp',
];

const revealViewport = { once: true, amount: 0.22, margin: '0px 0px -12% 0px' };

const revealTransition = { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const } as const;

const EASE = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 28, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.05 } },
};

const kickerReveal = {
  hidden: { opacity: 0, y: 14, letterSpacing: '0.34em' },
  show: { opacity: 1, y: 0, letterSpacing: '0.28em', transition: { duration: 0.8, ease: EASE } },
};

const headlineReveal = {
  hidden: { opacity: 0, y: 34, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 1.0, ease: EASE } },
};

const bodyReveal = {
  hidden: { opacity: 0, y: 22, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.85, ease: EASE } },
};

const AboutPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    syncBrowserChrome('/om-oss');
    void preloadAboutPageAssets('high');
    window.scrollTo(0, 0);
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };

  const handleSignup = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'signup' } });
  };

  return (
    <div
      data-seo-scroll-root
      className="seo-scroll-page bg-[hsl(215_100%_12%)] bg-parium-gradient text-white"
    >
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="sv_SE" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
      </Helmet>

      <LandingNav onLoginClick={handleLogin} />
      <SeoBubbles />

      {/* VEM VI ÄR — full-bleed banner, först */}
      <section className="relative w-full overflow-hidden">
        <div className="relative h-screen min-h-[700px] w-full">
          <img
            src={ABOUT_BANNER_URL}
            alt="Människor från alla yrken samlade på ett torg i Sverige"
            className="absolute inset-0 h-full w-full object-cover object-center"
            loading="eager"
            decoding="sync"
            {...({ fetchpriority: 'high' } as any)}
          />
          {/* Mörkningslager — kraftig kontrast så texten alltid är läsbar */}
          <div className="absolute inset-0 bg-black/55" />
          {/* Lång, mjuk gradient: bild → transparent så page-gradienten fortsätter sömlöst */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/30 via-35% to-transparent to-95%" />

          <div className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center sm:px-8 md:px-12">
            <motion.div
              className="mx-auto w-full max-w-3xl"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={revealViewport}
              transition={revealTransition}
              style={{ willChange: 'opacity, transform', transform: 'translateZ(0)' }}
            >
              <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-white lg:text-[14px]">
                Vilka är vi?
              </p>
              <h2 className="mt-5 text-balance text-[2.25rem] font-semibold leading-[1.05] tracking-[-0.02em] text-white sm:text-5xl lg:text-[3.75rem]">
                Ett team, en idé.
              </h2>
              <div className="mx-auto mt-8 max-w-2xl space-y-6 text-[18px] leading-[1.75] text-white sm:text-[19px] lg:text-[21px]">
                <p className="font-medium">
                  Parium grundades i Sverige av ett team som kommer från olika branscher. Men rekrytering har alltid funnits i centrum. Därför har vi byggt något som vi alltid önskat fanns på marknaden.
                </p>
                <p className="font-medium leading-[1.6]">
                  En app för både kandidater och arbetsgivare. Ett enda flöde som faktiskt fungerar.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>


      {/* INSIKTEN — split: stor rubrik vänster, text höger */}
      <section className="relative px-5 py-16 sm:px-8 sm:py-20 md:px-12">
        <motion.div
          className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-12 lg:gap-16"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={revealViewport}
        >
          <div className="lg:col-span-5">
            <div>
              <motion.p
                variants={kickerReveal}
                className="text-[12px] font-semibold uppercase tracking-[0.28em] text-white lg:text-[14px]"
              >
                Insikten
              </motion.p>
              <motion.h2
                variants={headlineReveal}
                style={{ willChange: 'opacity, transform, filter', transform: 'translateZ(0)' }}
                className="mt-5 text-balance text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.02em] text-white sm:text-6xl lg:text-[4.25rem]"
              >
                Rekrytering har fastnat i gamla vanor.
              </motion.h2>
            </div>
          </div>
          <div className="lg:col-span-7 lg:pt-[3.25rem]">
            <motion.p
              variants={bodyReveal}
              className="text-[18px] leading-[1.75] text-white sm:text-[19px] lg:text-[21px]"
            >
              Kandidater skickar ansökningar utan svar och utan återkoppling. Arbetsgivare lägger timmar på CV:n utan att hitta rätt. Resultatet blir missade möjligheter.
            </motion.p>
            <motion.p
              variants={bodyReveal}
              className="mt-6 text-[18px] leading-[1.75] text-white sm:text-[19px] lg:text-[21px]"
            >
              Vi tror på kraften i det enkla: smart teknik bakom kulisserna, tydlig struktur och en upplevelse som gör att rätt kandidat når rätt jobb — utan onödiga steg.&nbsp;Därför har vi byggt en plattform där allt hänger ihop — jobbannonsen, ansökan och dialogen. Ett enda flöde, byggt för att rätt person ska nå rätt plats.
            </motion.p>
          </div>
        </motion.div>
      </section>

      {/* VÅR VISION — editorial pull-quote stil */}
      <section className="relative px-5 py-16 sm:px-8 sm:py-20 md:px-12">
        <div className="mx-auto max-w-5xl text-center">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={revealViewport}
          >
            <motion.p
              variants={kickerReveal}
              className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white lg:text-[14px]"
            >
              Vår vision
            </motion.p>
            <motion.h2
              variants={headlineReveal}
              style={{ willChange: 'opacity, transform, filter', transform: 'translateZ(0)' }}
              className="mx-auto mt-5 max-w-4xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-6xl md:text-[5.5rem]"
            >
              Sveriges ledande<br className="hidden sm:block" /> jobbsökar- &amp; rekryteringsapp.
            </motion.h2>
            <motion.div variants={bodyReveal} className="mx-auto mt-10 max-w-2xl space-y-5">
              <p className="text-[18px] leading-[1.75] text-white lg:text-[20px]">
                Parium ska vara det naturliga valet för alla som söker jobb och för alla som rekryterar. En plattform som är lika enkel för kandidaten som den är kraftfull för arbetsgivaren.
              </p>
            </motion.div>
          </motion.div>

          {/* visionspunkter — rena statements */}
          <motion.div
            className="mx-auto mt-16 max-w-3xl border-t border-white/10"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={revealViewport}
          >
            {visionPoints.map((item) => (
              <motion.div
                key={item}
                className="border-b border-white/10 py-10 text-center"
                variants={headlineReveal}
                style={{ willChange: 'opacity, transform, filter', transform: 'translateZ(0)' }}
              >
                <span className="text-[26px] font-light leading-snug tracking-tight text-white sm:text-[34px]">
                  {item}
                </span>
              </motion.div>
            ))}
          </motion.div>

        </div>
      </section>


      {/* BOLAGET + KONTAKT — sida vid sida på desktop */}
      <section className="relative px-5 py-16 sm:px-8 sm:py-20 md:px-12">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 md:gap-8">
          {/* Bolaget */}
          <motion.div
            className="relative overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.06] p-10 text-center backdrop-blur sm:p-12"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={revealViewport}
            transition={revealTransition}
            style={{ willChange: 'opacity, transform, filter', transform: 'translateZ(0)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent" aria-hidden="true" />
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/[0.04] blur-2xl" aria-hidden="true" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white lg:text-[14px]">
              Bolaget
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Ett team, stora ambitioner.
            </h2>
            <p className="mx-auto mt-6 max-w-md text-[17px] leading-[1.7] text-white lg:text-[19px]">
              Parium drivs av Parium AB, ett svenskt bolag som bygger för både jobbsökaren och arbetsgivaren. Enkel för kandidaten, kraftfull för arbetsgivaren.
            </p>
          </motion.div>

          {/* Kontakt */}
          <motion.div
            className="relative overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.06] p-10 text-center backdrop-blur sm:p-12"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={revealViewport}
            transition={{ ...revealTransition, delay: 0.08 }}
            style={{ willChange: 'opacity, transform, filter', transform: 'translateZ(0)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent" aria-hidden="true" />
            <div className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-white/[0.04] blur-2xl" aria-hidden="true" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white lg:text-[14px]">
              Kontakt
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Har du något<br />att säga oss?
            </h2>
            <p className="mx-auto mt-6 max-w-md text-[17px] leading-[1.7] text-white lg:text-[19px]">
              Tips, frågor, idéer eller bara en tanke — vi läser allt. Och vi svarar!
            </p>
            <a
              href="mailto:hej@parium.se"
              className="relative mx-auto mt-7 inline-flex min-h-touch items-center gap-2.5 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-white/15"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              hej@parium.se
            </a>
          </motion.div>

        </div>
      </section>

      {/* CTA */}
      <section className="relative px-5 pb-24 pt-12 sm:px-8 md:px-12">
        <motion.div
          className="relative mx-auto max-w-3xl overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.08] p-10 text-center shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-14"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={revealViewport}
          transition={revealTransition}
          style={{ willChange: 'opacity, transform, filter', transform: 'translateZ(0)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent" aria-hidden="true" />
          <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Redo att ta nästa steg?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-[17px] leading-7 text-white lg:text-[19px]">
            Skapa din profil i dag. Resten sköter Parium, oavsett om du är jobbsökare eller om du är en arbetsgivare.
          </p>
          <div className="relative mt-8 flex justify-center">
            <SeoCTAButton label="Skapa min profil idag" onClick={handleSignup} />
          </div>
        </motion.div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default AboutPage;
