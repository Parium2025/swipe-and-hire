import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import LandingNav from '@/components/LandingNav';
import MobileStickyCTA from '@/components/seo/MobileStickyCTA';
import SeoCTAButton from '@/components/seo/SeoCTAButton';
import SeoFooterLinks, {
  SeoOtherOccupationsInCity,
} from '@/components/seo/SeoFooterLinks';
import { useJobCounts, getJobCount } from '@/hooks/useJobCounts';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Zap, MessageSquare, Search, Briefcase, Building2 } from 'lucide-react';
import { CITIES, CITY_BY_SLUG, POPULAR_ROLES } from '@/data/jobCities';
import { OCCUPATIONS } from '@/data/jobOccupations';

type PublicJobRow = {
  id: string;
  title: string;
  workplace_city: string | null;
  workplace_name: string | null;
  employment_type: string | null;
};

const sampleJobsForCity = (cityName: string) => [
  { id: 'profile', title: 'Butiksmedarbetare', company: 'Retail & Service', type: 'Deltid', location: cityName },
  { id: 'profile-2', title: 'Lagerarbetare', company: 'Logistikpartner', type: 'Heltid', location: cityName },
  { id: 'profile-3', title: 'Restaurangpersonal', company: 'Restauranggrupp', type: 'Extra', location: cityName },
];

const BASE = 'https://parium.se';

const JobbCity = () => {
  const { citySlug } = useParams<{ citySlug: string }>();
  const navigate = useNavigate();
  const city = citySlug ? CITY_BY_SLUG[citySlug] : null;
  const { data: counts } = useJobCounts();
  const [jobs, setJobs] = useState<PublicJobRow[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  useEffect(() => {
    syncBrowserChrome(window.location.pathname);
  }, []);

  useEffect(() => {
    if (!city) return;
    let cancelled = false;
    setJobsLoading(true);
    (async () => {
      const { data } = await supabase
        .from('job_postings')
        .select('id,title,workplace_city,workplace_name,employment_type')
        .eq('is_active', true)
        .is('deleted_at', null)
        .ilike('workplace_city', `%${city.name}%`)
        .order('created_at', { ascending: false })
        .limit(6);
      if (!cancelled) {
        setJobs((data as PublicJobRow[]) || []);
        setJobsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [city]);

  if (!city) return <Navigate to="/jobb" replace />;

  const canonical = `${BASE}/jobb/${city.slug}`;
  const title = `Lediga jobb ${city.inForm} – sök jobb snabbt med Parium`;
  const description = `Hitta lediga jobb ${city.inForm} som passar dig. Skapa min profil idag, matcha med arbetsgivare ${city.inForm} och chatta direkt i jobbappen Parium.`;

  const faqs = [
    {
      q: `Hur hittar jag lediga jobb ${city.inForm} med Parium?`,
      a: `Skapa en kostnadsfri profil i Parium, ange ${city.name} som plats och vilka yrken du är intresserad av. Vår smarta matchning visar lediga jobb ${city.inForm} som passar din profil – direkt i flödet.`,
    },
    {
      q: `Är Parium gratis för jobbsökare ${city.inForm}?`,
      a: `Ja. Att skapa profil, matcha med arbetsgivare ${city.inForm} och chatta direkt är helt gratis.`,
    },
    {
      q: `Vilka typer av jobb finns ${city.inForm} på Parium?`,
      a: `Det finns lediga jobb ${city.inForm} inom restaurang, lager, vård, bygg, transport, försäljning, IT och mycket mer – både heltid, deltid och extrajobb.`,
    },
    {
      q: `Hur snabbt kan jag få svar från arbetsgivare ${city.inForm}?`,
      a: `När en arbetsgivare matchar med dig kan ni chatta direkt i appen. Många kandidater ${city.inForm} får sina första matchningar inom 24 timmar.`,
    },
    {
      q: `Kan jag söka extrajobb ${city.inForm}?`,
      a: `Absolut. I Parium kan du filtrera på anställningsform – heltid, deltid, timanställning eller extrajobb ${city.inForm}.`,
    },
  ];

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Parium', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Jobb', item: `${BASE}/jobb` },
      { '@type': 'ListItem', position: 3, name: city.name, item: canonical },
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
    name: `Populära yrken ${city.inForm}`,
    itemListElement: POPULAR_ROLES.map((role, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${role} – lediga jobb ${city.inForm}`,
    })),
  };

  // Länka till 4 andra städer (intern länkning)
  const otherCities = CITIES.filter((c) => c.slug !== city.slug).slice(0, 6);
  const displayedJobs = jobs.length > 0
    ? jobs.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.workplace_name || 'Arbetsgivare',
        type: job.employment_type || 'Jobb',
        location: job.workplace_city || city.name,
      }))
    : sampleJobsForCity(city.name);

  return (
    <div data-seo-scroll-root className="seo-scroll-page pb-28 md:pb-0 bg-[hsl(215_100%_12%)] bg-parium-gradient text-white">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="sv_SE" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
        <script type="application/ld+json">{JSON.stringify(itemListLd)}</script>
      </Helmet>

      <LandingNav onLoginClick={() => navigate('/auth')} />

      {/* Hero */}
      <section className="relative px-5 pt-32 pb-16 sm:px-8 sm:pt-40 sm:pb-24 md:px-12">
        <div className="mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-4 py-1.5 text-sm font-medium border border-white/15"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {city.county}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl"
          >
            Lediga jobb {city.inForm}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/85 sm:text-xl"
          >
            {city.intro} Skapa min profil idag och matcha med arbetsgivare {city.inForm} direkt i appen.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <SeoCTAButton label="Skapa min profil idag" to="/auth" />
            <Link
              to="/annonser"
              className="min-h-11 inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur-md px-7 text-sm font-medium hover:bg-white/15 transition-colors"
            >
              Alla jobb {city.inForm}
            </Link>
          </motion.div>
        </div>
      </section>

      <section id="alla-jobb" className="scroll-mt-24 px-5 pb-12 sm:px-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Alla jobb {city.inForm}</h2>
              <p className="mt-2 text-sm text-white/70">{jobsLoading ? 'Hämtar aktiva annonser…' : jobs.length > 0 ? 'Riktiga annonser som går att öppna direkt.' : 'Skapa profil för att se fler matchande jobb i appen.'}</p>
            </div>
            <Link to="/annonser" className="hidden text-sm font-medium text-white/80 underline-offset-4 hover:underline sm:inline-flex">Visa senaste jobb</Link>
          </div>
          <ul className="grid gap-3 md:grid-cols-3">
            {displayedJobs.map((job) => (
              <li key={job.title}>
                <button
                  type="button"
                  onPointerDown={() => navigate(jobs.length > 0 ? `/annons/${job.id}` : '/auth')}
                  className="group flex min-h-[150px] w-full flex-col justify-between rounded-2xl border border-white/15 bg-white/[0.07] p-5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition-colors hover:bg-white/[0.10]"
                >
                  <div>
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                      <Briefcase className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="text-lg font-semibold leading-snug text-white">{job.title}</h3>
                  </div>
                  <div className="mt-5 space-y-2 text-sm text-white/75">
                    <p className="flex items-center gap-2"><Building2 className="h-4 w-4" aria-hidden="true" />{job.company}</p>
                    <p className="flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden="true" />{job.location} · {job.type}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Populära yrken (intern länkning med äkta siffror) */}
      {city && (
        <SeoOtherOccupationsInCity
          citySlug={city.slug}
          cityName={city.name}
          cityInForm={city.inForm}
          occupations={OCCUPATIONS}
          limit={12}
        />
      )}

      {/* Så fungerar det */}
      <section className="px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Så hittar du jobb {city.inForm} med Parium
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icon: Search, title: 'Skapa profil', body: `Ange ${city.name} som plats och vilka yrken du är intresserad av. Gratis och tar någon minut.` },
              { icon: Zap, title: 'Matcha smart', body: `Parium visar lediga jobb ${city.inForm} som passar din profil – inga oändliga listor.` },
              { icon: MessageSquare, title: 'Chatta direkt', body: `När du matchar med en arbetsgivare ${city.inForm} kan ni prata direkt i appen.` },
            ].map(({ icon: Icon, title: t, body }) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md p-6">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 mb-4">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold">{t}</h3>
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
            Jobb {city.inForm}s stadsdelar och kringkommuner
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-white/70">
            Oavsett var i {city.name}-området du vill jobba – Parium matchar dig med arbetsgivare nära dig.
          </p>
          <ul className="mt-8 flex flex-wrap justify-center gap-2">
            {city.areas.map((area) => (
              <li key={area} className="rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-md px-4 py-2 text-sm text-white/85">
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
            Vanliga frågor om jobb {city.inForm}
          </h2>
          <div className="mt-10 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md p-5 open:bg-white/[0.08]">
                <summary className="cursor-pointer list-none font-semibold text-white flex items-center justify-between gap-4">
                  <span>{f.q}</span>
                  <span className="text-white/50 transition-transform group-open:rotate-45 text-xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-white/80">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Andra städer (intern länkning, äkta siffror) */}
      <SeoFooterLinks
        title="Lediga jobb i andra städer"
        icon="city"
        items={CITIES.filter((c) => c.slug !== city.slug)
          .map((c) => ({
            slug: c.slug,
            label: `Jobb ${c.inForm}`,
            to: `/jobb/${c.slug}`,
            count: getJobCount(counts, { citySlug: c.slug }),
          }))
          .sort((a, b) => (b.count || 0) - (a.count || 0))
          .slice(0, 9)}
      />

      {/* CTA */}
      <section className="px-5 py-20 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-white/[0.08] backdrop-blur-md p-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Redo att hitta ditt nästa jobb {city.inForm}?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">
            Skapa min profil idag och börja matcha med arbetsgivare {city.inForm} idag.
          </p>
          <div className="mt-7 flex justify-center">
            <SeoCTAButton label="Skapa min profil idag" to="/auth" />
          </div>
        </div>
      </section>
      <MobileStickyCTA />
    </div>
  );
};

export default JobbCity;
