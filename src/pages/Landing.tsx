import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import BentoScrollGallery from '@/components/landing/BentoScrollGallery';
import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

/**
 * Landing — minimal version.
 * Only the Parium logo, "Logga in" button, and the bento scroll gallery.
 * No thought bubbles, no nav links, no animated background dots.
 */
const Landing = () => {
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Parium – Rekrytering. På 60 sekunder.';
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };

  return (
    <div
      ref={scrollerRef}
      id="landing-scroller"
      className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-gradient-parium text-primary-foreground"
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y pinch-zoom' }}
    >
      {/* Minimal top bar — only logo + Logga in */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-6 md:px-12 lg:px-24">
          <div className="flex items-center justify-between h-16 sm:h-[72px]">
            <img
              src={pariumLogo}
              alt="Parium"
              width={224}
              height={224}
              className="h-auto w-24 md:w-28"
            />
            <Button
              onClick={handleLogin}
              size="sm"
              className="rounded-full px-6 bg-white/[0.04] border border-white/[0.08] text-white text-[13px] font-medium hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-300"
            >
              Logga in
            </Button>
          </div>
        </div>
      </header>

      <main className="relative">
        <BentoScrollGallery scrollerRef={scrollerRef} />
        {/* Spacer giving ScrollTrigger room to play out the pinned animation */}
        <div className="h-[80vh]" aria-hidden="true" />
      </main>
    </div>
  );
};

export default Landing;
