import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import LandingNav from '@/components/LandingNav';
import SeoBubbles from '@/components/seo/SeoBubbles';
import SeoBackButton from '@/components/seo/SeoBackButton';
import { syncBrowserChrome } from '@/lib/browserChrome';
import { Button } from '@/components/ui/button';
import SeoCTAButton from '@/components/seo/SeoCTAButton';
import { ArrowRight, Clock, Calendar } from 'lucide-react';
import { GUIDE_BY_SLUG, GUIDES } from '@/data/guides';

const BASE = 'https://parium.se';
const ease = [0.16, 1, 0.3, 1] as const;

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[56px] cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left text-lg font-medium text-white"
      >
        <span>{q}</span>
        <motion.span
          className="text-secondary text-2xl leading-none flex-shrink-0"
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.35, ease }}
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.45, ease },
              opacity: { duration: 0.3, ease, delay: open ? 0.08 : 0 },
            }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-6 text-white leading-relaxed">
              <span className="font-semibold text-white/90">Svar: </span>
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const GuidePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const guide = slug ? GUIDE_BY_SLUG[slug] : null;

  useEffect(() => {
    syncBrowserChrome(window.location.pathname);
    // Den faktiska scroll-containern är .seo-scroll-page (position:fixed) — inte window.
    // Vi animerar smooth scroll till toppen så det känns som en mjuk övergång,
    // inte ett hårt "blixt"-hopp.
    const el = document.querySelector('.seo-scroll-page') as HTMLElement | null;
    const start = el ? el.scrollTop : window.scrollY;
    if (start <= 0) return;

    const duration = 650; // ms — lugn, premium känsla
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    const t0 = performance.now();
    let raf = 0;

    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const y = Math.round(start * (1 - ease(p)));
      if (el) el.scrollTop = y;
      else window.scrollTo(0, y);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
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

      <div className="seo-scroll-page bg-[hsl(215_100%_12%)] bg-parium-gradient text-white">
        {/* Bakgrundsbubblor + glow renderas UTANFÖR motion-elementet.
            En transform på en parent skapar en ny "containing block" som bryter
            position:fixed och får bubblorna att fade:as in med innehållet.
            Genom att rendera dem som syskon är de förladdade direkt vid mount. */}
        <SeoBubbles />
        <LandingNav onLoginClick={() => navigate('/auth')} />
        <SeoBackButton fallback="/guider" />


        {/* Header — ingen mount-animation och ingen key på slug:
            innehållet ska bytas in direkt utan att hela sektionen "laddas om". */}
        <article className="relative px-5 pt-6 pb-12 sm:px-8 md:px-12">
          <div className="relative z-10 mx-auto max-w-3xl">
            <nav aria-label="Brödsmulor" className="mb-6 text-xs text-white">
              <Link to="/guider" className="hover:opacity-80">Guider</Link>
              <span className="mx-1.5">/</span>
              <span className="text-white">{guide.category}</span>
            </nav>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white backdrop-blur">
              {guide.category}
            </p>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              {guide.title}
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-white">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> {guide.readingMinutes} min läsning
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> Uppdaterad {guide.updated}
              </span>
            </div>
            <p className="mt-6 text-lg text-white">{guide.excerpt}</p>
          </div>

          {/* Sections */}
          <div className="mx-auto mt-12 max-w-3xl space-y-6">
            {guide.sections.map((s) => {
              const lines = s.body.split('\n').map((l) => l.trim()).filter(Boolean);
              const isNumberedList =
                lines.length >= 2 && lines.every((l) => /^\d+\.\s+/.test(l));
              const isBulletList =
                !isNumberedList &&
                lines.length >= 2 &&
                lines.every((l) => /^[-•]\s+/.test(l));

              return (
                <section
                  key={s.heading}
                  className="rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-md p-6 sm:p-8 shadow-[0_18px_50px_rgba(0,0,0,0.18)]"
                >
                  <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {s.heading}
                  </h2>

                  {isNumberedList ? (
                    <ol className="mt-6 space-y-3">
                      {lines.map((l) => {
                        const match = l.match(/^(\d+)\.\s+(.*)$/);
                        const num = match?.[1] ?? '';
                        const text = match?.[2] ?? l;
                        return (
                          <li
                            key={l}
                            className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5 transition-colors hover:bg-white/[0.09]"
                          >
                            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                              {num}
                            </span>
                            <span className="text-white leading-relaxed">{text}</span>
                          </li>
                        );
                      })}
                    </ol>
                  ) : isBulletList ? (
                    <ul className="mt-6 space-y-3">
                      {lines.map((l) => {
                        const text = l.replace(/^[-•]\s+/, '');
                        return (
                          <li
                            key={l}
                            className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5"
                          >
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" aria-hidden="true" />
                            <span className="text-white leading-relaxed">{text}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-4 whitespace-pre-line text-white leading-relaxed">
                      {s.body}
                    </p>
                  )}
                </section>
              );
            })}
          </div>

          {/* FAQ */}
          <div className="mx-auto mt-16 max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Vanliga frågor</h2>
            <div className="mt-6 space-y-4">
              {guide.faqs.map((f) => (
                <FaqItem key={f.q} q={f.q} a={f.a} />
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mx-auto mt-16 max-w-3xl rounded-3xl border border-white/15 bg-white/[0.08] backdrop-blur-md p-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Klar att ta nästa steg?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white">
              Skapa min profil idag i Parium och sök jobb på sekunder.
            </p>
            <div className="mt-8 flex justify-center">
              <SeoCTAButton onClick={() => navigate('/auth')} />
            </div>
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
                    <span className="text-xs uppercase tracking-wider text-white">
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
