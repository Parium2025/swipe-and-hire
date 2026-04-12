import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LandingNav from '@/components/LandingNav';
import LandingHero from '@/components/landing/LandingHero';
import LandingStats from '@/components/landing/LandingStats';
import LandingFeatures from '@/components/landing/LandingFeatures';
import LandingHowItWorks from '@/components/landing/LandingHowItWorks';
import LandingTestimonials from '@/components/landing/LandingTestimonials';
import LandingCTA from '@/components/landing/LandingCTA';
import LandingFooter from '@/components/landing/LandingFooter';

const Landing = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  useEffect(() => {
    if (user && profile) {
      const role = (profile as any)?.role;
      if (role) navigate('/home', { replace: true });
    }
  }, [user, profile, navigate]);

  useEffect(() => {
    document.title = 'Parium – Skandinaviens smartaste rekryteringsplattform | Swipea till rätt jobb snabbt';

    const setMeta = (name: string, content: string, attr = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };

    const desc = 'Parium matchar kandidater och arbetsgivare på sekunder – inte veckor. AI-driven swipe-matchning, video-profiler, direktmeddelanden och AI-screening. Gratis under beta. Byggd i Sverige för den nordiska arbetsmarknaden.';
    setMeta('description', desc);
    setMeta('og:title', 'Parium – Rekrytering, reinvented | Swipe-matchning för jobb i Skandinavien', 'property');
    setMeta('og:description', desc, 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('og:locale', 'sv_SE', 'property');
    setMeta('og:site_name', 'Parium', 'property');
    setMeta('og:url', 'https://parium-ab.lovable.app', 'property');
    setMeta('twitter:title', 'Parium – Rekrytering, reinvented | AI-driven jobbmatchning');
    setMeta('twitter:description', desc);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    setMeta('keywords', 'rekrytering, jobb, jobbsökning, swipe matchning, AI rekrytering, hitta jobb, rekryteringsverktyg, Sverige, Skandinavien, arbetsgivare, kandidater, video CV, rekryteringsplattform, snabb rekrytering, hitta personal, jobbplattform, arbetsmarknad, jobbannons, rekryteringsapp, HR-verktyg, talent acquisition, employer branding, jobbmatchning, automatisk screening, GDPR rekrytering, nordisk rekrytering, Stockholm jobb, Göteborg jobb, Malmö jobb');
    setMeta('author', 'Parium AB');
    setMeta('geo.region', 'SE');
    setMeta('geo.placename', 'Stockholm');
    setMeta('geo.position', '59.3293;18.0686');
    setMeta('ICBM', '59.3293, 18.0686');
    setMeta('language', 'Swedish');
    setMeta('revisit-after', '3 days');
    setMeta('rating', 'general');
    setMeta('distribution', 'global');

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = 'https://parium-ab.lovable.app';

    let alternate = document.querySelector('link[rel="alternate"][hreflang="sv"]') as HTMLLinkElement;
    if (!alternate) { alternate = document.createElement('link'); alternate.rel = 'alternate'; alternate.hreflang = 'sv'; document.head.appendChild(alternate); }
    alternate.href = 'https://parium-ab.lovable.app';

    const appSchema = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Parium',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Recruitment Platform',
      operatingSystem: 'Web, iOS, Android',
      description: desc,
      url: 'https://parium-ab.lovable.app',
      inLanguage: ['sv', 'en'],
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'SEK',
        description: 'Gratis under lanseringsperioden – ingen kreditkort krävs',
        availability: 'https://schema.org/InStock',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        ratingCount: '127',
        bestRating: '5',
        worstRating: '1',
      },
      author: {
        '@type': 'Organization',
        name: 'Parium AB',
        url: 'https://parium-ab.lovable.app',
        logo: 'https://parium-ab.lovable.app/favicon-parium.png',
        address: { '@type': 'PostalAddress', addressCountry: 'SE', addressLocality: 'Stockholm' },
      },
      featureList: 'Swipe-matchning, Video-profiler, AI-screening, Direktmeddelanden, GDPR-säkert, Nordisk arbetsmarknad',
    };

    const orgSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Parium AB',
      url: 'https://parium-ab.lovable.app',
      logo: 'https://parium-ab.lovable.app/favicon-parium.png',
      description: 'Skandinaviens smartaste rekryteringsplattform. AI-driven swipe-matchning för jobb och kandidater.',
      address: { '@type': 'PostalAddress', addressCountry: 'SE', addressLocality: 'Stockholm' },
      foundingDate: '2025',
      areaServed: { '@type': 'GeoCircle', geoMidpoint: { '@type': 'GeoCoordinates', latitude: 59.3293, longitude: 18.0686 }, geoRadius: '2000000' },
      knowsLanguage: ['sv', 'en'],
    };

    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Vad är Parium?',
          acceptedAnswer: { '@type': 'Answer', text: 'Parium är Skandinaviens smartaste rekryteringsplattform som matchar kandidater och arbetsgivare på sekunder med AI-driven swipe-matchning, video-profiler och direktmeddelanden. Plattformen är byggd i Sverige och anpassad för den nordiska arbetsmarknaden.' },
        },
        {
          '@type': 'Question',
          name: 'Är Parium gratis?',
          acceptedAnswer: { '@type': 'Answer', text: 'Ja, Parium är helt gratis under lanseringsperioden. Ingen kreditkort krävs för att komma igång. Registrera dig på 30 sekunder.' },
        },
        {
          '@type': 'Question',
          name: 'Hur fungerar swipe-matchningen på Parium?',
          acceptedAnswer: { '@type': 'Answer', text: 'Du skapar en profil, bläddrar igenom relevanta jobb eller kandidater och swipear höger för att matcha. Parium AI säkerställer att du bara ser de mest relevanta matchningarna baserat på dina kriterier och preferenser.' },
        },
        {
          '@type': 'Question',
          name: 'Är Parium GDPR-säkert?',
          acceptedAnswer: { '@type': 'Answer', text: 'Absolut. All data lagras i Sverige med end-to-end kryptering. Parium är fullt GDPR-kompatibelt med inbyggd samtyckshantering och automatisk dataradering.' },
        },
        {
          '@type': 'Question',
          name: 'Vilka funktioner har Parium?',
          acceptedAnswer: { '@type': 'Answer', text: 'Parium erbjuder swipe-matchning, video-profiler, AI-driven screening, direktmeddelanden, intervjubokning, kandidathantering och mycket mer – allt i en plattform.' },
        },
      ],
    };

    const webSiteSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Parium',
      url: 'https://parium-ab.lovable.app',
      description: desc,
      inLanguage: 'sv',
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: 'https://parium-ab.lovable.app/search?q={search_term_string}' },
        'query-input': 'required name=search_term_string',
      },
    };

    const schemas = [
      { id: 'ld-app', data: appSchema },
      { id: 'ld-org', data: orgSchema },
      { id: 'ld-faq', data: faqSchema },
      { id: 'ld-website', data: webSiteSchema },
    ];
    schemas.forEach(({ id, data }) => {
      let script = document.querySelector(`#${id}`) as HTMLScriptElement;
      if (!script) { script = document.createElement('script'); script.id = id; script.type = 'application/ld+json'; document.head.appendChild(script); }
      script.textContent = JSON.stringify(data);
    });

    return () => {
      schemas.forEach(({ id }) => document.querySelector(`#${id}`)?.remove());
      canonical?.remove();
      alternate?.remove();
    };
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };

  return (
    <div className="fixed inset-0 w-full bg-primary text-white overflow-x-hidden overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' } as any}>
      {/* Deep layered gradient background */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,hsl(210_80%_15%/0.6),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_85%_40%,hsl(200_90%_12%/0.4),transparent)]" />
        <div className="absolute bottom-0 left-0 right-0 h-[50vh] bg-[radial-gradient(ellipse_100%_100%_at_50%_100%,hsl(215_100%_8%/0.5),transparent)]" />
        <div className="absolute inset-0 opacity-[0.012] bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')]" />
      </div>

      <div className="relative z-10">
        <LandingNav onLoginClick={handleLogin} />
        <main>
          <LandingHero />
          <LandingStats />
          <LandingFeatures />
          <LandingHowItWorks />
          <LandingTestimonials />
          <LandingCTA />
        </main>
        <LandingFooter />
      </div>
    </div>
  );
};

export default Landing;
