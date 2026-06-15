import { useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import LandingNav from '@/components/LandingNav';
import SeoBubbles from '@/components/seo/SeoBubbles';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { CITIES } from '@/data/jobCities';
import { OCCUPATIONS } from '@/data/jobOccupations';

/**
 * Renders children inline and only wraps them in a tooltip when the
 * underlying text is actually visually truncated. Mätning sker lazy
 * vid hover/touch — ingen reflow för icke-trunkerade element.
 */
function TruncateOnlyTooltip({
  fullText,
  children,
}: {
  fullText: string;
  children: (ref: React.RefObject<HTMLElement>) => ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [measured, setMeasured] = useState(false);

  const measure = useCallback(() => {
    if (measured) return;
    const el = ref.current;
    if (!el) return;
    const truncated =
      Math.ceil(el.scrollWidth) > Math.ceil(el.clientWidth) ||
      Math.ceil(el.scrollHeight) > Math.ceil(el.clientHeight);
    setIsTruncated(truncated);
    setMeasured(true);
  }, [measured]);

  if (!measured || !isTruncated) {
    return (
      <span
        onMouseEnter={measure}
        onTouchStart={measure}
        onFocus={measure}
        className="block h-full"
      >
        {children(ref)}
      </span>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children(ref) as any}</TooltipTrigger>
        <TooltipContent className="bg-slate-900/95 border border-white/20 text-white">
          {fullText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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
            {CITIES.map((c) => {
              const title = `Lediga jobb ${c.inForm}`;
              return (
                <li key={c.slug}>
                  <Link
                    to={`/jobb/${c.slug}`}
                    className="group flex h-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md p-5 hover:bg-white/10 transition-colors"
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
                      <p className="mt-1 truncate text-sm text-white/80">{c.county}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/40 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
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
            {OCCUPATIONS.map((o) => {
              const label = `Lediga jobb ${o.asForm}`;
              return (
                <li key={o.slug}>
                  <TruncateOnlyTooltip fullText={label}>
                    {(ref) => (
                      <Link
                        ref={ref as React.RefObject<HTMLAnchorElement>}
                        to={`/yrke/${o.slug}`}
                        className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-md px-4 py-4 text-center text-sm font-medium text-white hover:bg-white/[0.10] transition"
                      >
                        <span className="block w-full truncate">{label}</span>
                      </Link>
                    )}
                  </TruncateOnlyTooltip>
                </li>
              );
            })}
          </ul>
          <div className="mt-8 flex justify-center">
            <Link
              to="/yrken"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-6 py-2.5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/[0.14] hover:border-white/30"
            >
              Se alla yrken
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
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-6 py-2.5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/[0.14] hover:border-white/30"
            >
              Läs alla guider
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>


      <section className="px-5 py-20 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-white/[0.08] backdrop-blur-md p-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl text-white">
            Hitta ditt nästa jobb idag
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white">
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
