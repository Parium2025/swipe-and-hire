import { useEffect } from 'react';
import { Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import LandingNav from '@/components/LandingNav';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { Button } from '@/components/ui/button';
import { ArrowRight, Briefcase, CheckCircle2, MapPin, Zap } from 'lucide-react';
import { CITY_BY_SLUG, CITIES } from '@/data/jobCities';
import { OCCUPATION_BY_SLUG, OCCUPATIONS } from '@/data/jobOccupations';

const BASE = 'https://parium.se';

const JobbCityYrke = () => {
  const { citySlug, occupationSlug } = useParams<{ citySlug: string; occupationSlug: string }>();
  const navigate = useNavigate();
  const city = citySlug ? CITY_BY_SLUG[citySlug] : null;
  const occ = occupationSlug ? OCCUPATION_BY_SLUG[occupationSlug] : null;

  useEffect(() => {
    syncBrowserChrome(window.location.pathname);
  }, []);

  if (!city || !occ) return <Navigate to="/jobb" replace />;

  const canonical = `${BASE}/jobb/${city.slug}/${occ.slug}`;
  const title = `Lediga jobb ${occ.asForm} ${city.inForm} – sök ${occ.plural}jobb | Parium`;
  const description = `Hitta lediga jobb ${occ.asForm} ${city.inForm}. Se vanliga arbetsuppgifter, krav och lön. Skapa profil gratis i Parium och matcha med arbetsgivare ${city.inForm} på sekunder.`;

  // Andra yrken i samma stad (cross-link)
  const otherOccs = OCCUPATIONS.filter((o) => o.slug !== occ.slug).slice(0, 6);
  // Samma yrke i andra städer
  const otherCities = CITIES.filter((c) => c.slug !== city.slug).slice(0, 6);

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
    occupationLocation: { '@type': 'City', name: city.name, address: { '@type': 'PostalAddress', addressCountry: 'SE', addressLocality: city.name, addressRegion: city.county } },
    estimatedSalary: { '@type': 'MonetaryAmountDistribution', name: 'baseSalary', currency: 'SEK', duration: 'P1M' },
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

      <div className="min-h-screen bg-[hsl(215_100%_12%)] text-white">
        <LandingNav onLoginClick={() => navigate('/auth')} />

        {/* Hero */}
        <section className="relative overflow-hidden px-5 pt-28 pb-16 sm:px-8 md:px-12">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-60"
            style={{
              background:
                'radial-gradient(70% 60% at 50% 0%, rgba(70,130,255,0.30) 0%, rgba(70,130,255,0) 70%)',
            }}
          />
          <div className="mx-auto max-w-4xl text-center">
            <nav aria-label="Brödsmulor" className="mb-4 text-xs text-white/60">
              <Link to="/jobb" className="hover:text-white/90">Jobb</Link>
              <span className="mx-1.5">/</span>
              <Link to={`/jobb/${city.slug}`} className="hover:text-white/90">{city.name}</Link>
              <span className="mx-1.5">/</span>
              <span className="text-white/80">{occ.name}</span>
            </nav>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-medium tracking-wide text-white/80 backdrop-blur">
              <MapPin className="h-3.5 w-3.5" /> {city.name} · {occ.category}
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Lediga jobb {occ.asForm} {city.inForm}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 sm:text-xl">
              {occ.intro} I {city.name} matchar Parium dig direkt med arbetsgivare som söker {occ.plural}.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => navigate('/auth')}
                className="min-h-12 rounded-full bg-white text-[hsl(215_100%_12%)] hover:bg-white/90 px-8 text-base font-semibold"
              >
                Skapa profil gratis
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate(`/jobb/${city.slug}`)}
                className="min-h-12 rounded-full border-white/30 bg-white/5 text-white hover:bg-white/10 px-7"
              >
                Alla jobb {city.inForm}
              </Button>
            </div>
          </div>
        </section>

        {/* Arbetsuppgifter + krav */}
        <section className="px-5 py-16 sm:px-8 md:px-12">
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-7 backdrop-blur-md">
              <h2 className="text-2xl font-semibold tracking-tight">
                Arbetsuppgifter {occ.asForm} {city.inForm}
              </h2>
              <ul className="mt-5 space-y-3">
                {occ.tasks.map((task) => (
                  <li key={task} className="flex items-start gap-3 text-white/85">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-white/70" />
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-7 backdrop-blur-md">
              <h2 className="text-2xl font-semibold tracking-tight">
                Krav & kompetens
              </h2>
              <ul className="mt-5 space-y-3">
                {occ.skills.map((skill) => (
                  <li key={skill} className="flex items-start gap-3 text-white/85">
                    <Zap className="mt-0.5 h-5 w-5 flex-shrink-0 text-white/70" />
                    <span>{skill}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mx-auto mt-6 max-w-5xl rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-white/80 backdrop-blur-md">
            <strong className="text-white">Lön {city.inForm}: </strong>
            {occ.salary}
          </div>
        </section>

        {/* Områden i staden */}
        <section className="px-5 py-12 sm:px-8 md:px-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Populära områden för jobb {occ.asForm} {city.inForm}
            </h2>
            <ul className="mt-8 flex flex-wrap justify-center gap-2">
              {city.areas.map((area) => (
                <li
                  key={area}
                  className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/85 backdrop-blur-md"
                >
                  {area}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Andra yrken i staden */}
        <section className="px-5 py-12 sm:px-8 md:px-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Andra lediga jobb {city.inForm}
            </h2>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {otherOccs.map((o) => (
                <li key={o.slug}>
                  <Link
                    to={`/jobb/${city.slug}/${o.slug}`}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-md px-4 py-4 text-sm font-medium text-white/90 hover:bg-white/10 transition"
                  >
                    <Briefcase className="h-4 w-4 text-white/60" />
                    {o.name} {city.inForm}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Samma yrke i andra städer */}
        <section className="px-5 py-12 sm:px-8 md:px-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              {occ.name}jobb i andra städer
            </h2>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {otherCities.map((c) => (
                <li key={c.slug}>
                  <Link
                    to={`/jobb/${c.slug}/${occ.slug}`}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-md px-4 py-4 text-sm font-medium text-white/90 hover:bg-white/10 transition"
                  >
                    <MapPin className="h-4 w-4 text-white/60" />
                    {occ.name} i {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-5 py-16 sm:px-8 md:px-12">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
              Vanliga frågor – jobb {occ.asForm} {city.inForm}
            </h2>
            <div className="mt-10 space-y-4">
              {faqs.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-md"
                >
                  <summary className="cursor-pointer list-none text-lg font-medium text-white">
                    {f.q}
                  </summary>
                  <p className="mt-3 text-white/80">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 py-20 sm:px-8 md:px-12">
          <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-white/[0.08] backdrop-blur-md p-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Sök jobb {occ.asForm} {city.inForm} idag
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/80">
              Skapa profil gratis. Matcha med arbetsgivare {city.inForm} på sekunder.
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
    </>
  );
};

export default JobbCityYrke;
