import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Users,
  Zap,
  ShieldCheck,
  Video,
  Target,
  HeartHandshake,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Mail,
  ArrowRight,
} from 'lucide-react';
import LandingNav from '@/components/LandingNav';
import SiteFooter from '@/components/landing/SiteFooter';
import { syncBrowserChrome } from '@/lib/browserChrome';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

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
];

const problems = [
  {
    title: 'Ansökningshets utan riktning',
    body: 'Kandidater spammar 200 jobb om dagen — utan att vilja ha något av dem. Arbetsgivare drunknar.',
  },
  {
    title: 'CV-högar som dödar nyfikenhet',
    body: 'En pdf säger ingenting om vem du faktiskt är, eller varför just du skulle passa just här.',
  },
  {
    title: 'Tysta avslag och svarta hål',
    body: 'Du söker, väntar, hör inget. Arbetsgivaren hinner inte svara — och båda sidor tappar förtroendet.',
  },
];

const AboutPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    syncBrowserChrome('/om-oss');

    const title = 'Om Parium – Jobbappen som samlar allt på ett ställe';
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

    const desc =
      'Parium gör jobbsökandet enklare — för både arbetsgivare och kandidater. Allt på ett och samma ställe. Läs om vår vision, vad vi tror på och hur vi jobbar.';
    setMeta('description', desc);
    setMeta('og:title', title, 'property');
    setMeta('og:description', desc, 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('og:url', 'https://parium.se/om-oss', 'property');
    setMeta('twitter:title', title);
    setMeta('twitter:description', desc);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('robots', 'index, follow, max-image-preview:large');

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = 'https://parium.se/om-oss';
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-primary text-white">
      <LandingNav onLoginClick={handleLogin} />

      {/* Atmospheric glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <div className="absolute left-1/2 top-[-180px] h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-secondary/20 blur-[140px]" />
      </div>

      <main className="relative mx-auto max-w-4xl px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
        {/* HERO */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary backdrop-blur">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Om Parium
          </span>
          <h1 className="mt-5 text-[2.4rem] font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl">
            Vi bygger appen som gör jobbsökandet{' '}
            <span className="text-secondary">enkelt</span> — för båda sidor.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white sm:text-xl">
            En plats för kandidater. En plats för arbetsgivare. Allt på ett och samma ställe — utan friktion, utan brus, utan onödiga steg.
          </p>
        </motion.div>

        {/* INSIKT-CARD */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          className="mt-12 rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:p-8"
        >
          <div className="flex items-start gap-4">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                Parium föddes ur en enkel insikt
              </h2>
              <p className="mt-3 text-[17px] leading-8 text-white">
                Jobbsökandet är trasigt. Kandidater försvinner i CV-högar, arbetsgivare drunknar i ansökningar som inte passar, och de bästa mötena sker av en ren slump. Det ville vi ändra på — på riktigt.
              </p>
            </div>
          </div>
        </motion.section>

        {/* PROBLEMET */}
        <section className="mt-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">
              Problemet
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Dagens jobbsökande är trasigt
            </h2>
            <p className="mt-3 max-w-2xl text-[16px] leading-7 text-white">
              Oseriösa ansökningar har blivit norm. Folk söker jobb de inte vill ha. Arbetsgivare lägger timmar på att sortera bort istället för att hitta rätt. Det är inte hållbart.
            </p>
          </motion.div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {problems.map((p, i) => (
              <motion.article
                key={p.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-md transition-colors hover:bg-white/[0.08]"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-secondary">
                  <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-white">{p.title}</h3>
                <p className="mt-2 text-[15px] leading-7 text-white">{p.body}</p>
              </motion.article>
            ))}
          </div>
        </section>

        {/* VÅR VISION */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          className="mt-16 overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-white/[0.08] to-white/[0.03] p-8 backdrop-blur-md sm:p-12"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">
            Vår vision
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Rätt person. Rätt plats. På riktigt.
          </h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-8 text-white">
            Att varje person ska hitta ett jobb där de blommar — och varje företag ska hitta människor som faktiskt vill vara där. Inga floskler. Inga gissningar. Bara seriösa möten mellan människor.
          </p>

          <ul className="mt-7 grid gap-3 sm:grid-cols-2">
            {[
              'Schysst för kandidater',
              'Schysst för arbetsgivare',
              'Bygg på riktig nyfikenhet',
              'Tystnad är inte ett svar',
            ].map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-[15px] text-white"
              >
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-secondary" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </motion.section>

        {/* HUR VI JOBBAR */}
        <section className="mt-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">
              Hur vi jobbar
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Fyra principer vi inte tummar på
            </h2>
          </motion.div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {principles.map((p, i) => {
              const Icon = p.icon;
              return (
                <motion.article
                  key={p.title}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-60px' }}
                  variants={fadeUp}
                  className="group rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-md transition-colors hover:bg-white/[0.10]"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary/15 text-secondary transition-colors group-hover:bg-secondary/25">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-white">{p.title}</h3>
                  <p className="mt-2 text-[15px] leading-7 text-white">{p.body}</p>
                </motion.article>
              );
            })}
          </div>
        </section>

        {/* BOLAGET */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          className="mt-16 rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-md sm:p-8"
        >
          <div className="flex items-start gap-4">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-secondary">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Bolaget</h2>
              <p className="mt-3 text-[16px] leading-7 text-white">
                Parium drivs av <span className="font-semibold text-white">Parium AB</span>, ett svenskt techbolag med säte i Sverige. Vi är ett litet, fokuserat team som bygger produkten, designen, supporten och koden — tillsammans.
              </p>
            </div>
          </div>
        </motion.section>

        {/* KONTAKT-CTA */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          className="mt-10 overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-secondary/20 via-white/[0.06] to-white/[0.02] p-8 text-center backdrop-blur-md sm:p-12"
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-secondary">
            <Mail className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Säg hej.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[16px] leading-7 text-white">
            Frågor, idéer, samarbeten eller vill du jobba med oss? Vi läser allt — och svarar när vi har något bra att säga.
          </p>
          <a
            href="mailto:hej@parium.se"
            className="mt-6 inline-flex min-h-touch items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-6 py-3 text-base font-semibold text-white transition hover:bg-white/[0.14] hover:border-white/30"
          >
            hej@parium.se
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </motion.section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default AboutPage;
