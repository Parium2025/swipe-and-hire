import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import LandingNav from '@/components/LandingNav';
import MobileStickyCTA from '@/components/seo/MobileStickyCTA';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { Button } from '@/components/ui/button';
import { ArrowRight, Briefcase } from 'lucide-react';
import { OCCUPATIONS } from '@/data/jobOccupations';

const BASE = 'https://parium.se';

const YrkenHub = () => {
  const navigate = useNavigate();

  useEffect(() => {
    syncBrowserChrome(window.location.pathname);
  }, []);

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
        <script type="application/ld+json">{JSON.stringify(itemListLd)}</script>
      </Helmet>

      <div className="min-h-[100dvh] w-full pb-28 md:pb-0 bg-[hsl(215_100%_12%)] text-white">
        <LandingNav onLoginClick={() => navigate('/auth')} />

        <section className="relative overflow-hidden px-5 pt-28 pb-12 sm:px-8 md:px-12">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-60"
            style={{
              background:
                'radial-gradient(70% 60% at 50% 0%, rgba(70,130,255,0.30) 0%, rgba(70,130,255,0) 70%)',
            }}
          />
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Lediga jobb per yrke
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 sm:text-xl">
              Hitta lediga jobb inom Sveriges mest efterfrågade yrken. Skapa profil gratis och
              matcha med arbetsgivare över hela landet.
            </p>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-8 md:px-12">
          <ul className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 md:grid-cols-3">
            {OCCUPATIONS.map((o) => (
              <li key={o.slug}>
                <Link
                  to={`/yrke/${o.slug}`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md p-6 hover:bg-white/[0.10] transition"
                >
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-5 w-5 text-white/70" />
                    <span className="text-xs uppercase tracking-wider text-white/60">
                      {o.category}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold text-white">
                    Lediga jobb {o.asForm}
                  </h2>
                  <p className="mt-2 text-sm text-white/70 line-clamp-2">{o.intro}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="px-5 py-20 sm:px-8 md:px-12">
          <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-white/[0.08] backdrop-blur-md p-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Hitta ditt nästa jobb idag
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/80">
              Skapa profil gratis – matcha med arbetsgivare i hela Sverige.
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/auth')}
              className="mt-8 min-h-11 rounded-full bg-chalk text-[hsl(215_100%_12%)] hover:bg-chalk/90 px-7"
            >
              Skapa profil gratis
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </section>
        <MobileStickyCTA />
      </div>
    </>
  );
};

export default YrkenHub;
