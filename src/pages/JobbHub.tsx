import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import LandingNav from '@/components/LandingNav';
import SeoBubbles from '@/components/seo/SeoBubbles';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin } from 'lucide-react';
import { CITIES } from '@/data/jobCities';
import { OCCUPATIONS } from '@/data/jobOccupations';

const CANONICAL = 'https://parium.se/jobb';
const TITLE = 'Lediga jobb i hela Sverige – jobbapp & matchning | Parium';
const DESCRIPTION = 'Hitta lediga jobb i hela Sverige. Stockholm, Göteborg, Malmö, Uppsala och fler – matcha med arbetsgivare och chatta direkt i jobbappen Parium.';

const JobbHub = () => {
  const navigate = useNavigate();

  useEffect(() => {
    syncBrowserChrome(window.location.pathname);
    window.scrollTo(0, 0);
  }, []);

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Lediga jobb i Sveriges städer',
    itemListElement: CITIES.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `Lediga jobb ${c.inForm}`,
      url: `https://parium.se/jobb/${c.slug}`,
    })),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Parium', item: 'https://parium.se/' },
      { '@type': 'ListItem', position: 2, name: 'Jobb', item: CANONICAL },
    ],
  };

  return (
    <div className="seo-scroll-page pb-16 bg-[hsl(215_100%_12%)] bg-parium-gradient text-white">
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
        <script type="application/ld+json">{JSON.stringify(itemListLd)}</script>
      </Helmet>

      <LandingNav onLoginClick={() => navigate('/auth')} />

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pt-32 pb-12 sm:px-8 sm:pt-40 sm:pb-16 md:px-12">
        <SeoBubbles />
        <div className="mx-auto max-w-4xl text-center">
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl text-white"
          >
            Lediga jobb i hela Sverige
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white sm:text-xl"
          >
            Välj din stad och hitta lediga jobb som matchar dig. Skapa min profil idag och börja matcha med arbetsgivare direkt.
          </motion.p>
        </div>
      </section>

      {/* Städer */}
      <section className="px-5 pb-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="sr-only">Välj stad</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CITIES.map((c) => (
              <li key={c.slug}>
                <Link
                  to={`/jobb/${c.slug}`}
                  className="group block rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md p-5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-white">
                        Lediga jobb {c.inForm}
                      </h3>
                      <p className="mt-1 text-sm text-white">{c.county}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-white/40 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all mt-3" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Yrken */}
      <section className="px-5 py-12 sm:px-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl text-white">
            Populära yrken på Parium
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-white">
            Klicka på ett yrke för att se lediga jobb, lön och vad som krävs.
          </p>
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {OCCUPATIONS.map((o) => (
              <li key={o.slug}>
                <Link
                  to={`/yrke/${o.slug}`}
                  className="block rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-md px-4 py-4 text-center text-sm font-medium text-white hover:bg-white/[0.10] transition"
                >
                  Lediga jobb {o.asForm}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-white text-sm">
            <Link to="/yrken" className="underline-offset-4 hover:underline">
              Se alla yrken →
            </Link>
          </p>
        </div>
      </section>

      {/* Guider */}
      <section className="px-5 py-12 sm:px-8 md:px-12">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl text-white">
            Guider för dig som söker jobb
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-white">
            Lönerapport, intervjutips och checklista för jobbyte – uppdaterat för 2026.
          </p>
          <Link
            to="/guider"
            className="mt-6 inline-flex items-center gap-1.5 text-white hover:opacity-80 underline-offset-4 hover:underline"
          >
            Läs alla guider →
          </Link>
        </div>
      </section>


      <section className="px-5 py-20 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-white/[0.08] backdrop-blur-md p-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Hitta ditt nästa jobb idag
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">
            Skapa min profil idag. Inga oändliga listor – bara jobb som passar dig.
          </p>
          <Button
            size="lg"
            onClick={() => navigate('/auth')}
            className="mt-8 min-h-11 rounded-full bg-secondary text-white hover:bg-secondary/90 px-7"
          >
            Skapa min profil idag
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  );
};

export default JobbHub;
