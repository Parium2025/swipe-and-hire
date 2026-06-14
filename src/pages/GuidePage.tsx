import { useEffect } from 'react';
import { Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import LandingNav from '@/components/LandingNav';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { Button } from '@/components/ui/button';
import { ArrowRight, Clock, Calendar } from 'lucide-react';
import { GUIDE_BY_SLUG, GUIDES } from '@/data/guides';

const BASE = 'https://parium.se';

const GuidePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const guide = slug ? GUIDE_BY_SLUG[slug] : null;

  useEffect(() => {
    syncBrowserChrome(window.location.pathname);
    window.scrollTo(0, 0);
  }, [slug]);

  if (!guide) return <Navigate to="/guider" replace />;

  const canonical = `${BASE}/guider/${guide.slug}`;
  const otherGuides = GUIDES.filter((g) => g.slug !== guide.slug);

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    datePublished: guide.updated,
    dateModified: guide.updated,
    author: { '@type': 'Organization', name: 'Parium', url: BASE },
    publisher: {
      '@type': 'Organization',
      name: 'Parium',
      logo: { '@type': 'ImageObject', url: `${BASE}/parium-logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Parium', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Guider', item: `${BASE}/guider` },
      { '@type': 'ListItem', position: 3, name: guide.title, item: canonical },
    ],
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: guide.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <>
      <Helmet>
        <title>{guide.metaTitle}</title>
        <meta name="description" content={guide.description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={guide.metaTitle} />
        <meta property="og:description" content={guide.description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:locale" content="sv_SE" />
        <meta property="article:published_time" content={guide.updated} />
        <meta property="article:modified_time" content={guide.updated} />
        <script type="application/ld+json">{JSON.stringify(articleLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
      </Helmet>

      <div className="min-h-[100dvh] w-full pb-28 md:pb-0 bg-[hsl(215_100%_12%)] text-white">
        <LandingNav onLoginClick={() => navigate('/auth')} />

        {/* Header */}
        <article className="px-5 pt-28 pb-12 sm:px-8 md:px-12">
          <div className="mx-auto max-w-3xl">
            <nav aria-label="Brödsmulor" className="mb-6 text-xs text-white/60">
              <Link to="/guider" className="hover:text-white/90">Guider</Link>
              <span className="mx-1.5">/</span>
              <span className="text-white/80">{guide.category}</span>
            </nav>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/80 backdrop-blur">
              {guide.category}
            </p>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              {guide.title}
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-white/60">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> {guide.readingMinutes} min läsning
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> Uppdaterad {guide.updated}
              </span>
            </div>
            <p className="mt-6 text-lg text-white/85">{guide.excerpt}</p>
          </div>

          {/* Sections */}
          <div className="mx-auto mt-12 max-w-3xl space-y-10">
            {guide.sections.map((s) => (
              <section key={s.heading}>
                <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {s.heading}
                </h2>
                <p className="mt-4 whitespace-pre-line text-white/80 leading-relaxed">
                  {s.body}
                </p>
              </section>
            ))}
          </div>

          {/* FAQ */}
          <div className="mx-auto mt-16 max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Vanliga frågor</h2>
            <div className="mt-6 space-y-4">
              {guide.faqs.map((f) => (
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

          {/* CTA */}
          <div className="mx-auto mt-16 max-w-3xl rounded-3xl border border-white/15 bg-white/[0.08] backdrop-blur-md p-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Klar att ta nästa steg?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/80">
              Skapa profil gratis i Parium – matcha med arbetsgivare direkt.
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

          {/* Andra guider */}
          <div className="mx-auto mt-16 max-w-5xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight">Fler guider</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {otherGuides.map((g) => (
                <li key={g.slug}>
                  <Link
                    to={`/guider/${g.slug}`}
                    className="block rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md p-6 hover:bg-white/[0.10] transition"
                  >
                    <span className="text-xs uppercase tracking-wider text-white/60">
                      {g.category}
                    </span>
                    <h3 className="mt-2 text-base font-semibold text-white">{g.title}</h3>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>
    </>
  );
};

export default GuidePage;
