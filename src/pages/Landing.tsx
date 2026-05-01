import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingNav from '@/components/LandingNav';
import LandingHero from '@/components/landing/LandingHero';
import { AnimatedBackground } from '@/components/AnimatedBackground';

const Landing = () => {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { documentElement, body } = document;
    const scrollY = window.scrollY;
    const previousHtml = {
      overflow: documentElement.style.overflow,
      height: documentElement.style.height,
      overscrollBehavior: documentElement.style.overscrollBehavior,
    };
    const previousBody = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      height: body.style.height,
      overscrollBehavior: body.style.overscrollBehavior,
    };

    documentElement.style.overflow = 'hidden';
    documentElement.style.height = '100%';
    documentElement.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.height = '100%';
    body.style.overscrollBehavior = 'none';

    const preventScroll = (event: TouchEvent) => {
      const target = event.target as HTMLElement | null;
      // Allow touch interaction inside the 3D phone (Spline iframe / canvas)
      if (target && target.closest('[data-allow-touch="true"]')) return;
      if (event.cancelable) event.preventDefault();
    };
    window.addEventListener('touchmove', preventScroll, { passive: false });
    document.addEventListener('touchmove', preventScroll, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('wheel', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-allow-touch="true"]')) return;
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    return () => {
      window.removeEventListener('touchmove', preventScroll);
      document.removeEventListener('touchmove', preventScroll);
      documentElement.style.overflow = previousHtml.overflow;
      documentElement.style.height = previousHtml.height;
      documentElement.style.overscrollBehavior = previousHtml.overscrollBehavior;
      body.style.overflow = previousBody.overflow;
      body.style.position = previousBody.position;
      body.style.top = previousBody.top;
      body.style.width = previousBody.width;
      body.style.height = previousBody.height;
      body.style.overscrollBehavior = previousBody.overscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, []);

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

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };

  return (
    <div
      ref={scrollContainerRef}
      className="fixed inset-0 z-0 overflow-hidden overscroll-none bg-gradient-parium text-primary-foreground"
      style={{ touchAction: 'none' }}
    >
      <AnimatedBackground />
      <div className="relative z-10 h-full">
        <LandingNav onLoginClick={handleLogin} />
        <main className="h-full">
          <LandingHero scrollContainerRef={scrollContainerRef} />
        </main>
      </div>
    </div>
  );
};

export default Landing;
