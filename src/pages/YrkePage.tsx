import { useEffect } from 'react';
import { Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import LandingNav from '@/components/LandingNav';
import FaqAccordion from '@/components/seo/FaqAccordion';
import SeoBubbles from '@/components/seo/SeoBubbles';
import SeoBackButton from '@/components/seo/SeoBackButton';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { Button } from '@/components/ui/button';
import SeoCTAButton from '@/components/seo/SeoCTAButton';
import { ArrowRight, Briefcase, CheckCircle2, MapPin, Zap } from 'lucide-react';
import { OCCUPATION_BY_SLUG } from '@/data/jobOccupations';
import { CITIES } from '@/data/jobCities';
import { persistIntent as persistSavedSearchIntent } from '@/lib/savedSearchIntent';
import { buildGenericOccupation } from '@/lib/genericOccupation';


const BASE = 'https://parium.se';

const YrkePage = () => {
  const { occupationSlug } = useParams<{ occupationSlug: string }>();
  const navigate = useNavigate();
  const occ = occupationSlug
    ? OCCUPATION_BY_SLUG[occupationSlug] || buildGenericOccupation(occupationSlug)
    : null;

  useEffect(() => {
    syncBrowserChrome(window.location.pathname);
    window.scrollTo(0, 0);
  }, [occupationSlug]);

  if (!occ) return <Navigate to="/yrken" replace />;

  const canonical = `${BASE}/yrke/${occ.slug}`;
  const title = `Lediga jobb ${occ.asForm} – sök ${occ.plural}jobb med Parium`;
  const description = `Hitta lediga jobb ${occ.asForm} i hela Sverige. Se vanliga arbetsuppgifter, krav och lön. Skapa min profil idag i Parium och matcha direkt med arbetsgivare.`;

  // Top 5 städer för cross-linking
  const topCities = CITIES.slice(0, 5);

  const faqs = [
    {
      q: `Vad gör en ${occ.name.toLowerCase()}?`,
      a: `En ${occ.name.toLowerCase()} arbetar bland annat med ${occ.tasks.slice(0, 3).join(', ').toLowerCase()}.`,
    },
    {
      q: `Vad krävs för att jobba ${occ.asForm}?`,
      a: occ.skills.slice(0, 3).join(' '),
    },
    {
      q: `Vad tjänar en ${occ.name.toLowerCase()} i Sverige?`,
      a: occ.salary,
    },
    {
      q: `Hur hittar jag lediga jobb ${occ.asForm}?`,
      a: `Skapa en kostnadsfri profil i Parium, välj ${occ.name} som yrke och din ort. Lediga jobb ${occ.asForm} visas.`,
    },
    {
      q: `Hur snabbt kan jag få svar från arbetsgivare?`,
      a: `När en arbetsgivare visar ett intresse för din profil kan arbetsgivaren öppna en chatt mellan er. Många kandidater får återkoppling inom 24 timmar.`,
    },
    {
      q: `Är Parium gratis att använda?`,
      a: `Ja. Att skapa profil, söka till olika arbetsgivare och chatta är helt gratis.`,
    },
  ];

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Parium', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Yrken', item: `${BASE}/yrken` },
      { '@type': 'ListItem', position: 3, name: occ.name, item: canonical },
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
    name: occ.name,
    occupationLocation: { '@type': 'Country', name: 'Sverige' },
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

      <div className="seo-scroll-page pb-16 bg-[hsl(215_100%_12%)] bg-parium-gradient text-white">
        <LandingNav onLoginClick={() => navigate('/auth')} />
        <SeoBackButton fallback="/yrken" />


        {/* Hero */}
        <section className="relative overflow-hidden px-5 pt-28 pb-16 sm:px-8 md:px-12">
          <SeoBubbles />
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-medium tracking-wide text-white">
              <Briefcase className="h-3.5 w-3.5" /> {occ.category}
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-white">
              Lediga jobb <span className="text-white">{occ.asForm}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white sm:text-xl">{occ.intro}</p>
            <div className="mt-10 flex justify-center">
              <Button
                size="lg"
                onClick={() => {
                  persistSavedSearchIntent({
                    occupation: occ.name,
                    occupationSlug: occ.slug,
                    returnTo: '/search-jobs',
                  });
                  navigate('/auth', { state: { mode: 'signup' } });
                }}
                className="min-h-12 rounded-full bg-secondary text-white md:hover:bg-secondary px-8 text-base font-semibold"
              >
                Skapa min profil idag
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>

          </div>
        </section>

        {/* Arbetsuppgifter + krav */}
        <section className="px-5 py-16 sm:px-8 md:px-12">
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-7">
              <h2 className="text-2xl font-semibold tracking-tight">
                Vanliga arbetsuppgifter {occ.asForm}
              </h2>
              <ul className="mt-5 space-y-3">
                {occ.tasks.map((task) => (
                  <li key={task} className="flex items-start gap-3 text-white">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-white" />
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-7">
              <h2 className="text-2xl font-semibold tracking-tight">
                Vad krävs för att jobba {occ.asForm}?
              </h2>
              <ul className="mt-5 space-y-3">
                {occ.skills.map((skill) => (
                  <li key={skill} className="flex items-start gap-3 text-white">
                    <Zap className="mt-0.5 h-5 w-5 flex-shrink-0 text-white" />
                    <span>{skill}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mx-auto mt-6 max-w-5xl rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-white">
            <strong className="text-white">Lön: </strong>
            {occ.salary}
          </div>
        </section>

        {/* Lediga jobb per stad - internal linking */}
        <section className="px-5 py-16 sm:px-8 md:px-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
              Lediga jobb {occ.asForm} per stad
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-white">
              Sök jobb {occ.asForm} där du bor – Parium finns i hela Sverige.
            </p>
            <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {topCities.map((c) => (
                <li key={c.slug}>
                  <Link
                    to={`/jobb/${c.slug}`}
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-4 text-center text-sm font-medium text-white hover:bg-white/10 transition"
                  >
                    <MapPin className="h-4 w-4 text-white" />
                    Jobb i {c.name}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-center text-white text-sm">
              <Link to="/jobb" className="underline-offset-4 hover:underline">
                Se alla städer →
              </Link>
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-5 py-16 sm:px-8 md:px-12">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
              Vanliga frågor om jobb {occ.asForm}
            </h2>
            <div className="mt-10 space-y-3">
              {faqs.map((f) => (
                <FaqAccordion key={f.q} q={f.q} a={f.a} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 py-20 sm:px-8 md:px-12">
          <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-white/[0.08] p-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Sök ditt nästa jobb {occ.asForm} idag
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white">
              Skapa min profil idag. Inga oändliga ansökningar – bara jobb som passar dig.
            </p>
            <Button
              size="lg"
              onClick={() => {
                persistSavedSearchIntent({
                  occupation: occ.name,
                  occupationSlug: occ.slug,
                  returnTo: '/search-jobs',
                });
                navigate('/auth', { state: { mode: 'signup' } });
              }}
              className="mt-8 min-h-11 rounded-full bg-secondary text-white md:hover:bg-secondary px-7"
            >
              Skapa min profil idag
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>

          </div>
        </section>
        
      </div>
    </>
  );
};

export default YrkePage;
