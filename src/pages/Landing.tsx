import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LandingNav from '@/components/LandingNav';
import LandingHero from '@/components/landing/LandingHero';

const LandingMarquee = lazy(() => import('@/components/landing/LandingMarquee'));
const LandingStatement = lazy(() => import('@/components/landing/LandingStatement'));
const LandingHowItWorks = lazy(() => import('@/components/landing/LandingHowItWorks'));
const LandingFeatures = lazy(() => import('@/components/landing/LandingFeatures'));
const LandingForUsers = lazy(() => import('@/components/landing/LandingForUsers'));
const LandingStats = lazy(() => import('@/components/landing/LandingStats'));
const LandingTestimonials = lazy(() => import('@/components/landing/LandingTestimonials'));
const LandingCTA = lazy(() => import('@/components/landing/LandingCTA'));
const LandingFooter = lazy(() => import('@/components/landing/LandingFooter'));

const Landing = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [showSections, setShowSections] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && profile) {
      const role = (profile as any)?.role;
      if (role) navigate('/home', { replace: true });
    }
  }, [user, profile, navigate]);

  // SEO
  useEffect(() => {
    document.title = 'Parium – Rekrytering. På 60 sekunder.';

    const setMeta = (name: string, content: string, attr = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const desc = 'Parium matchar kandidater och arbetsgivare på sekunder. Swipea, matcha och anställ – Tinder för jobb.';
    setMeta('description', desc);
    setMeta('og:title', 'Parium – Rekrytering. På 60 sekunder.', 'property');
    setMeta('og:description', desc, 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('og:locale', 'sv_SE', 'property');
    setMeta('og:site_name', 'Parium', 'property');
    setMeta('og:url', 'https://parium-ab.lovable.app', 'property');
    setMeta('twitter:title', 'Parium – Rekrytering. På 60 sekunder.');
    setMeta('twitter:description', desc);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('robots', 'index, follow, max-image-preview:large');
    setMeta('keywords', 'rekrytering, jobb, swipe, matchning, AI, hitta jobb, Sverige, kandidater');

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = 'https://parium-ab.lovable.app';

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Parium',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, iOS, Android',
      description: desc,
      url: 'https://parium-ab.lovable.app',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'SEK' },
      author: { '@type': 'Organization', name: 'Parium AB' },
    };

    let script = document.querySelector('#landing-jsonld') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = 'landing-jsonld';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    return () => {
      script?.remove();
      canonical?.remove();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowSections(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };

  return (
    <div
      ref={scrollContainerRef}
      className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-gradient-parium text-primary-foreground"
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y pinch-zoom' }}
    >
      <div className="relative z-10 min-h-full">
        <LandingNav onLoginClick={handleLogin} />
        <main>
          <LandingHero scrollContainerRef={scrollContainerRef} />
          {showSections && (
            <Suspense fallback={null}>
              <LandingMarquee />
              <LandingStatement />
              <LandingHowItWorks />
              <LandingFeatures />
              <LandingForUsers />
              <LandingStats />
              <LandingTestimonials />
              <LandingCTA />
            </Suspense>
          )}
        </main>
        {showSections && (
          <Suspense fallback={null}>
            <LandingFooter />
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default Landing;
