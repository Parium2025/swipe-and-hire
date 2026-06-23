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
  'Parium gör jobbsökandet enklare — för både arbetsgivare och kandidater. Allt på ett och samma ställe. Läs om vår vision, vad vi tror på och hur vi jobbar.';


const visionPoints = [
  'Schysst för kandidater',
  'Schysst för arbetsgivare',
  'Bygg på riktig nyfikenhet',
  'Tystnad är inte ett svar',
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
              Vi bygger appen som gör jobbsökandet enkelt — för båda sidor.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-8 text-white">
              En plats för kandidater. En plats för arbetsgivare. Allt på ett och samma ställe — utan friktion, utan brus, utan onödiga steg.
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
              Kandidater skickar ansökningar utan svar samt utan återkoppling. Arbetsgivare lägger timmar på CV:n utan framgång. Resultatet blir missade möjligheter på båda sidor. Vi tror att det finns ett bättre sätt.
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
              Vi vill skapa en arbetsmarknad där människor hittar jobb de faktiskt trivs i och företag hittar personer som faktiskt vill vara där.{" "}
            </p>
            <ul className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
              {visionPoints.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-[15px] text-white"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-white" aria-hidden="true" />
                  {item}
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
              Parium drivs av <span className="font-semibold text-white">Parium AB</span>, ett svenskt techbolag med säte i Sverige. Vi är ett fokuserat team som utvecklar Parium för att gynna både jobbsökaren och arbetgivaren.{" "}
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
              Har du tips, frågor eller förslag?{" "}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-8 text-white">
              Vi läser allt — och svarar inom kort!{" "}
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
            Redo att ta nästa steg?{" "}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white">
            Skapa min profil idag och upptäck Parium — appen som samlar allt på ett ställe.
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
