import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
} from 'lucide-react';
import LandingNav from '@/components/LandingNav';
import SiteFooter from '@/components/landing/SiteFooter';
import SeoBubbles from '@/components/seo/SeoBubbles';
import SeoCTAButton from '@/components/seo/SeoCTAButton';
import { syncBrowserChrome } from '@/lib/browserChrome';

const CANONICAL = 'https://parium.se/om-oss';
const TITLE = 'Om Parium – Jobbappen som samlar allt på ett ställe';
const DESCRIPTION =
  'Parium bygger jobbsökandet från grunden — för både arbetsgivare och kandidater. Ett enda flöde. Inga genvägar. Läs om vår vision, vad vi tror på och hur vi jobbar.';


const visionPoints = [
  'Sveriges ledande jobbsökarapp',
  'Sveriges ledande rekryteringsapp',
  'Så enkelt att varje kandidat kan söka själv',
];

const AboutPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    syncBrowserChrome('/om-oss');
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
      className="seo-scroll-page pb-16 bg-[hsl(215_100%_12%)] bg-parium-gradient text-white"
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

      {/* Globala bubblor – fixed över hela sidan så bakgrunden aldrig klipps */}
      <SeoBubbles />

      {/* HERO — symmetriskt premium kort */}
      <section className="relative px-5 pt-32 pb-12 sm:px-8 sm:pt-40 sm:pb-12 md:px-12">
        <div className="relative mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-[28px] border border-white/15 bg-white/[0.08] p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-12"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
              Om Parium
            </p>
            <h1 className="mt-3 text-balance text-3xl font-semibold leading-[1.08] tracking-tight text-white sm:text-4xl md:text-5xl">
              Jobbsökandet, omtänkt från grunden.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-8 text-white">
              En app för kandidater. En app för arbetsgivare. Ett enda flöde som faktiskt fungerar.
            </p>
          </motion.div>
        </div>
      </section>

      {/* INSIKTEN — symmetriskt premium kort */}
      <section className="relative px-5 py-12 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[28px] border border-white/15 bg-white/[0.08] p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
              Insikten
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Rekrytering har fastnat i gamla vanor.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-8 text-white">
              Kandidater skickar ansökningar utan svar och utan återkoppling. Arbetsgivare lägger timmar på CV:n utan att hitta rätt. Resultatet blir missade möjligheter på båda sidor.
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-[17px] leading-8 text-white">
              Vi tror att det finns ett bättre sätt. Därför har vi byggt en plattform där allt hänger ihop — jobbannonsen, ansökan, dialogen och beslutet. Inga lösa trådar. Inga separata system. Ett enda flöde, byggt för att rätt person ska nå rätt plats.
            </p>
          </div>
        </div>
      </section>

      {/* VÅR VISION — premium kort */}
      <section className="relative px-5 py-12 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[28px] border border-white/15 bg-white/[0.08] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-12">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
              Vår vision
            </p>
            <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Rätt person. Rätt plats. På riktigt.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-center text-[17px] leading-8 text-white">
              En arbetsmarknad där rätt människa hamnar på rätt plats. Utan gissningar. Utan brus.
            </p>
            <ul className="mx-auto mt-8 flex max-w-xl flex-col gap-2.5 sm:gap-3">
              {visionPoints.map((item, index) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5 text-left text-[15px] leading-tight text-white sm:gap-4 sm:px-5 sm:py-4 sm:text-base"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.08] text-[12px] font-semibold tabular-nums text-white sm:h-8 sm:w-8 sm:text-[13px]">
                    {index + 1}
                  </span>
                  <span className="flex-1">{item}</span>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-white sm:h-5 sm:w-5" aria-hidden="true" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>


      {/* BOLAGET — symmetriskt centrerat kort */}
      <section className="relative px-5 py-12 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[28px] border border-white/15 bg-white/[0.08] p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
              Bolaget
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Litet team. Stora ambitioner.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-8 text-white">
              Parium drivs av <span className="font-semibold text-white">Parium AB</span>, ett svenskt techbolag som bygger för både jobbsökaren och arbetsgivaren. Fokuserat team. Långsiktig plan. Inga genvägar.
            </p>
          </div>
        </div>
      </section>

      {/* KONTAKT — symmetriskt centrerat kort */}
      <section className="relative px-5 py-12 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[28px] border border-white/15 bg-white/[0.08] p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
              Kontakt
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Har du något att säga oss?
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-8 text-white">
              Tips, frågor, idéer eller bara en tanke — vi läser allt. Och vi svarar.
            </p>
            <a
              href="mailto:hej@parium.se"
              className="mt-6 inline-flex min-h-touch items-center text-lg font-semibold text-white underline-offset-4 hover:underline"
            >
              hej@parium.se
            </a>
          </div>
        </div>
      </section>

      {/* CTA — bara här i botten */}
      <section className="relative px-5 py-20 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-white/15 bg-white/[0.08] p-10 text-center shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Redo att ta nästa steg?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white">
            Skapa din profil idag. Resten sköter Parium.
          </p>
          <div className="mt-7 flex justify-center">
            <SeoCTAButton label="Skapa min profil idag" onClick={handleSignup} />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default AboutPage;
