 import { useEffect, useState } from 'react';
 import { Link, useParams, useNavigate, Navigate } from 'react-router-dom';
 import { Helmet } from 'react-helmet-async';
 import { motion } from 'framer-motion';
 import { supabase } from '@/integrations/supabase/client';
 import LandingNav from '@/components/LandingNav';
 import MobileStickyCTA from '@/components/seo/MobileStickyCTA';
import { Button } from '@/components/ui/button';
import SeoCTAButton from '@/components/seo/SeoCTAButton';
import SeoBubbles from '@/components/seo/SeoBubbles';
 import { syncBrowserChrome } from '@/lib/browserChrome';
 import { ArrowRight, MapPin, Briefcase, Clock, Building2, Loader2 } from 'lucide-react';
 import { CITIES } from '@/data/jobCities';
 import { useAuth } from '@/hooks/useAuth';
 import { setPendingJob } from '@/lib/pendingJobIntent';
 import { persistIntent as persistSavedSearchIntent } from '@/lib/savedSearchIntent';
 import { OCCUPATIONS } from '@/data/jobOccupations';
 

const BASE = 'https://parium.se';

type Job = {
  id: string;
  title: string;
  description: string | null;
  requirements: string | null;
  location: string | null;
  occupation: string | null;
  employment_type: string | null;
  work_schedule: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_type: string | null;
  workplace_city: string | null;
  workplace_county: string | null;
  workplace_postal_code: string | null;
  workplace_address: string | null;
  workplace_name: string | null;
  company_logo_url: string | null;
  job_image_url: string | null;
  benefits: string[] | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  positions_count: number | null;
  remote_work_possible: string | null;
  work_location_type: string | null;
};

const slugify = (s: string) =>
  s.toLowerCase()
    .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const PublicJobPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Vid utgången annons: titel + yrke från arkiverad rad (utan is_active-filter).
  const [expiredCtx, setExpiredCtx] = useState<{ title?: string; occupation?: string } | null>(null);

  useEffect(() => { syncBrowserChrome(window.location.pathname); }, []);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('job_postings')
        .select('id,title,description,requirements,location,occupation,employment_type,work_schedule,salary_min,salary_max,salary_type,workplace_city,workplace_county,workplace_postal_code,workplace_address,workplace_name,company_logo_url,job_image_url,benefits,created_at,expires_at,is_active,positions_count,remote_work_possible,work_location_type')
        .eq('id', jobId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        // Sekundär hämtning utan is_active för att ge kontext om jobbet är tillsatt.
        const { data: expired } = await supabase
          .from('job_postings')
          .select('title,occupation')
          .eq('id', jobId)
          .maybeSingle();
        if (!cancelled && expired) {
          setExpiredCtx({ title: expired.title || undefined, occupation: expired.occupation || undefined });
        }
        setNotFound(true);
        setLoading(false);
        return;
      }
      setJob(data as Job);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  // Slussar till Ansök — om utloggad: parkera intent och gå via /auth.
  const goApply = (id: string) => {
    if (!user) {
      setPendingJob({ jobId: id, action: 'apply' });
      navigate('/auth', { state: { mode: 'signup' } });
      return;
    }
    navigate(`/job-application/${id}`);
  };


  if (!jobId) return <Navigate to="/jobb" replace />;

  if (loading) {
    return (
      <div className="seo-scroll-page bg-[hsl(215_100%_12%)] text-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin opacity-60" />
      </div>
    );
  }

  if (notFound || !job) {
    const fallbackCities = CITIES.slice(0, 8);
    // Försök matcha utgånget jobb till ett yrke i vår taxonomi.
    const occMatch = (() => {
      if (!expiredCtx?.occupation && !expiredCtx?.title) return null;
      const needle = (expiredCtx.occupation || expiredCtx.title || '').toLowerCase();
      return (
        OCCUPATIONS.find(o =>
          needle.includes(o.name.toLowerCase()) ||
          needle.includes(o.slug.toLowerCase())
        ) || null
      );
    })();
    const ctxOccName = occMatch?.name || expiredCtx?.occupation || null;
    const ctxOccSlug = occMatch?.slug || null;

    const headline = ctxOccName
      ? `Tyvärr — det här ${ctxOccName.toLowerCase()}-jobbet är tillsatt`
      : 'Tyvärr har annonsen utgått';
    const subline = ctxOccName
      ? `Den här annonsen är inte längre aktiv. Men det finns fler ${ctxOccName.toLowerCase()}-jobb runt om i Sverige.`
      : 'Den här jobbannonsen är inte längre aktiv.';

    const goSearchInCity = (cityName: string, citySlug: string) => {
      // Parkera sök-intent så app-läget öppnar med yrket + staden förifyllt
      // efter login + ev. välkomsttunnel.
      if (ctxOccName) {
        persistSavedSearchIntent({
          city: cityName,
          citySlug,
          occupation: ctxOccName,
          occupationSlug: ctxOccSlug || undefined,
          returnTo: ctxOccSlug ? `/jobb/${citySlug}/${ctxOccSlug}` : `/jobb/${citySlug}`,
        });
      }
      if (ctxOccSlug) {
        navigate(`/jobb/${citySlug}/${ctxOccSlug}`);
      } else {
        navigate(`/jobb/${citySlug}`);
      }
    };

    return (
      <div className="seo-scroll-page bg-[hsl(215_100%_12%)] bg-parium-gradient text-white">
        {/* Signalerar till Google: avindexera URL men följ länkar vidare. */}
        <Helmet>
          <title>{ctxOccName ? `${ctxOccName}-jobb tillsatt | Parium` : 'Tyvärr har annonsen utgått | Parium'}</title>
          <meta name="description" content={ctxOccName
            ? `Det här ${ctxOccName.toLowerCase()}-jobbet är tillsatt. Hitta fler ${ctxOccName.toLowerCase()}-jobb i din stad på Parium.`
            : 'Den här jobbannonsen har gått ut. Upptäck nya lediga jobb i hela Sverige på Parium.'} />
          <meta name="robots" content="noindex,follow" />
          <link rel="canonical" href={ctxOccSlug ? `${BASE}/yrke/${ctxOccSlug}` : `${BASE}/jobb`} />
        </Helmet>
        <LandingNav onLoginClick={() => navigate("/auth")} />
        <main className="relative overflow-hidden max-w-2xl mx-auto px-6 pt-32 pb-24 text-center">
          <SeoBubbles />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 border border-white/10 mb-6">
              <Clock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4 text-white">
              {headline}
            </h1>
            <p className="text-white text-base sm:text-lg mb-10 leading-relaxed">
              {subline}
            </p>
            {ctxOccName && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 backdrop-blur-md px-4 py-2 mb-8 text-sm text-white">
                <Briefcase className="w-4 h-4" />
                Söker just nu: <strong className="font-semibold">{ctxOccName}</strong>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
              <SeoCTAButton
                label={ctxOccName ? `Se alla ${ctxOccName.toLowerCase()}-jobb` : 'Bläddra lediga jobb'}
                to={ctxOccSlug ? `/yrke/${ctxOccSlug}` : '/jobb'}
                variant="primary"
              />
              <SeoCTAButton
                label="Skapa min profil idag"
                to="/auth"
                navState={{ mode: 'signup' }}
                variant="ghost"
              />
            </div>
            <section className="border-t border-white/10 pt-8 text-left">
              <h2 className="text-sm font-semibold text-white mb-4 text-center uppercase tracking-wider">
                {ctxOccName ? `Välj stad för ${ctxOccName.toLowerCase()}-jobb` : 'Hitta jobb i en stad nära dig'}
              </h2>
              <div className="flex flex-wrap gap-2 justify-start">
                {fallbackCities.map(c => (
                  <button
                    key={c.slug}
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); goSearchInCity(c.name, c.slug); }}
                    onClick={(e) => e.preventDefault()}
                    className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition min-h-[36px]"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    {ctxOccName ? `${ctxOccName} ${c.inForm || 'i ' + c.name}` : `Jobb i ${c.name}`}
                  </button>
                ))}
              </div>
            </section>
          </motion.div>
        </main>
      </div>
    );
  }


  const city = job.workplace_city || job.location || 'Sverige';
  const company = job.workplace_name || 'Arbetsgivare';
  const canonical = `${BASE}/annons/${job.id}`;
  const title = `${job.title} – ${city} | Parium`;
  const rawDesc = (job.description || '').replace(/\s+/g, ' ').trim();
  const description = (rawDesc.slice(0, 155) || `Lediga jobb som ${job.title} ${city ? 'i ' + city : ''}. Ansök direkt i Parium-appen.`).slice(0, 158);

  const employmentTypeMap: Record<string, string> = {
    'Heltid': 'FULL_TIME', 'Deltid': 'PART_TIME', 'Tillsvidare': 'FULL_TIME',
    'Visstid': 'TEMPORARY', 'Sommarjobb': 'TEMPORARY', 'Konsult': 'CONTRACTOR',
    'Praktik': 'INTERN', 'Volontär': 'VOLUNTEER',
  };
  const employmentTypeLD = employmentTypeMap[job.employment_type || ''] || 'OTHER';

  const validThrough = job.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const jobLD: any = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: rawDesc || `${job.title} hos ${company} i ${city}.`,
    datePosted: job.created_at,
    validThrough,
    employmentType: employmentTypeLD,
    hiringOrganization: {
      '@type': 'Organization',
      name: company,
      ...(job.company_logo_url ? { logo: job.company_logo_url } : {}),
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(job.workplace_address ? { streetAddress: job.workplace_address } : {}),
        addressLocality: city,
        ...(job.workplace_postal_code ? { postalCode: job.workplace_postal_code } : {}),
        ...(job.workplace_county ? { addressRegion: job.workplace_county } : {}),
        addressCountry: 'SE',
      },
    },
    ...(job.remote_work_possible === 'yes' || job.work_location_type === 'remote'
      ? { jobLocationType: 'TELECOMMUTE', applicantLocationRequirements: { '@type': 'Country', name: 'SE' } }
      : {}),
    ...(job.salary_min || job.salary_max
      ? {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: 'SEK',
            value: {
              '@type': 'QuantitativeValue',
              ...(job.salary_min ? { minValue: job.salary_min } : {}),
              ...(job.salary_max ? { maxValue: job.salary_max } : {}),
              unitText: (job.salary_type || '').toLowerCase().includes('tim') ? 'HOUR' : 'MONTH',
            },
          },
        }
      : {}),
    ...(job.positions_count && job.positions_count > 1 ? { totalJobOpenings: job.positions_count } : {}),
    directApply: true,
    url: canonical,
  };

  const breadcrumbLD = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Hem', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Lediga jobb', item: `${BASE}/jobb` },
      { '@type': 'ListItem', position: 3, name: `Jobb i ${city}`, item: `${BASE}/jobb/${slugify(city)}` },
      { '@type': 'ListItem', position: 4, name: job.title, item: canonical },
    ],
  };

  const ogImage = job.job_image_url || job.company_logo_url;

  const similarCities = CITIES.filter(c => c.slug !== slugify(city)).slice(0, 6);

  return (
    <div className="seo-scroll-page pb-28 md:pb-0 bg-[hsl(215_100%_12%)] text-white">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={job.title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta name="robots" content="index,follow,max-image-preview:large" />
        <script type="application/ld+json">{JSON.stringify(jobLD)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLD)}</script>
      </Helmet>

      <LandingNav onLoginClick={() => navigate("/auth")} />

      <main className="max-w-3xl mx-auto px-6 pt-28 pb-24">
        <nav className="text-sm text-white/50 mb-6 flex items-center gap-2 flex-wrap" aria-label="Brödsmulor">
          <Link to="/" className="hover:text-white/80">Hem</Link>
          <span>/</span>
          <Link to="/jobb" className="hover:text-white/80">Jobb</Link>
          <span>/</span>
          <Link to={`/jobb/${slugify(city)}`} className="hover:text-white/80">{city}</Link>
          <span>/</span>
          <span className="text-white/80 truncate">{job.title}</span>
        </nav>

        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">{job.title}</h1>
          <div className="flex flex-wrap gap-3 text-white/70 text-sm">
            <span className="inline-flex items-center gap-1.5"><Building2 className="w-4 h-4" />{company}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{city}</span>
            {job.employment_type && (
              <span className="inline-flex items-center gap-1.5"><Briefcase className="w-4 h-4" />{job.employment_type}</span>
            )}
            {job.work_schedule && (
              <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4" />{job.work_schedule}</span>
            )}
          </div>
        </motion.header>

        <div className="flex flex-col sm:flex-row gap-3 mb-12">
          <Button
            onClick={() => goApply(job.id)}
            className="bg-secondary text-white hover:bg-secondary/90 rounded-full min-h-12 px-7 text-base font-medium"
          >
            Ansök nu
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            variant="outline"
            asChild
            className="border-white/15 bg-white/5 text-white hover:bg-white/10 rounded-full min-h-12 px-7"
          >
            <Link to="/jobb">Se fler jobb</Link>
          </Button>
        </div>


        {job.description && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold mb-4">Om jobbet</h2>
            <div className="text-white/80 leading-relaxed whitespace-pre-line">
              {job.description}
            </div>
          </section>
        )}

        {job.requirements && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold mb-4">Kvalifikationer</h2>
            <div className="text-white/80 leading-relaxed whitespace-pre-line">
              {job.requirements}
            </div>
          </section>
        )}

        {job.benefits && job.benefits.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold mb-4">Förmåner</h2>
            <ul className="flex flex-wrap gap-2">
              {job.benefits.map((b, i) => (
                <li key={i} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/80">{b}</li>
              ))}
            </ul>
          </section>
        )}

        {(job.salary_min || job.salary_max) && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold mb-4">Lön</h2>
            <p className="text-white/80">
              {job.salary_min && job.salary_max
                ? `${job.salary_min.toLocaleString('sv-SE')} – ${job.salary_max.toLocaleString('sv-SE')} kr`
                : job.salary_min
                  ? `Från ${job.salary_min.toLocaleString('sv-SE')} kr`
                  : `Upp till ${job.salary_max!.toLocaleString('sv-SE')} kr`}
              {job.salary_type ? ` (${job.salary_type})` : ''}
            </p>
          </section>
        )}

        <section className="mb-12 p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/10">
          <h2 className="text-xl font-semibold mb-2">Ansök direkt i Parium</h2>
          <p className="text-white/70 mb-4">Skapa profil på under en minut. Chatta direkt med arbetsgivaren och få snabbare svar.</p>
          <Button
            onClick={() => goApply(job.id)}
            className="bg-secondary text-white hover:bg-secondary/90 rounded-full min-h-12 px-7"
          >
            Skicka ansökan <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

        </section>

        <section className="border-t border-white/10 pt-10">
          <h2 className="text-lg font-semibold mb-4">Lediga jobb i andra städer</h2>
          <div className="flex flex-wrap gap-2">
            {similarCities.map(c => (
              <Link
                key={c.slug}
                to={`/jobb/${c.slug}`}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/80 hover:bg-white/10 transition"
              >
                Jobb i {c.name}
              </Link>
            ))}
          </div>
        </section>
      </main>
      <MobileStickyCTA
        label={user ? 'Skicka ansökan' : 'Skapa profil & ansök'}
        to={user ? `/job-application/${job.id}` : '/auth'}
        onBeforeNavigate={() => { if (!user) setPendingJob({ jobId: job.id, action: 'apply' }); }}
      />

    </div>
  );
};

export default PublicJobPage;
