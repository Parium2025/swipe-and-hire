import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ArrowRight, Mail, Sparkles } from 'lucide-react';
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
  'Så enkelt att varje kandidat kan söka själv',
];

const revealViewport = { once: true, amount: 0.22, margin: '0px 0px -12% 0px' };

const fadeUp = {
  hidden: { opacity: 0.42, y: 34, filter: 'blur(10px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

const revealTransition = { duration: 0.82, ease: [0.16, 1, 0.3, 1] } as const;

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

      {/* HERO — full-bleed banner med mjuk övergång */}
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
          <div className="absolute inset-0 bg-black/40" />
          {/* Lång, mjuk gradient: bild → mörkblå så övergången till sidan blir sömlös */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 via-35% to-[hsl(215_100%_12%)] to-95%" />

          <div className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center sm:px-8 md:px-12">
            <div className="mx-auto w-full max-w-4xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
                    Om Parium
                  </span>
                </div>
                <h1 className="mx-auto mt-6 text-balance text-center text-[2.25rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-7xl">
                  Jobbsökandet,
                  <br />
                  <span className="italic font-light">omtänkt från grunden.</span>
                </h1>
                <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-white sm:text-lg">
                  En app för kandidater. En app för arbetsgivare. Ett enda flöde som faktiskt fungerar.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* INSIKTEN — split: stor rubrik vänster, text höger */}
      <section className="relative px-5 py-16 sm:px-8 sm:py-20 md:px-12">
        <motion.div
          className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-12 lg:gap-16"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={revealViewport}
          transition={revealTransition}
          style={{ willChange: 'opacity, transform, filter', transform: 'translateZ(0)' }}
        >
          <div className="lg:col-span-5">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-white/70">
                Insikten
              </p>
              <h2 className="mt-5 text-balance text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.02em] text-white sm:text-6xl lg:text-[4.25rem]">
                Rekrytering har fastnat i gamla vanor.
              </h2>
              <div className="mt-7 h-px w-20 bg-white/30" />
            </div>
          </div>
          <div className="lg:col-span-7 lg:pt-[3.25rem]">
            <p className="text-[18px] leading-[1.75] text-white sm:text-[19px]">
              Kandidater skickar ansökningar utan svar och utan återkoppling. Arbetsgivare lägger timmar på CV:n utan att hitta rätt. Resultatet blir missade möjligheter på båda sidor.
            </p>
            <p className="mt-6 text-[18px] leading-[1.75] text-white sm:text-[19px]">
              Vi tror att det finns ett bättre sätt. Därför har vi byggt en plattform där allt hänger ihop — jobbannonsen, ansökan, dialogen och beslutet. Inga lösa trådar. Inga separata system. Ett enda flöde, byggt för att rätt person ska nå rätt plats.
            </p>
          </div>
        </motion.div>
      </section>

      {/* VÅR VISION — editorial pull-quote stil */}
      <section className="relative px-5 py-16 sm:px-8 sm:py-20 md:px-12">
        <div className="mx-auto max-w-5xl text-center">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={revealViewport}
            transition={revealTransition}
            style={{ willChange: 'opacity, transform, filter', transform: 'translateZ(0)' }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80">
              Vår vision
            </p>
            <h2 className="mx-auto mt-5 max-w-4xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-6xl md:text-7xl">
              Sveriges ledande<br className="hidden sm:block" /> jobbsökar- &amp; rekryteringsapp.
            </h2>
            <div className="mx-auto mt-10 max-w-2xl space-y-5">
              <p className="text-[18px] leading-[1.75] text-white">
                Det är den riktning vi bygger mot — inte ett kvartalsmål, utan en långsiktig vision. Vi vill att Parium ska vara det självklara valet för alla som söker jobb och för alla som rekryterar. Oavsett om du är ny på arbetsmarknaden, har lång erfarenhet eller letar efter nästa stjärna till teamet.
              </p>
              <p className="text-[18px] leading-[1.75] text-white">
                Tekniken ska göra det möjligt. Strukturen ska göra det tydligt. Och upplevelsen ska göra det så enkelt att varje kandidat kan hitta och söka rätt jobb — på riktigt, och helt själv.
              </p>
            </div>
          </motion.div>

          {/* visionspunkter — staplade premium-rader */}
          <div className="mx-auto mt-14 grid max-w-3xl gap-3">
            {visionPoints.map((item, index) => (
              <motion.div
                key={item}
                className="flex items-center gap-5 rounded-2xl border border-white/15 bg-white/[0.06] px-6 py-5 text-left backdrop-blur"
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={revealViewport}
                transition={{ ...revealTransition, delay: index * 0.08 }}
                style={{ willChange: 'opacity, transform, filter', transform: 'translateZ(0)' }}
              >
                <span className="text-3xl font-light tabular-nums text-white/90 sm:text-4xl">
                  0{index + 1}
                </span>
                <div className="h-10 w-px bg-white/20" />
                <span className="flex-1 text-[16px] font-medium leading-snug text-white sm:text-[17px]">
                  {item}
                </span>
                
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* BOLAGET + KONTAKT — sida vid sida på desktop */}
      <section className="relative px-5 py-16 sm:px-8 sm:py-20 md:px-12">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 md:gap-8">
          {/* Bolaget */}
          <motion.div
            className="relative overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.06] p-10 backdrop-blur sm:p-12"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={revealViewport}
            transition={revealTransition}
            style={{ willChange: 'opacity, transform, filter', transform: 'translateZ(0)' }}
          >
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/[0.04] blur-2xl" aria-hidden="true" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80">
              Bolaget
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Litet team.<br />Stora ambitioner.
            </h2>
            <p className="mt-6 text-[17px] leading-[1.7] text-white">
              Parium drivs av <span className="font-semibold text-white">Parium AB</span>, ett svenskt techbolag som bygger för både jobbsökaren och arbetsgivaren. Fokuserat team. Långsiktig plan. Inga genvägar.
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
            <div className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-white/[0.04] blur-2xl" aria-hidden="true" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80">
              Kontakt
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Har du något<br />att säga oss?
            </h2>
            <p className="mx-auto mt-6 max-w-md text-[17px] leading-[1.7] text-white">
              Tips, frågor, idéer eller bara en tanke — vi läser allt. Och vi svarar.
            </p>
            <a
              href="mailto:hej@parium.se"
              className="mx-auto mt-7 inline-flex min-h-touch items-center gap-2.5 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-white/15"
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
          className="mx-auto max-w-3xl rounded-[28px] border border-white/15 bg-white/[0.08] p-10 text-center shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-14"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={revealViewport}
          transition={revealTransition}
          style={{ willChange: 'opacity, transform, filter', transform: 'translateZ(0)' }}
        >
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Redo att ta nästa steg?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[17px] leading-7 text-white">
            Skapa din profil idag. Resten sköter Parium.
          </p>
          <div className="mt-8 flex justify-center">
            <SeoCTAButton label="Skapa min profil idag" onClick={handleSignup} />
          </div>
        </motion.div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default AboutPage;
