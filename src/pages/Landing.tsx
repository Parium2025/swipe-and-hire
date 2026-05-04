import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingNav from '@/components/LandingNav';
import LandingHero from '@/components/landing/LandingHero';

const Landing = () => {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
    setMeta('og:url', 'https://parium.se', 'property');
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
    canonical.href = 'https://parium.se';

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Parium',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, iOS, Android',
      description: desc,
      url: 'https://parium.se',
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

  // Keep browser chrome/background sandy only while the video landing route is mounted.
  useEffect(() => {
    const SAND = '#8A8A8A';
    const BLUE = '#001935';
    const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]')) as HTMLMetaElement[];

    document.documentElement.classList.add('landing-video-chrome');
    document.body.classList.add('landing-video-chrome');
    document.documentElement.classList.remove('parium-app-chrome');
    document.body.classList.remove('parium-app-chrome');
    metas.forEach((m) => m.setAttribute('content', SAND));

    return () => {
      document.documentElement.classList.remove('landing-video-chrome');
      document.body.classList.remove('landing-video-chrome');
      document.documentElement.classList.add('parium-app-chrome');
      document.body.classList.add('parium-app-chrome');
      metas.forEach((m) => m.setAttribute('content', BLUE));
    };
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };

  return (
    <div
      ref={scrollContainerRef}
      className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden overscroll-y-contain text-foreground"
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y pinch-zoom' }}
    >
      <div className="relative z-10 min-h-full">
        <LandingNav onLoginClick={handleLogin} />
        <main>
          <LandingHero scrollContainerRef={scrollContainerRef} />
        </main>
      </div>
    </div>
  );
};

export default Landing;
