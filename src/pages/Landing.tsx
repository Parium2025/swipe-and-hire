import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import LandingNav from '@/components/LandingNav';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import ThoughtBubbles from '@/components/landing/ThoughtBubbles';
import BentoScrollGallery from '@/components/landing/BentoScrollGallery';

const Landing = () => {
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement>(null);

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
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };

  return (
    // Custom scroll container (required because html/body have overflow:hidden globally)
    <div
      ref={scrollerRef}
      id="landing-scroller"
      className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-gradient-parium text-primary-foreground"
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y pinch-zoom' }}
    >
      <AnimatedBackground />
      <div className="relative z-10">
        <LandingNav onLoginClick={handleLogin} />
        <main className="relative">
          {/* Floating Parium thought bubbles — fixed to first viewport */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-screen z-[15]">
            <ThoughtBubbles />
          </div>

          <BentoScrollGallery scrollerRef={scrollerRef} />

          {/* Spacer that gives ScrollTrigger room to play the Flip after pin ends */}
          <div className="h-[80vh]" aria-hidden="true" />
        </main>
      </div>
    </div>
  );
};

export default Landing;
