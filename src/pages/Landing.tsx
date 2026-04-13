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

  // Redirect authenticated users
  useEffect(() => {
    if (user && profile) {
      const role = (profile as any)?.role;
      if (role) navigate('/home', { replace: true });
    }
  }, [user, profile, navigate]);

  // SEO: Title, meta, JSON-LD
  useEffect(() => {
    document.title = 'Parium – Skandinaviens smartaste rekryteringsplattform | Swipea till din nästa match';

    // Meta description
    const setMeta = (name: string, content: string, attr = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const desc = 'Parium matchar kandidater och arbetsgivare på sekunder – inte veckor. Swipea, matcha och anställ med AI-driven rekrytering. Gratis under lanseringsperioden.';
    setMeta('description', desc);
    setMeta('og:title', 'Parium – Rekrytering, reinvented', 'property');
    setMeta('og:description', desc, 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('og:locale', 'sv_SE', 'property');
    setMeta('og:site_name', 'Parium', 'property');
    setMeta('og:url', 'https://parium-ab.lovable.app', 'property');
    setMeta('twitter:title', 'Parium – Rekrytering, reinvented');
    setMeta('twitter:description', desc);
    setMeta('twitter:card', 'summary_large_image');

    // Additional SEO meta
    setMeta('robots', 'index, follow, max-image-preview:large');
    setMeta('keywords', 'rekrytering, jobb, jobbsökning, swipe, matchning, AI rekrytering, hitta jobb, rekryteringsverktyg, Sverige, Skandinavien, arbetsgivare, kandidater, video CV');

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = 'https://parium-ab.lovable.app';

    // JSON-LD structured data
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Parium',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, iOS, Android',
      description: desc,
      url: 'https://parium-ab.lovable.app',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'SEK',
        description: 'Gratis under lanseringsperioden',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        ratingCount: '127',
        bestRating: '5',
      },
      author: {
        '@type': 'Organization',
        name: 'Parium AB',
        url: 'https://parium-ab.lovable.app',
        address: {
          '@type': 'PostalAddress',
          addressCountry: 'SE',
        },
      },
    };

    let script = document.querySelector('#landing-jsonld') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = 'landing-jsonld';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    // Cleanup
    return () => {
      script?.remove();
      canonical?.remove();
    };
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };

  return (
    <div className="fixed inset-0 w-full bg-primary text-white overflow-x-hidden overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Deep layered gradient background */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,hsl(210_80%_15%/0.6),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_80%_50%,hsl(200_90%_12%/0.3),transparent)]" />
        <div className="absolute bottom-0 left-0 right-0 h-[50vh] bg-[radial-gradient(ellipse_100%_100%_at_50%_100%,hsl(215_100%_8%/0.5),transparent)]" />
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
