import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Users,
  Zap,
  ShieldCheck,
  Video,
  HeartHandshake,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Mail,
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

const problems = [
  {
    icon: AlertTriangle,
    title: 'Ansökningshets utan riktning',
    body: 'Kandidater spammar hundratals jobb om dagen — utan att vilja ha något av dem. Arbetsgivare drunknar.',
  },
  {
    icon: AlertTriangle,
    title: 'CV-högar som dödar nyfikenhet',
    body: 'En pdf säger ingenting om vem du faktiskt är, eller varför just du skulle passa just här.',
  },
  {
    icon: AlertTriangle,
    title: 'Tysta avslag och svarta hål',
    body: 'Du söker, väntar, hör inget. Arbetsgivaren hinner inte svara — och båda sidor tappar förtroendet.',
  },
];

const principles = [
  {
    icon: Video,
    title: 'Människan först',
    body: 'Videoprofiler, riktiga röster och äkta personligheter — inte stela CV:n som ingen orkar läsa.',
  },
  {
    icon: Zap,
    title: 'Snabbhet utan kompromiss',
    body: 'Vi bygger som om Apple och Spotify gjort det. Pixel-perfekt, polerat och blixtsnabbt — varje skärm.',
  },
  {
    icon: ShieldCheck,
    title: 'Kvalitet före kvantitet',
    body: 'Vi lovar inte svar inom 24 timmar. Vi lovar att leverera något som faktiskt är bra när vi gör det.',
  },
  {
    icon: HeartHandshake,
    title: 'Schysst för båda sidor',
    body: 'Kandidater ska känna sig sedda. Arbetsgivare ska slippa bruset. Båda ska tjäna på att vara här.',
  },
  {
    icon: Users,
    title: 'Bygg med användarna',
    body: 'Varje funktion testas mot riktiga jobbsökare och arbetsgivare. Inte mot antaganden i ett konferensrum.',
  },
  {
    icon: Sparkles,
    title: 'Detaljerna avgör',
    body: 'En app känns inte premium av en logga. Den känns premium av tusen små beslut — vi tar dem ett i taget.',
  },
];

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

  const handleSignup = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'signup' } });
  };

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
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

      {/* HERO */}
      <section className="relative overflow-hidden px-5 pt-32 pb-16 sm:px-8 sm:pt-40 sm:pb-24 md:px-12">
        <SeoBubbles />
        <div className="relative mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium border border-white/15"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Om Parium
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl"
          >
            Vi bygger appen som gör jobbsökandet enkelt — för båda sidor.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white sm:text-xl"
          >
            En plats för kandidater. En plats för arbetsgivare. Allt på ett och samma ställe — utan friktion, utan brus, utan onödiga steg.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <SeoCTAButton label="Skapa min profil idag" onClick={handleSignup} />
            <SeoCTAButton
              variant="ghost"
              showArrow={false}
              label="Logga in"
              onClick={handleLogin}
            />
          </motion.div>
        </div>
      </section>

      {/* INSIKTEN */}
      <section className="px-5 pb-12 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-white/15 bg-white/[0.07] p-8 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:p-10">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Parium föddes ur en enkel insikt
                </h2>
                <p className="mt-4 text-[17px] leading-8 text-white">
                  Jobbsökandet är trasigt. Kandidater försvinner i CV-högar, arbetsgivare drunknar i ansökningar som inte passar, och de bästa mötena sker av en ren slump. Det ville vi ändra på — på riktigt.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEMET */}
      <section className="px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl text-white">
            Dagens jobbsökande är trasigt
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-white">
            Oseriösa ansökningar har blivit norm. Folk söker jobb de inte vill ha. Arbetsgivare lägger timmar på att sortera bort istället för att hitta rätt.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {problems.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.18)]"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VÅR VISION */}
      <section className="px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-white/15 bg-white/[0.08] p-8 sm:p-12">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
              Vår vision
            </p>
            <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Rätt person. Rätt plats. På riktigt.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-center text-[17px] leading-8 text-white">
              Att varje person ska hitta ett jobb där de blommar — och varje företag ska hitta människor som faktiskt vill vara där. Inga floskler. Inga gissningar. Bara seriösa möten mellan människor.
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

      {/* HUR VI JOBBAR */}
      <section className="px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl text-white">
            Så jobbar vi på Parium
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-white">
            Sex principer vi inte tummar på — och som format varje skärm i appen.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {principles.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.18)]"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOLAGET */}
      <section className="px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:p-10">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Building2 className="h-5 w-5 text-white" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Bolaget</h2>
                <p className="mt-4 text-[17px] leading-8 text-white">
                  Parium drivs av <span className="font-semibold text-white">Parium AB</span>, ett svenskt techbolag med säte i Sverige. Vi är ett litet, fokuserat team som bygger produkten, designen, supporten och koden — tillsammans.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KONTAKT */}
      <section className="px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:p-10">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Mail className="h-5 w-5 text-white" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Säg hej</h2>
                <p className="mt-4 text-[17px] leading-8 text-white">
                  Frågor, idéer, samarbeten eller vill du jobba med oss? Vi läser allt — och svarar när vi har något bra att säga.
                </p>
                <a
                  href="mailto:hej@parium.se"
                  className="mt-5 inline-flex min-h-touch items-center text-lg font-semibold text-white underline-offset-4 hover:underline"
                >
                  hej@parium.se
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-20 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-white/[0.08] p-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl text-white">
            Redo att jobba smartare — på båda sidor?
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
