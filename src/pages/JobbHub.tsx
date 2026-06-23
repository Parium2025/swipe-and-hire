import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import LandingNav from '@/components/LandingNav';
import SeoBubbles from '@/components/seo/SeoBubbles';
import { SeoTruncateLink } from '@/components/seo/SeoTruncateLink';
import SeoEmptyResultCTA from '@/components/seo/SeoEmptyResultCTA';
import SeoSearchBox from '@/components/seo/SeoSearchBox';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { Button } from '@/components/ui/button';
import SeoCTAButton from '@/components/seo/SeoCTAButton';
import { ArrowRight, MapPin, Briefcase } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { CITIES } from '@/data/jobCities';
import { OCCUPATIONS } from '@/data/jobOccupations';
import { smartMatchScore } from '@/lib/seoSearch';

const POPULAR_CITIES = [
  'Stockholm',
  'Göteborg',
  'Malmö',
  'Uppsala',
  'Västerås',
  'Örebro',
  'Linköping',
  'Helsingborg',
];

const POPULAR_OCCUPATIONS = [
  'Undersköterska',
  'Lagerarbetare',
  'Chaufför',
  'Snickare',
  'Elektriker',
  'Lärare',
  'Servitör',
  'Kock',
];

const CANONICAL = 'https://parium.se/jobb';
const TITLE = 'Lediga jobb i hela Sverige – jobbapp & matchning | Parium';
const DESCRIPTION = 'Hitta lediga jobb i hela Sverige. Stockholm, Göteborg, Malmö, Uppsala och fler – sök jobb i jobbappen Parium.';

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// Bokstavsordning (svenska) — städer & yrken
const SORTED_CITIES = [...CITIES].sort((a, b) => a.name.localeCompare(b.name, 'sv'));
const SORTED_OCCUPATIONS = [...OCCUPATIONS].sort((a, b) => a.name.localeCompare(b.name, 'sv'));

const JobbHub = () => {
  const navigate = useNavigate();
  const [cityQuery, setCityQuery] = useState('');
  const [occQuery, setOccQuery] = useState('');

  useEffect(() => {
    syncBrowserChrome(window.location.pathname);
    window.scrollTo(0, 0);
  }, []);

  const filteredCities = useMemo(() => {
    const q = cityQuery.trim();
    if (!q) return SORTED_CITIES;
    // Smart sökning: synonymer (län/stadsdelar), fuzzy, multi-ord.
    const scored = SORTED_CITIES.map((c) => ({
      c,
      score: smartMatchScore(q, [c.name, c.county]),
    })).filter((x) => x.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.map((x) => x.c);
  }, [cityQuery]);

  const filteredOccupations = useMemo(() => {
    const q = occQuery.trim();
    if (!q) return SORTED_OCCUPATIONS;
    const scored = SORTED_OCCUPATIONS.map((o) => ({
      o,
      score: smartMatchScore(q, [o.name, o.plural, o.asForm, o.category, o.intro || '']),
    })).filter((x) => x.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.map((x) => x.o);
  }, [occQuery]);

  // Desktop-listan: trimmad till multipel av 3 (aldrig ensamma kort) —
  // men vid 1–2 träffar visar vi alla istället för att gömma dem.
  const desktopOccupations = useMemo(() => {
    const len = filteredOccupations.length;
    if (len < 3) return filteredOccupations;
    const trimmed = len - (len % 3);
    return filteredOccupations.slice(0, trimmed);
  }, [filteredOccupations]);

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
    <TooltipProvider delayDuration={150} skipDelayDuration={100}>
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
            transition={{ duration: 0.35 }}
            className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl text-white"
          >
            Lediga jobb i hela Sverige
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white sm:text-xl"
          >
            Välj din stad nedan för att se lediga jobb där. Skapa en gratis profil för att söka jobb – eller utforska jobben efter yrke.
          </motion.p>
        </div>
      </section>

      {/* Städer */}
      <section className="px-5 pb-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="sr-only">Välj stad</h2>

          {/* Sökruta – endast mobil, med autocomplete + populära */}
          <div className="mb-4 md:hidden">
            <SeoSearchBox
              value={cityQuery}
              onChange={setCityQuery}
              placeholder="Sök stad eller län"
              ariaLabel="Sök stad"
              storageKey="parium:recent-stader"
              popular={POPULAR_CITIES}
              suggestions={filteredCities.slice(0, 8).map((c) => ({
                label: `Lediga jobb ${c.inForm}`,
                sub: c.county,
                to: `/jobb/${c.slug}`,
                term: c.name,
              }))}
            />
          </div>

          {/* Mobil: stackad lista med hela titlar */}
          <ul className="grid grid-cols-1 gap-3 md:hidden">
            {filteredCities.map((c) => {
              const title = `Lediga jobb ${c.inForm}`;
              return (
                <li key={c.slug}>
                  <Link
                    to={`/jobb/${c.slug}`}
                    className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-4 active:bg-white/[0.12] transition-colors"
                  >
                    <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-white break-words">{title}</p>
                      <p className="mt-0.5 text-sm text-white/85 break-words">{c.county}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/50" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
            {filteredCities.length === 0 && (
              <li>
                <SeoEmptyResultCTA query={cityQuery} kind="stad" />
              </li>
            )}
          </ul>

          {/* Desktop/tablet: grid */}
          <ul className="hidden md:grid grid-cols-2 gap-3 lg:grid-cols-3">
            {filteredCities.map((c) => {
              const title = `Lediga jobb ${c.inForm}`;
              return (
                <li key={c.slug}>
                  <Link
                    to={`/jobb/${c.slug}`}
                    className="group flex h-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-5 hover:bg-white/[0.11] transition-colors will-change-transform"
                  >
                    <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <TruncatedTitle
                        fullText={title}
                        className="truncate text-lg font-semibold text-white"
                      >
                        {title}
                      </TruncatedTitle>
                      <p className="mt-1 truncate text-sm text-white">{c.county}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/40 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="mx-auto mt-8 max-w-5xl text-center">
          <Link
            to="/kommuner"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.14] hover:border-white/30"
          >
            Se alla 290 kommuner
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
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

          {/* Sökruta – endast mobil, med autocomplete + populära */}
          <div className="mt-6 mb-4 md:hidden">
            <SeoSearchBox
              value={occQuery}
              onChange={setOccQuery}
              placeholder="Sök yrke"
              ariaLabel="Sök yrke"
              storageKey="parium:recent-yrken"
              popular={POPULAR_OCCUPATIONS}
              suggestions={filteredOccupations.slice(0, 8).map((o) => ({
                label: `Lediga jobb ${o.asForm}`,
                sub: o.category,
                to: `/yrke/${o.slug}`,
                term: o.name,
              }))}
            />
          </div>

          {/* Mobil: stackad lista med hela titlar */}
          <ul className="grid grid-cols-1 gap-3 md:hidden">
            {filteredOccupations.map((o) => {
              const label = `Lediga jobb ${o.asForm}`;
              return (
                <li key={o.slug}>
                  <Link
                    to={`/yrke/${o.slug}`}
                    className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-4 active:bg-white/[0.12] transition-colors"
                  >
                    <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <Briefcase className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <p className="min-w-0 flex-1 text-base font-medium text-white break-words">{label}</p>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/50" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
            {filteredOccupations.length === 0 && (
              <li>
                <SeoEmptyResultCTA query={occQuery} kind="yrke" />
              </li>
            )}
          </ul>

          {/* Desktop/tablet: grid med smart tooltip — endast hela rader (3/3) */}
          <ul className="mt-10 hidden md:grid grid-cols-3 gap-3">
            {desktopOccupations.map((o) => {
              const label = `Lediga jobb ${o.asForm}`;
              return (
                <li key={o.slug}>
                  <SeoTruncateLink
                    to={`/yrke/${o.slug}`}
                    fullText={label}
                    className="flex h-14 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3 text-center text-sm font-medium text-white hover:bg-white/[0.11] transition-colors"
                  >
                    <span data-truncate-text className="block w-full truncate text-white">{label}</span>
                  </SeoTruncateLink>
                </li>
              );
            })}
            {desktopOccupations.length === 0 && (
              <li className="col-span-full">
                <SeoEmptyResultCTA query={occQuery} kind="yrke" />
              </li>
            )}
          </ul>
          <div className="mt-8 flex justify-center">
            <Link
              to="/yrken"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.14] hover:border-white/30"
            >
              Utforska alla yrken
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
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
          <div className="mt-8 flex justify-center">
            <Link
              to="/guider"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.14] hover:border-white/30"
            >
              Läs alla guider
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>


      <section className="px-5 py-20 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-white/[0.08] p-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl text-white">
            Hitta ditt nästa jobb idag
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white">
            Skapa min profil idag. Inga oändliga listor – bara jobb som passar dig.
          </p>
          <div className="mt-8 flex justify-center">
            <SeoCTAButton onClick={() => navigate('/auth')} />
          </div>
        </div>
      </section>
    </div>
    </TooltipProvider>
  );
};

export default JobbHub;
