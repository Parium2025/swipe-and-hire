import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingNav from '@/components/LandingNav';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import ThoughtBubbles from '@/components/landing/ThoughtBubbles';
import BentoScrollGallery from '@/components/landing/BentoScrollGallery';

const Landing = () => {
  const navigate = useNavigate();

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

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = 'https://parium.se';

    return () => {
      canonical?.remove();
    };
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };

  return (
    // Window-scroll (NOT a custom scroll container) — required for
    // GSAP ScrollTrigger pin + Flip to work reliably across browsers/iOS.
    <div className="relative min-h-screen bg-gradient-parium text-primary-foreground">
      <AnimatedBackground />
      <div className="relative z-10">
        <LandingNav onLoginClick={handleLogin} />
        <main className="relative">
          {/* Floating Parium thought bubbles — pinned to first viewport */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-screen z-[15]">
            <ThoughtBubbles />
          </div>

          {/* Bento scroll gallery (uses window scroll) */}
          <BentoScrollGallery />

          {/* Spacer so the user has room to scroll past the pinned gallery
              and trigger the Flip animation. The pinned section adds its
              own end-distance via `end: '+=100%'`. */}
          <div className="h-[60vh]" aria-hidden="true" />
        </main>
      </div>
    </div>
  );
};

export default Landing;
