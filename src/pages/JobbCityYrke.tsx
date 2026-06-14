import { useEffect } from 'react';
import { Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import LandingNav from '@/components/LandingNav';
import MobileStickyCTA from '@/components/seo/MobileStickyCTA';
import SeoCTAButton from '@/components/seo/SeoCTAButton';
import {
  SeoOtherOccupationsInCity,
  SeoOccupationInOtherCities,
} from '@/components/seo/SeoFooterLinks';
import { useJobCounts, getJobCount } from '@/hooks/useJobCounts';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { CheckCircle2, MapPin, Zap, ChevronRight } from 'lucide-react';
import { CITY_BY_SLUG, CITIES } from '@/data/jobCities';
import { OCCUPATION_BY_SLUG, OCCUPATIONS } from '@/data/jobOccupations';

const BASE = 'https://parium.se';

const JobbCityYrke = () => {
  const { citySlug, occupationSlug } = useParams<{ citySlug: string; occupationSlug: string }>();
  const navigate = useNavigate();
  const city = citySlug ? CITY_BY_SLUG[citySlug] : null;
  const occ = occupationSlug ? OCCUPATION_BY_SLUG[occupationSlug] : null;
  const { data: counts } = useJobCounts();

  useEffect(() => {
    syncBrowserChrome(window.location.pathname);
  }, []);

  if (!city || !occ) return <Navigate to="/jobb" replace />;

  const canonical = `${BASE}/jobb/${city.slug}/${occ.slug}`;
  const title = `Lediga jobb ${occ.asForm} ${city.inForm} – sök ${occ.plural}jobb | Parium`;
  const description = `Hitta lediga jobb ${occ.asForm} ${city.inForm}. Se vanliga arbetsuppgifter, krav och lön. Skapa profil gratis i Parium och matcha med arbetsgivare ${city.inForm} på sekunder.`;

  const jobCount = getJobCount(counts, { citySlug: city.slug, occupationSlug: occ.slug });
  const hasJobs = jobCount > 0;
  const secondaryLabel = hasJobs
    ? jobCount === 1
      ? 'Se 1 jobb'
      : `Se ${jobCount} jobb`
    : 'Bevaka denna sökning';

  const faqs = [
    {
      q: `Hur hittar jag lediga jobb ${occ.asForm} ${city.inForm}?`,
      a: `Skapa en gratis profil i Parium, välj ${occ.name} som yrke och ${city.name} som plats. Matchningen visar lediga jobb ${occ.asForm} ${city.inForm} direkt – och du kan chatta med arbetsgivare på en gång.`,
    },
    {
      q: `Vad tjänar en ${occ.name.toLowerCase()} ${city.inForm}?`,
      a: `${occ.salary} Lönenivån ${city.inForm} ligger ofta något över genomsnittet på grund av efterfrågan.`,
    },
    {
      q: `Vilka områden ${city.inForm} har flest jobb ${occ.asForm}?`,
      a: `Lediga jobb ${occ.asForm} finns bland annat i ${city.areas.slice(0, 4).join(', ')} och andra delar av ${city.name}.`,
    },
    {
      q: `Vad krävs för att jobba ${occ.asForm} ${city.inForm}?`,
      a: occ.skills.slice(0, 3).join(' '),
    },
    {
      q: `Är Parium gratis?`,
      a: `Ja, helt gratis för dig som söker jobb. Skapa profil, matcha och chatta utan kostnad.`,
    },
  ];

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Parium', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Jobb', item: `${BASE}/jobb` },
      { '@type': 'ListItem', position: 3, name: city.name, item: `${BASE}/jobb/${city.slug}` },
      { '@type': 'ListItem', position: 4, name: occ.name, item: canonical },
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

  const occupationLd = {
    '@context': 'https://schema.org',
    '@type': 'Occupation',
    name: `${occ.name} ${city.inForm}`,
    occupationLocation: {
      '@type': 'City',
      name: city.name,
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'SE',
        addressLocality: city.name,
        addressRegion: city.county,
      },
    },
    estimatedSalary: {
      '@type': 'MonetaryAmountDistribution',
      name: 'baseSalary',
      currency: 'SEK',
      duration: 'P1M',
    },
    responsibilities: occ.tasks.join('. '),
    skills: occ.skills.join('. '),
  };

  return (
    <>
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
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
        <script type="application/ld+json">{JSON.stringify(occupationLd)}</script>
      </Helmet>

      <div className="seo-scroll-page pb-28 md:pb-0 bg-[hsl(215_100%_12%)] text-white">
        <LandingNav onLoginClick={() => navigate('/auth')} />

        {/* ─── HERO ─── */}
        <section className="relative overflow-hidden px-5 pt-28 pb-14 sm:px-8 md:px-12">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-60"
            style={{
              background:
                'radial-gradient(70% 60% at 50% 0%, rgba(70,130,255,0.30) 0%, rgba(70,130,255,0) 70%)',
            }}
          />
          <div className="mx-auto max-w-4xl text-center">
            <nav aria-label="Brödsmulor" className="mb-4 text-xs text-white">
              <Link to="/jobb" className="text-white hover:opacity-80">Jobb</Link>
              <span className="mx-1.5 text-white">/</span>
              <Link to={`/jobb/${city.slug}`} className="text-white hover:opacity-80">{city.name}</Link>
              <span className="mx-1.5 text-white">/</span>
              <span className="text-white">{occ.name}</span>
            </nav>

            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-medium tracking-wide text-white backdrop-blur">
              <MapPin className="h-3.5 w-3.5" />
              {city.name} · {occ.category}
              {hasJobs && (
                <span className="ml-1 rounded-full bg-secondary/25 text-white px-2 py-0.5 text-[11px] font-semibold">
                  {jobCount} aktiva
                </span>
              )}
            </p>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-white">
              Lediga jobb {occ.asForm} {city.inForm}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-white sm:text-lg">
              {occ.intro} I {city.name} matchar Parium dig direkt med arbetsgivare som söker {occ.plural}.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <SeoCTAButton
                label="Skapa min profil idag"
                to="/auth"
                navState={{ mode: 'signup' }}
              />
              <SeoCTAButton
                variant="ghost"
                showArrow={false}
                label={secondaryLabel}
                to={hasJobs ? `/jobb/${city.slug}` : '/auth'}
                navState={
                  hasJobs
                    ? undefined
                    : {
                        mode: 'signup',
                        savedSearchIntent: {
                          city: city.name,
                          citySlug: city.slug,
                          occupation: occ.name,
                          occupationSlug: occ.slug,
                          returnTo: `/jobb/${city.slug}/${occ.slug}`,
                        },
                      }
                }
              />
            </div>
          </div>
        </section>

        {/* ─── KOMPAKT INFO: Arbetsuppgifter | Krav | Lön ─── */}
        <section className="px-5 py-10 sm:px-8 md:px-12">
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-md">
              <h2 className="text-base font-semibold tracking-tight text-white">
                Arbetsuppgifter
              </h2>
              <ul className="mt-4 space-y-2.5">
                {occ.tasks.slice(0, 5).map((task) => (
                  <li key={task} className="flex items-start gap-2.5 text-sm text-white">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-white" />
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-md">
              <h2 className="text-base font-semibold tracking-tight text-white">
                Krav & kompetens
              </h2>
              <ul className="mt-4 space-y-2.5">
                {occ.skills.slice(0, 5).map((skill) => (
                  <li key={skill} className="flex items-start gap-2.5 text-sm text-white">
                    <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-white" />
                    <span>{skill}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-md">
              <h2 className="text-base font-semibold tracking-tight text-white">
                Lön {city.inForm}
              </h2>
              <p className="mt-4 text-sm text-white leading-relaxed">{occ.salary}</p>
              <p className="mt-3 text-xs text-white/80">
                Områden: {city.areas.slice(0, 3).join(', ')}
              </p>
            </div>
          </div>
        </section>


        {/* ─── FAQ (kompakt accordion, stängd by default) ─── */}
        <section className="px-5 py-10 sm:px-8 md:px-12">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-xl font-semibold tracking-tight sm:text-2xl text-white">
              Vanliga frågor
            </h2>
            <div className="mt-6 space-y-2">
              {faqs.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md transition-colors hover:bg-white/[0.06]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-white">
                    <span>{f.q}</span>
                    <ChevronRight className="h-4 w-4 text-white transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="px-5 pb-5 pt-0 text-sm text-white leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Intern länk-footer: andra yrken i staden ─── */}
        <SeoOtherOccupationsInCity
          citySlug={city.slug}
          cityName={city.name}
          cityInForm={city.inForm}
          currentOccupationSlug={occ.slug}
          occupations={OCCUPATIONS}
        />

        {/* ─── Intern länk-footer: samma yrke i andra städer ─── */}
        <SeoOccupationInOtherCities
          occupationSlug={occ.slug}
          occupationName={occ.name}
          currentCitySlug={city.slug}
          cities={CITIES}
        />

        {/* ─── Slut-CTA ─── */}
        <section className="px-5 py-16 sm:px-8 md:px-12">
          <div className="mx-auto max-w-2xl rounded-3xl border border-white/15 bg-white/[0.05] backdrop-blur-md p-8 sm:p-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl text-white">
              Sök jobb {occ.asForm} {city.inForm} idag
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-white">
              Skapa en profil gratis. Matcha med arbetsgivare {city.inForm} på sekunder.
            </p>
            <div className="mt-7 flex justify-center">
              <SeoCTAButton label="Skapa min profil idag" to="/auth" />
            </div>
          </div>
        </section>

        <MobileStickyCTA />
      </div>
    </>
  );
};

export default JobbCityYrke;
