import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import LandingNav from '@/components/LandingNav';
import SeoBubbles from '@/components/seo/SeoBubbles';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { Clock } from 'lucide-react';
import { GUIDES } from '@/data/guides';

const BASE = 'https://parium.se';

const GuiderHub = () => {
  const navigate = useNavigate();

  useEffect(() => {
    syncBrowserChrome(window.location.pathname);
    window.scrollTo(0, 0);
  }, []);

  const canonical = `${BASE}/guider`;
  const title = 'Karriärguider & jobbtips 2026 – CV, lön, intervju | Parium';
  const description =
    'Gratis guider om jobbsökning, CV, lön, anställningsintervju och karriärbyte. Uppdaterat för 2026 med svenska siffror och tips från rekryterare.';

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Karriärguider från Parium',
    itemListElement: GUIDES.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${BASE}/guider/${g.slug}`,
      name: g.title,
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

      <div className="seo-scroll-page pb-16 bg-[hsl(215_100%_12%)] bg-parium-gradient text-white">
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
              Karriärguider & jobbtips
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white sm:text-xl">
              Allt du behöver för att söka, byta eller förhandla jobb 2026 – skrivet för
              den svenska arbetsmarknaden.
            </p>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-8 md:px-12">
          <ul className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2">
            {GUIDES.map((g) => (
              <li key={g.slug}>
                <Link
                  to={`/guider/${g.slug}`}
                  className="block h-full rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md p-7 hover:bg-white/[0.10] transition"
                >
                  <span className="text-xs uppercase tracking-wider text-white">
                    {g.category}
                  </span>
                  <h2 className="mt-3 text-xl font-semibold text-white">{g.title}</h2>
                  <p className="mt-3 text-sm text-white">{g.excerpt}</p>
                  <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-white">
                    <Clock className="h-3.5 w-3.5" />
                    {g.readingMinutes} min · Uppdaterad {g.updated}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
};

export default GuiderHub;
