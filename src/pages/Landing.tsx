import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingNav from '@/components/LandingNav';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import ThoughtBubbles from '@/components/landing/ThoughtBubbles';
import HeroSection from '@/components/landing/v2/HeroSection';
import MarqueeStrip from '@/components/landing/v2/MarqueeStrip';
import TestimonialQuote from '@/components/landing/v2/TestimonialQuote';
import PricingSection from '@/components/landing/v2/PricingSection';
import TestimonialCarousel from '@/components/landing/v2/TestimonialCarousel';
import ProjectsSection from '@/components/landing/v2/ProjectsSection';
import PartnerSection from '@/components/landing/v2/PartnerSection';
import LandingV2Footer from '@/components/landing/v2/LandingV2Footer';
import CopyrightBar from '@/components/landing/v2/CopyrightBar';
import BottomNav from '@/components/landing/v2/BottomNav';

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

    const desc =
      'Parium matchar kandidater och arbetsgivare på sekunder. Swipea, matcha och anställ – Tinder för jobb.';
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

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
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
    <div className="landing-v2-scroll bg-gradient-parium text-primary-foreground font-pp-neue">
      <AnimatedBackground />
      <ThoughtBubbles />

      <div className="relative z-10">
        <LandingNav onLoginClick={handleLogin} />

        <main>
          <HeroSection />
          <MarqueeStrip />
          <TestimonialQuote />
          <PricingSection />
          <TestimonialCarousel />
          <ProjectsSection />
          <PartnerSection />
          <LandingV2Footer />
          <CopyrightBar />
          <div className="h-24" aria-hidden />
        </main>
      </div>

      <BottomNav />
    </div>
  );
};

export default Landing;
