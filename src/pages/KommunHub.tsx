import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SiteFooter from '@/components/landing/SiteFooter';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import LandingNav from '@/components/LandingNav';
import SeoBubbles from '@/components/seo/SeoBubbles';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { MapPin, Search } from 'lucide-react';
import { KOMMUNER } from '@/data/jobMunicipalities';

const CANONICAL = 'https://parium.se/kommuner';
const TITLE = 'Lediga jobb i Sveriges kommuner – sök på din kommun | Parium';
const DESCRIPTION = 'Hitta lediga jobb i alla 290 svenska kommuner. Från Stockholm och Göteborg till Kiruna och Trelleborg – sök jobb i jobbappen Parium.';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Gruppera per län, sorterat alfabetiskt på län + kommun
const GROUPED = (() => {
  const map = new Map<string, typeof KOMMUNER>();
  for (const k of KOMMUNER) {
    if (!map.has(k.county)) map.set(k.county, [] as typeof KOMMUNER);
    map.get(k.county)!.push(k);
  }
  const counties = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, 'sv'));
  return counties.map((county) => ({
    county,
    kommuner: map.get(county)!.sort((a, b) => a.name.localeCompare(b.name, 'sv')),
  }));
})();

const KommunHub = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => {
    syncBrowserChrome(window.location.pathname);
    window.scrollTo(0, 0);
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return GROUPED;
    return GROUPED
      .map(({ county, kommuner }) => ({
        county,
        kommuner: kommuner.filter(
          (k) => normalize(k.name).includes(q) || normalize(county).includes(q),
        ),
      }))
      .filter((g) => g.kommuner.length > 0);
  }, [query]);

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Sveriges kommuner – lediga jobb',
    itemListElement: KOMMUNER.map((k, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `Lediga jobb i ${k.name} kommun`,
      url: `https://parium.se/kommun/${k.slug}`,
    })),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Parium', item: 'https://parium.se/' },
      { '@type': 'ListItem', position: 2, name: 'Kommuner', item: CANONICAL },
    ],
  };

  return (
    <div className="seo-scroll-page bg-[hsl(215_100%_12%)] bg-parium-gradient text-white">
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
      <section className="relative overflow-hidden px-5 pt-32 pb-10 sm:px-8 sm:pt-40 sm:pb-14 md:px-12">
        <SeoBubbles />
        <div className="mx-auto max-w-4xl text-center">
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl text-white"
          >
            Lediga jobb i Sveriges kommuner
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white sm:text-xl"
          >
            Välj din kommun och hitta lediga jobb där du bor. Parium täcker alla 290 kommuner – från storstad till glesbygd.
          </motion.p>
        </div>
      </section>

      {/* Sök */}
      <section className="px-5 pb-8 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl">
          <label className="relative block">
            <span className="sr-only">Sök kommun eller län</span>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök kommun eller län"
              autoComplete="off"
              inputMode="search"
              className="w-full rounded-2xl border border-white/15 bg-white/[0.06] py-3.5 pl-11 pr-4 text-base text-white placeholder:text-white/50 focus:border-white/30 focus:outline-none"
              style={{ fontSize: '16px' }}
            />
          </label>
        </div>
      </section>

      {/* Lista per län */}
      <section className="px-5 pb-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-5xl space-y-10">
          {filtered.length === 0 && (
            <p className="text-center text-white">Inga kommuner matchar din sökning.</p>
          )}
          {filtered.map(({ county, kommuner }) => (
            <div key={county}>
              <h2 className="mb-4 text-lg font-semibold tracking-tight text-white">{county}</h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {kommuner.map((k) => (
                  <li key={k.slug}>
                    <Link
                      to={`/kommun/${k.slug}`}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white hover:bg-white/10 transition"
                    >
                      <MapPin className="h-4 w-4 text-white/70" aria-hidden="true" />
                      <span className="truncate">{k.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Footer-länk — leder till yrkes-hubben (mer relevant än städer-listan) */}
      <section className="px-5 pb-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl text-center text-sm text-white">
          Söker du efter ett specifikt yrke istället?{' '}
          <Link to="/yrken" className="underline-offset-4 hover:underline text-white">
            Se alla yrken →
          </Link>
        </div>
      </section>
    </div>
  );
};

export default KommunHub;
