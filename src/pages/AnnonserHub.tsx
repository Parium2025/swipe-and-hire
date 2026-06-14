import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import LandingNav from '@/components/LandingNav';
import MobileStickyCTA from '@/components/seo/MobileStickyCTA';
import SeoCTAButton from '@/components/seo/SeoCTAButton';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { ArrowRight, MapPin, Briefcase, Loader2 } from 'lucide-react';
import { CITIES } from '@/data/jobCities';
import { OCCUPATIONS } from '@/data/jobOccupations';

const BASE = 'https://parium.se';

type JobRow = {
  id: string;
  title: string;
  workplace_city: string | null;
  workplace_name: string | null;
  employment_type: string | null;
  created_at: string;
};

const AnnonserHub = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { syncBrowserChrome(window.location.pathname); }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('job_postings')
        .select('id,title,workplace_city,workplace_name,employment_type,created_at')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(60);
      setJobs((data as JobRow[]) || []);
      setLoading(false);
    })();
  }, []);

  const canonical = `${BASE}/annonser`;
  const title = 'Senaste lediga jobben i Sverige – uppdaterat dagligen | Parium';
  const description = 'Bläddra senaste lediga jobben i Sverige. Nya annonser dagligen från hela landet. Ansök direkt i Parium-appen – snabbare än traditionella jobbsajter.';

  const itemListLD = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: jobs.slice(0, 30).map((j, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${BASE}/annons/${j.id}`,
      name: j.title,
    })),
  };

  const breadcrumbLD = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Hem', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Lediga jobb', item: canonical },
    ],
  };

  return (
    <div className="seo-scroll-page pb-28 md:pb-0 bg-[hsl(215_100%_12%)] text-white">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(itemListLD)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLD)}</script>
      </Helmet>

      <LandingNav onLoginClick={() => navigate('/auth')} />

      <main className="max-w-5xl mx-auto px-6 pt-28 pb-24">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-12"
        >
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
            Senaste lediga jobben i Sverige
          </h1>
          <p className="text-white text-lg max-w-2xl">
            Nya jobb varje dag från arbetsgivare i hela landet. Skapa min profil idag och ansök direkt i Parium-appen.
          </p>
        </motion.header>

        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-white" /></div>
        ) : jobs.length === 0 ? (
          <p className="text-white">Inga aktiva annonser just nu – kom tillbaka snart.</p>
        ) : (
          <ul className="grid gap-3 mb-16">
            {jobs.map(j => (
              <li key={j.id}>
                <Link
                  to={`/annons/${j.id}`}
                  className="block p-5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-lg truncate mb-1 text-white">{j.title}</h2>
                      <div className="flex flex-wrap gap-3 text-sm text-white">
                        {j.workplace_name && <span className="truncate">{j.workplace_name}</span>}
                        {j.workplace_city && (
                          <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{j.workplace_city}</span>
                        )}
                        {j.employment_type && (
                          <span className="inline-flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{j.employment_type}</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white mt-1 flex-shrink-0" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <section className="border-t border-white/10 pt-10 mb-12">
          <h2 className="text-xl font-semibold mb-4 text-white">Bläddra jobb per stad</h2>
          <div className="flex flex-wrap gap-2">
            {CITIES.map(c => (
              <Link
                key={c.slug}
                to={`/jobb/${c.slug}`}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition"
              >
                Jobb i {c.name}
              </Link>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 pt-10">
          <h2 className="text-xl font-semibold mb-4 text-white">Bläddra jobb per yrke</h2>
          <div className="flex flex-wrap gap-2">
            {OCCUPATIONS.map(o => (
              <Link
                key={o.slug}
                to={`/yrke/${o.slug}`}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition"
              >
                {o.name}
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-16 p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-white/[0.12] via-white/[0.06] to-white/[0.02] border border-white/15 backdrop-blur-md text-center sm:text-left">
          <div className="sm:flex sm:items-center sm:justify-between sm:gap-8">
            <div>
              <h2 className="text-2xl font-semibold mb-2 text-white tracking-tight">Ladda ner Parium-appen</h2>
              <p className="text-white max-w-xl">Få notiser om nya jobb som matchar din profil. Ansök på 30 sekunder.</p>
            </div>
            <Button
              asChild
              size="lg"
              className="mt-6 sm:mt-0 min-h-12 rounded-full bg-secondary text-white hover:bg-secondary/90 px-7 font-semibold flex-shrink-0"
            >
              <Link to="/auth">Skapa min profil idag <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>
        </div>
      </main>
      <MobileStickyCTA />
    </div>
  );
};

export default AnnonserHub;
