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
    document.title = 'Parium | AI-rekrytering i Norden';

    const setMeta = (name: string, content: string, attr = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const desc = 'AI-driven rekryteringsplattform för företag och kandidater i Norden med swipe-matchning, video-profiler och direktmeddelanden.';
    setMeta('description', desc);
    setMeta('og:title', 'Parium | AI-rekrytering i Norden', 'property');
    setMeta('og:description', desc, 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('og:locale', 'sv_SE', 'property');
    setMeta('og:site_name', 'Parium', 'property');
    setMeta('og:url', 'https://parium-ab.lovable.app', 'property');
    setMeta('twitter:title', 'Parium | AI-rekrytering i Norden');
    setMeta('twitter:description', desc);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    setMeta('keywords', 'rekrytering, ai rekrytering, jobbmatchning, swipe matchning, video cv, rekryteringsplattform, sverige, norden, kandidater, arbetsgivare, hitta jobb, hitta kandidater, hr tech, talent acquisition, employer branding, screening, jobb i sverige, rekryteringsverktyg, direktmeddelanden');
    setMeta('author', 'Parium AB');
    setMeta('geo.region', 'SE');
    setMeta('geo.placename', 'Stockholm');
    setMeta('geo.position', '59.3293;18.0686');
    setMeta('ICBM', '59.3293, 18.0686');
    setMeta('language', 'Swedish');

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = 'https://parium-ab.lovable.app';

    let alternate = document.querySelector('link[rel="alternate"][hreflang="sv"]') as HTMLLinkElement;
    if (!alternate) {
      alternate = document.createElement('link');
      alternate.rel = 'alternate';
      alternate.hreflang = 'sv';
      document.head.appendChild(alternate);
    }
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
      description: 'AI-driven rekryteringsplattform för Norden med snabb jobbmatchning och modern screening.',
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
          acceptedAnswer: { '@type': 'Answer', text: 'Parium är en AI-driven rekryteringsplattform för kandidater och arbetsgivare i Sverige och Norden med swipe-matchning, video-profiler och direktmeddelanden.' },
        },
        {
          '@type': 'Question',
          name: 'Är Parium gratis?',
          acceptedAnswer: { '@type': 'Answer', text: 'Ja, Parium är gratis under lanseringsperioden och kräver inget kreditkort för att komma igång.' },
        },
        {
          '@type': 'Question',
          name: 'Hur fungerar swipe-matchningen på Parium?',
          acceptedAnswer: { '@type': 'Answer', text: 'Du skapar en profil, ser relevanta jobb eller kandidater och swipear på rätt matchningar. Plattformen prioriterar relevans och snabb kontakt.' },
        },
        {
          '@type': 'Question',
          name: 'Är Parium GDPR-säkert?',
          acceptedAnswer: { '@type': 'Answer', text: 'Ja, plattformen är byggd med moderna säkerhetsprinciper och dataskydd i fokus för rekrytering i Sverige och Norden.' },
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
      if (!script) {
        script = document.createElement('script');
        script.id = id;
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
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
    <div className="fixed inset-0 w-full overflow-x-hidden overflow-y-auto bg-primary text-foreground" style={{ WebkitOverflowScrolling: 'touch' } as any}>
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(220_100%_11%)_0%,hsl(214_100%_13%)_34%,hsl(214_100%_10%)_100%)]" />
        <div className="absolute left-[-18%] top-[18%] h-[40vw] w-[40vw] rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute right-[-10%] top-[10%] h-[56vw] w-[56vw] rounded-full bg-secondary/10 blur-[160px]" />
        <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')]" />
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
