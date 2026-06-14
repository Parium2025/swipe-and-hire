import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import LandingNav, { type LandingNavLink } from '@/components/LandingNav';
import SiteFooter from '@/components/landing/SiteFooter';

const ease = [0.22, 1, 0.36, 1] as const;

const values = [
  {
    title: 'Människor först',
    body: 'Algoritmer hjälper. Människor anställer. Vi bygger för båda.',
  },
  {
    title: 'Snabbt och ärligt',
    body: 'Inga onödiga steg. Inga tomma löften. Bara jobb som faktiskt matchar.',
  },
  {
    title: 'Byggt i Sverige',
    body: 'Av ett litet team, för hela arbetsmarknaden. Med kärlek till hantverket.',
  },
] as const;

const navLinks: LandingNavLink[] = [
  { label: 'För jobbsökare', href: '/jobbsokare' },
  { label: 'För arbetsgivare', href: '/arbetsgivare' },
  { label: 'Om oss', href: '/om-oss' },
];

const OmOss = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Om Parium – vår vision för en bättre arbetsmarknad</title>
        <meta
          name="description"
          content="Parium är jobbappen som matchar människor och arbetsgivare på ett ärligare sätt. Läs om vår vision, våra värderingar och varför vi finns."
        />
        <link rel="canonical" href="https://parium.se/om-oss" />
        <meta property="og:title" content="Om Parium" />
        <meta property="og:url" content="https://parium.se/om-oss" />
        <meta property="og:type" content="website" />
      </Helmet>

      <div
        className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden bg-primary text-primary-foreground"
        style={{
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
          backgroundImage:
            'linear-gradient(180deg, hsl(215 80% 22%) 0%, hsl(var(--primary)) 65svh, hsl(var(--primary)) 100%)',
          backgroundColor: 'hsl(var(--primary))',
        }}
      >
        <div className="relative z-10 min-h-full">
          <LandingNav onLoginClick={() => navigate('/auth')} links={navLinks} />

          <main className="mx-auto max-w-[920px] px-5 pt-32 pb-20 sm:px-6 sm:pt-40 sm:pb-28">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease }}
              className="text-center"
            >
              <span className="text-xs font-bold uppercase tracking-[0.32em] text-secondary/85">
                Om oss
              </span>
              <h1 className="landing-h1 mt-4 text-white">
                Vi byggde Parium för att jobbsökandet förtjänar bättre.
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-white/85 sm:text-lg">
                Tusentals annonser. Få svar. Massa frustration. Vi visste att det
                gick att göra på ett ärligare sätt — så vi gjorde det.
              </p>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.9, ease, delay: 0.1 }}
              className="mt-20 grid gap-6 sm:grid-cols-3"
            >
              {values.map((v) => (
                <div
                  key={v.title}
                  className="rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur-sm"
                >
                  <h2 className="text-lg font-semibold text-white">{v.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-white/75">{v.body}</p>
                </div>
              ))}
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.9, ease, delay: 0.15 }}
              className="mt-20 text-center"
            >
              <p className="mx-auto max-w-xl text-base leading-8 text-white/85 sm:text-lg">
                Vi finns för dig som söker — och för dig som anställer.
                Välkommen till Parium.
              </p>
              <button
                type="button"
                onPointerDown={() => navigate('/auth', { state: { mode: 'register' } })}
                className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-secondary px-8 text-base font-semibold text-secondary-foreground shadow-lg transition-transform active:scale-[0.98]"
              >
                Kom igång gratis
              </button>
            </motion.section>
          </main>

          <SiteFooter />
        </div>
      </div>
    </>
  );
};

export default OmOss;
