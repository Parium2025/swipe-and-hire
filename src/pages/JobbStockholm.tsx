import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import LandingNav from '@/components/LandingNav';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin, Zap, MessageSquare, Search } from 'lucide-react';

const CANONICAL = 'https://parium.se/jobb/stockholm';
const TITLE = 'Lediga jobb i Stockholm – sök jobb snabbt med Parium';
const DESCRIPTION =
  'Hitta lediga jobb i Stockholm som passar dig. Skapa profil gratis, matcha med arbetsgivare i Stockholm och chatta direkt i jobbappen Parium.';

const popularRoles = [
  'Servitör',
  'Lagerarbetare',
  'Lärare',
  'Sjuksköterska',
  'Snickare',
  'Truckförare',
  'Kock',
  'Elektriker',
  'Säljare',
  'Städare',
  'Kassörska',
  'Bartender',
];

const stockholmAreas = [
  'Stockholm City',
  'Södermalm',
  'Norrmalm',
  'Östermalm',
  'Vasastan',
  'Kungsholmen',
  'Solna',
  'Sundbyberg',
  'Bromma',
  'Hammarby Sjöstad',
  'Liljeholmen',
  'Kista',
];

const faqs = [
  {
    q: 'Hur hittar jag lediga jobb i Stockholm med Parium?',
    a: 'Skapa en kostnadsfri profil i Parium, ange Stockholm som plats och vilka yrken du är intresserad av. Vår smarta matchning visar lediga jobb i Stockholm som passar din profil — direkt i flödet.',
  },
  {
    q: 'Är Parium gratis för jobbsökare i Stockholm?',
    a: 'Ja. Att skapa profil, matcha med arbetsgivare i Stockholm och chatta direkt är helt gratis.',
  },
  {
    q: 'Vilka typer av jobb finns i Stockholm på Parium?',
    a: 'Det finns lediga jobb i Stockholm inom restaurang, lager, vård, bygg, transport, försäljning, IT och mycket mer — både heltid, deltid och extrajobb.',
  },
  {
    q: 'Hur snabbt kan jag få svar från arbetsgivare i Stockholm?',
    a: 'När en arbetsgivare matchar med dig kan ni chatta direkt i appen. Många kandidater i Stockholm får sina första matchningar inom 24 timmar.',
  },
  {
    q: 'Kan jag söka extrajobb i Stockholm?',
    a: 'Absolut. I Parium kan du filtrera på anställningsform — heltid, deltid, timanställning eller extrajobb i Stockholm.',
  },
];

const breadcrumbLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Parium', item: 'https://parium.se/' },
    { '@type': 'ListItem', position: 2, name: 'Jobb', item: 'https://parium.se/jobb' },
    { '@type': 'ListItem', position: 3, name: 'Stockholm', item: CANONICAL },
  ],
};

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const itemListLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Populära yrken i Stockholm',
  itemListElement: popularRoles.map((role, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: `${role} – lediga jobb i Stockholm`,
  })),
};

const JobbStockholm = () => {
  const navigate = useNavigate();

  useEffect(() => {
    syncBrowserChrome(window.location.pathname);
  }, []);

  return (
    <div className="min-h-[100dvh] w-full bg-[hsl(215_100%_12%)] bg-parium-gradient text-white">
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
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
        <script type="application/ld+json">{JSON.stringify(itemListLd)}</script>
      </Helmet>

      <LandingNav onLoginClick={() => navigate('/auth')} />

      {/* Hero */}
      <section className="relative px-5 pt-32 pb-16 sm:px-8 sm:pt-40 sm:pb-24 md:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-4 py-1.5 text-sm font-medium border border-white/15"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            Stockholm
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl"
          >
            Lediga jobb i Stockholm
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/85 sm:text-xl"
          >
            Hitta lediga jobb i Stockholm som faktiskt passar dig. Skapa profil gratis,
            matcha med arbetsgivare i Stockholm och chatta direkt – allt i jobbappen Parium.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button
              size="lg"
              onClick={() => navigate('/auth')}
              className="min-h-11 rounded-full bg-white text-[hsl(215_100%_12%)] hover:bg-white/90 px-7"
            >
              Skapa profil gratis
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Link
              to="/jobbsokare"
              className="min-h-11 inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur-md px-7 text-sm font-medium hover:bg-white/15 transition-colors"
            >
              Läs mer om Parium
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Populära yrken */}
      <section className="px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Populära yrken med lediga jobb i Stockholm
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-white/70">
            Stockholm är Sveriges största arbetsmarknad. Här är yrken där det
            ofta finns lediga jobb just nu.
          </p>
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {popularRoles.map((role) => (
              <li
                key={role}
                className="rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-md px-4 py-4 text-center text-sm font-medium text-white/90 hover:bg-white/10 transition-colors"
              >
                {role}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Så fungerar det */}
      <section className="px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Så hittar du jobb i Stockholm med Parium
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Search,
                title: 'Skapa profil',
                body: 'Ange Stockholm som plats och vilka yrken du är intresserad av. Gratis och tar någon minut.',
              },
              {
                icon: Zap,
                title: 'Matcha smart',
                body: 'Parium visar lediga jobb i Stockholm som passar din profil – inga oändliga listor.',
              },
              {
                icon: MessageSquare,
                title: 'Chatta direkt',
                body: 'När du matchar med en arbetsgivare i Stockholm kan ni prata direkt i appen.',
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md p-6"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 mb-4">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/75">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stadsdelar */}
      <section className="px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Jobb i Stockholms stadsdelar och kringkommuner
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-white/70">
            Oavsett var i Stockholmsområdet du vill jobba – Parium matchar dig med
            arbetsgivare nära dig.
          </p>
          <ul className="mt-8 flex flex-wrap justify-center gap-2">
            {stockholmAreas.map((area) => (
              <li
                key={area}
                className="rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-md px-4 py-2 text-sm text-white/85"
              >
                {area}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Vanliga frågor om jobb i Stockholm
          </h2>
          <div className="mt-10 space-y-3">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md p-5 open:bg-white/[0.08]"
              >
                <summary className="cursor-pointer list-none font-semibold text-white flex items-center justify-between gap-4">
                  <span>{f.q}</span>
                  <span className="text-white/50 transition-transform group-open:rotate-45 text-xl leading-none">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-white/80">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-20 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-white/[0.08] backdrop-blur-md p-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Redo att hitta ditt nästa jobb i Stockholm?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">
            Skapa profil gratis och börja matcha med arbetsgivare i Stockholm idag.
          </p>
          <Button
            size="lg"
            onClick={() => navigate('/auth')}
            className="mt-8 min-h-11 rounded-full bg-white text-[hsl(215_100%_12%)] hover:bg-white/90 px-7"
          >
            Skapa profil gratis
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  );
};

export default JobbStockholm;
