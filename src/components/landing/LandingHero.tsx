import { useEffect, useRef, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import scrollHeroVideo from '@/assets/parium-scroll-hero.mp4';

type LandingHeroProps = {
  scrollContainerRef: RefObject<HTMLDivElement>;
};

const LandingHero = ({ scrollContainerRef }: LandingHeroProps) => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.playsInline = true;

    const playVideo = () => {
      void video.play().catch(() => undefined);
    };

    playVideo();
    video.addEventListener('canplay', playVideo);
    window.addEventListener('pointerdown', playVideo, { passive: true });
    document.addEventListener('visibilitychange', playVideo);

    return () => {
      video.removeEventListener('canplay', playVideo);
      window.removeEventListener('pointerdown', playVideo);
      document.removeEventListener('visibilitychange', playVideo);
    };
  }, [scrollContainerRef]);

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section ref={sectionRef} className="relative min-h-[100svh] overflow-hidden bg-gradient-parium">
      <div className="relative min-h-[100svh] overflow-hidden">
        <video
          ref={videoRef}
          src={scrollHeroVideo}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-label="Parium introduktionsvideo"
        />

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--primary)/0.05)_0%,hsl(var(--primary)/0)_44%,hsl(var(--primary)/0.28)_100%)]" />

        <motion.div
          className="absolute inset-x-0 bottom-20 z-20 flex justify-center px-6 sm:bottom-24 md:bottom-28"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 }}
        >
          <motion.button
            type="button"
            onPointerDown={handleStart}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="group inline-flex min-h-touch items-center gap-3 rounded-full bg-secondary px-7 py-3.5 text-sm font-bold text-secondary-foreground shadow-[0_16px_48px_hsl(var(--secondary)/0.35)] transition-shadow hover:shadow-[0_20px_60px_hsl(var(--secondary)/0.45)]"
          >
            Kom igång gratis
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </motion.button>
        </motion.div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-primary/55 to-transparent" />
      </div>
    </section>
  );
};

export default LandingHero;
