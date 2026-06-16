import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import LandingNav from '@/components/LandingNav';
import SeoBubbles from '@/components/seo/SeoBubbles';
import SeoBackButton from '@/components/seo/SeoBackButton';
import { SeoTruncateLink } from '@/components/seo/SeoTruncateLink';
import { TooltipProvider } from '@/components/ui/tooltip';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { Button } from '@/components/ui/button';
import SeoCTAButton from '@/components/seo/SeoCTAButton';
import { ArrowRight, Briefcase, Search } from 'lucide-react';
import { OCCUPATIONS } from '@/data/jobOccupations';
import { getAllOccupations, OCCUPATION_CATEGORIES } from '@/lib/occupations';
import { slugifyOccupation } from '@/lib/genericOccupation';

const BASE = 'https://parium.se';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const categoryByOccupation = new Map(
  OCCUPATION_CATEGORIES.flatMap((category) =>
    category.subcategories.map((name) => [normalize(name), category.label] as const),
  ),
);

const SEO_BY_NORMALIZED_NAME = new Map(
  OCCUPATIONS.flatMap((o) => [
    [normalize(o.name), o],
    [normalize(o.plural), o],
  ] as const),
);

type DirectoryEntry = {
  key: string;
  title: string;
  category: string;
  to: string;
  search: string;
  sortKey: string;
};

// Bygg deduperad katalog: SEO-sidor + alla övriga yrken som auto-genereras.
// Alla får en riktig /yrke/{slug}-länk (ingen /auth).
const seenSlugs = new Set<string>();
const rawDirectory: DirectoryEntry[] = [];

for (const o of OCCUPATIONS) {
  if (seenSlugs.has(o.slug)) continue;
  seenSlugs.add(o.slug);
  rawDirectory.push({
    key: `seo-${o.slug}`,
    title: `Lediga jobb ${o.asForm}`,
    category: o.category,
    to: `/yrke/${o.slug}`,
    search: [o.name, o.plural, o.asForm, o.category, o.intro].join(' '),
    sortKey: o.name,
  });
}

for (const name of getAllOccupations()) {
  if (SEO_BY_NORMALIZED_NAME.has(normalize(name))) continue;
  const slug = slugifyOccupation(name);
  if (!slug || seenSlugs.has(slug)) continue;
  seenSlugs.add(slug);
  rawDirectory.push({
    key: `occ-${slug}`,
    title: `Lediga jobb som ${name.toLowerCase()}`,
    category: categoryByOccupation.get(normalize(name)) || 'Yrke',
    to: `/yrke/${slug}`,
    search: name,
    sortKey: name,
  });
}

// Bokstavsordning (svenska)
const DIRECTORY: DirectoryEntry[] = rawDirectory.sort((a, b) =>
  a.sortKey.localeCompare(b.sortKey, 'sv'),
);

const YrkenHub = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => {
    syncBrowserChrome(window.location.pathname);
    window.scrollTo(0, 0);
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return DIRECTORY;
    return DIRECTORY.filter((o) => normalize(o.search).includes(q));
  }, [query]);

  // Desktop (md:grid-cols-3): TRIMMA till multipel av 3 så raden alltid är komplett.
  // Inga osynliga "tomma rutor" — antingen 3/3 eller helt borta.
  const desktopList = useMemo(() => {
    const len = filtered.length;
    return filtered.slice(0, len - (len % 3));
  }, [filtered]);

  const canonical = `${BASE}/yrken`;
  const title = 'Lediga jobb per yrke – sök jobb i hela Sverige | Parium';
  const description =
    'Sök lediga jobb per yrke i hela Sverige. Snickare, elektriker, undersköterska, lager, restaurang, butik och fler. Matcha direkt med arbetsgivare i Parium.';

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Lediga jobb per yrke i Sverige',
    itemListElement: OCCUPATIONS.map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${BASE}/yrke/${o.slug}`,
      name: `Lediga jobb ${o.asForm}`,
    })),
  };

  // Hem → Yrken — så Google visar fina breadcrumbs i sökresultatet.
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Parium', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Yrken', item: canonical },
    ],
  };

  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={100}>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="sv_SE" />
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
        <script type="application/ld+json">{JSON.stringify(itemListLd)}</script>
      </Helmet>

      <div className="seo-scroll-page pb-16 bg-[hsl(215_100%_12%)] bg-parium-gradient text-white">
        <LandingNav onLoginClick={() => navigate('/auth')} />
        <SeoBackButton fallback="/jobb" />

        <section className="relative overflow-hidden px-5 pt-28 pb-8 sm:px-8 sm:pb-12 md:px-12">
          <SeoBubbles />
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl md:text-6xl text-white">
              Lediga jobb per yrke
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-white sm:mt-6 sm:text-xl">
              Hitta lediga jobb inom Sveriges mest efterfrågade yrken. Skapa min profil idag och
              matcha med arbetsgivare över hela landet.
            </p>
          </div>
        </section>

        <section className="px-5 pb-12 sm:px-8 md:px-12">
          <div className="mx-auto max-w-5xl">
            {/* Sökruta (alla skärmar) */}
            <div className="mb-5 md:mb-8">
              <label className="relative block mx-auto max-w-xl">
                <span className="sr-only">Sök yrke</span>
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  inputMode="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Sök yrke, t.ex. elektriker, kock, lärare"
                  className="w-full min-h-11 rounded-full border border-white/15 bg-white/[0.07] pl-11 pr-4 text-base text-white placeholder:text-white/50 outline-none focus:border-white/30 focus:bg-white/[0.10]"
                  style={{ fontSize: '16px' }}
                />
              </label>
            </div>

            {/* Mobil: stackad lista – hela titlar, ingen trunkering */}
            <ul className="grid grid-cols-1 gap-3 md:hidden">
              {filtered.map((o) => (
                <li key={o.key}>
                  <Link
                    to={o.to}
                    className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-4 active:bg-white/[0.12] transition-colors"
                  >
                    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <Briefcase className="h-4 w-4 text-white" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-wider text-white">
                        {o.category}
                      </p>
                      <p className="text-base font-semibold text-white break-words leading-snug">
                        {o.title}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />
                  </Link>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center text-sm text-white">
                  Inga yrken matchar "{query}".
                </li>
              )}
            </ul>

            {/* Desktop/tablet: 3-kolumners kompakt grid med tooltip vid trunkering */}
            <ul className="hidden md:grid gap-3 grid-cols-2 md:grid-cols-3">
              {desktopList.map((o) => (
                <li key={o.key}>
                  <SeoTruncateLink
                    to={o.to}
                    fullText={o.title}
                    className="flex h-16 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] px-4 hover:bg-white/[0.11] hover:border-white/20 transition-colors"
                  >
                    <Briefcase className="h-4 w-4 shrink-0 text-white" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-white truncate">
                        {o.category}
                      </p>
                      <span
                        data-truncate-text
                        className="block w-full truncate text-sm font-semibold text-white"
                      >
                        {o.title}
                      </span>
                    </div>
                  </SeoTruncateLink>
                </li>
              ))}
              {desktopList.length === 0 && (
                <li className="col-span-full rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-white">
                  Inga yrken matchar "{query}".
                </li>
              )}
            </ul>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8 md:px-12">
          <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-white/[0.08] p-8 sm:p-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl text-white">
              Hitta ditt nästa jobb idag
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white">
              Skapa min profil idag – matcha med arbetsgivare i hela Sverige.
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

export default YrkenHub;
