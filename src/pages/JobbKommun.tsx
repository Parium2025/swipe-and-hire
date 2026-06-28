import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import SiteFooter from '@/components/landing/SiteFooter';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import LandingNav from '@/components/LandingNav';
import SeoCTAButton from '@/components/seo/SeoCTAButton';
import FaqAccordion from '@/components/seo/FaqAccordion';
import SeoBubbles from '@/components/seo/SeoBubbles';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Briefcase, Building2, Search, Zap, MessageSquare } from 'lucide-react';
import { KOMMUNER, KOMMUN_BY_SLUG } from '@/data/jobMunicipalities';
import { CITY_BY_SLUG } from '@/data/jobCities';
import { persistIntent as persistSavedSearchIntent } from '@/lib/savedSearchIntent';

type PublicJobRow = {
  id: string;
  title: string;
  workplace_city: string | null;
  workplace_name: string | null;
  employment_type: string | null;
};

const BASE = 'https://parium.se';

const JobbKommun = () => {
  const { kommunSlug } = useParams<{ kommunSlug: string }>();
  const navigate = useNavigate();
  const kommun = kommunSlug ? KOMMUN_BY_SLUG[kommunSlug] : null;
  const [jobs, setJobs] = useState<PublicJobRow[]>([]);

  useEffect(() => {
    syncBrowserChrome(window.location.pathname);
    window.scrollTo(0, 0);
  }, [kommunSlug]);

  useEffect(() => {
    if (!kommun) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('job_postings')
        .select('id,title,workplace_city,workplace_name,employment_type')
        .eq('is_active', true)
        .is('deleted_at', null)
        .ilike('workplace_city', `%${kommun.name}%`)
        .order('created_at', { ascending: false })
        .limit(6);
      if (!cancelled) setJobs((data as PublicJobRow[]) || []);
    })();
    return () => { cancelled = true; };
  }, [kommun]);

  if (!kommun) return <Navigate to="/kommuner" replace />;

  // Om denna kommun också finns som "stad" (Stockholm, Göteborg…), länka över
  // så vi inte konkurrerar med oss själva.
  const cityCounterpart = CITY_BY_SLUG[kommun.slug];

  const canonical = `${BASE}/kommun/${kommun.slug}`;
  const title = `Lediga jobb i ${kommun.name} kommun – sök jobb med Parium`;
  const description = `Hitta lediga jobb i ${kommun.name} kommun (${kommun.county}). Skapa en gratis profil i Parium och bli matchad med arbetsgivare i ${kommun.name}.`;

  const intentBase = {
    city: kommun.name,
    citySlug: kommun.slug,
    returnTo: '/search-jobs',
  } as const;

  const faqs = [
    {
      q: `Hur hittar jag lediga jobb i ${kommun.name} kommun?`,
      a: `Skapa en kostnadsfri profil i Parium, ange ${kommun.name} som plats och vilka yrken du är intresserad av. Lediga jobb i ${kommun.name} kommun visas.`,
    },
    {
      q: `Är Parium gratis för jobbsökare i ${kommun.name}?`,
      a: `Ja. Att skapa profil, söka till olika arbetsgivare i ${kommun.name} kommun och chatta är helt gratis.`,
    },
    {
      q: `Vilka typer av jobb finns i ${kommun.name} kommun?`,
      a: `Det finns lediga jobb i ${kommun.name} kommun inom vård, handel, restaurang, lager, bygg, transport, kontor och offentlig sektor – både heltid, deltid och extrajobb.`,
    },
    {
      q: `Hur snabbt kan jag få svar från arbetsgivare i ${kommun.name}?`,
      a: `När en arbetsgivare visar ett intresse för din profil kan arbetsgivaren öppna en chatt mellan er. Många kandidater i ${kommun.name} kommun får återkoppling inom 24 timmar.`,
    },
    {
      q: `Kan jag söka extrajobb i ${kommun.name}?`,
      a: `Absolut. Du kan filtrera på anställningsform – heltid, deltid, timanställning, extrajobb eller Lärande i praktik (LIA) i ${kommun.name} kommun.`,
    },
    {
      q: `Vad ingår i ${kommun.county}?`,
      a: `${kommun.county} består av flera kommuner. På Parium kan du söka jobb i alla – från storstad till mindre orter.`,
    },
  ];

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Parium', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Kommuner', item: `${BASE}/kommuner` },
      { '@type': 'ListItem', position: 3, name: `${kommun.name} kommun`, item: canonical },
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

  // ItemList över jobb i kommunen — matchar JobbCity för konsekvent SEO.
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Lediga jobb i ${kommun.name} kommun`,
    itemListElement: jobs.slice(0, 25).map((j, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${BASE}/annons/${j.id}`,
      name: j.title,
    })),
  };

  const displayedJobs = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    company: job.workplace_name || 'Arbetsgivare',
    type: job.employment_type || 'Jobb',
    location: job.workplace_city || kommun.name,
  }));

  // Andra kommuner i samma län (intern länkning)
  const sameCounty = KOMMUNER
    .filter((k) => k.county === kommun.county && k.slug !== kommun.slug)
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'));

  return (
    <div data-seo-scroll-root className="seo-scroll-page bg-[hsl(215_100%_12%)] bg-parium-gradient text-white">
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
      <section className="relative overflow-hidden px-5 pt-32 pb-16 sm:px-8 sm:pt-40 sm:pb-24 md:px-12">
        <SeoBubbles />
        <div className="mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium border border-white/15"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {kommun.county}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl"
          >
            Lediga jobb i {kommun.name} kommun
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white sm:text-xl"
          >
            Skapa en gratis profil och se lediga jobb i {kommun.name}. Parium finns i hela {kommun.county} – från storstad till mindre orter.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <SeoCTAButton
              label="Skapa min profil idag"
              onClick={() => {
                persistSavedSearchIntent(intentBase);
                navigate('/auth', { state: { mode: 'signup' } });
              }}
            />
            <SeoCTAButton
              variant="ghost"
              showArrow={false}
              label="Bevaka denna sökning"
              onClick={() => {
                persistSavedSearchIntent(intentBase);
                navigate('/auth', { state: { mode: 'signup' } });
              }}
            />
          </motion.div>

          {cityCounterpart && cityCounterpart.name.toLowerCase() !== kommun.name.toLowerCase() && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.18 }}
              className="mt-8 text-sm text-white"
            >
              Söker du jobb mer specifikt i centralorten?{' '}
              <Link to={`/jobb/${cityCounterpart.slug}`} className="underline underline-offset-4 hover:text-white">
                Se lediga jobb i {cityCounterpart.name} →
              </Link>
            </motion.p>
          )}
        </div>
      </section>

      {/* Aktiva jobb i kommunen (DB-data) */}
      {jobs.length > 0 && (
        <section className="px-5 pb-12 sm:px-8 md:px-12">
          <div className="mx-auto max-w-5xl">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl text-white">
                Lediga jobb i {kommun.name} just nu
              </h2>
              <p className="mt-2 text-sm text-white">Riktiga annonser som går att öppna direkt.</p>
            </div>
            <ul className="grid gap-3 md:grid-cols-3">
              {displayedJobs.map((job) => (
                <li key={job.id}>
                  <button
                    type="button"
                    onPointerDown={() => navigate(`/annons/${job.id}`)}
                    className="group flex min-h-[150px] w-full flex-col justify-between rounded-2xl border border-white/15 bg-white/[0.07] p-5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition-colors hover:bg-white/[0.10]"
                  >
                    <div>
                      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                        <Briefcase className="h-5 w-5 text-white" aria-hidden="true" />
                      </div>
                      <h3 className="text-lg font-semibold leading-snug text-white">{job.title}</h3>
                    </div>
                    <div className="mt-5 space-y-2 text-sm text-white">
                      <p className="flex items-center gap-2"><Building2 className="h-4 w-4 text-white" aria-hidden="true" />{job.company}</p>
                      <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-white" aria-hidden="true" />{job.location} · {job.type}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Så fungerar det */}
      <section className="px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Så hittar du jobb i {kommun.name} kommun med Parium
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icon: Search, title: 'Skapa profil', body: `Ange ${kommun.name} som plats och vilka yrken du vill jobba inom. Gratis och tar någon minut.` },
              { icon: Zap, title: 'Sök jobb', body: `Parium visar lediga jobb i ${kommun.name} kommun som passar din profil.` },
              { icon: MessageSquare, title: 'Chatta i appen', body: 'När en arbetsgivare matchar med dig kan ni chatta i appen.' },
            ].map(({ icon: Icon, title: t, body }) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-white/[0.06] p-6">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 mb-4">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Andra kommuner i samma län */}
      {sameCounty.length > 0 && (
        <section className="px-5 py-16 sm:px-8 md:px-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Andra kommuner i {kommun.county}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-white">
              Sök jobb i grannkommunerna – Parium täcker hela länet.
            </p>
            <ul className="mt-8 flex flex-wrap justify-center gap-2">
              {sameCounty.map((k) => (
                <li
                  key={k.slug}
                  className="basis-[calc(50%-0.25rem)] sm:basis-[calc(33.333%-0.333rem)] md:basis-[calc(25%-0.375rem)]"
                >
                  <Link
                    to={`/kommun/${k.slug}`}
                    className="flex h-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-center text-sm font-medium text-white hover:bg-white/10 transition"
                  >
                    <MapPin className="h-4 w-4 text-white" aria-hidden="true" />
                    {k.name}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-center text-sm text-white">
              <Link to="/kommuner" className="underline-offset-4 hover:underline">
                Se alla Sveriges kommuner →
              </Link>
            </p>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Vanliga frågor om jobb i {kommun.name} kommun
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
            Redo att hitta ditt nästa jobb i {kommun.name} kommun?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white">
            Skapa min profil idag och sök lediga jobb i {kommun.name} kommun.
          </p>
          <div className="mt-7 flex justify-center">
            <SeoCTAButton
              label="Skapa min profil idag"
              onClick={() => {
                persistSavedSearchIntent(intentBase);
                navigate('/auth', { state: { mode: 'signup' } });
              }}
            />
          </div>
        </div>
      </section>
    <SiteFooter />
    </div>
  );
};

export default JobbKommun;
