import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import scrollHeroVideo from '@/assets/parium-scroll-hero.mp4';

const LandingHero = () => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoDuration, setVideoDuration] = useState(7.041667);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  const ctaOpacity = useTransform(scrollYProgress, [0, 0.12, 0.82, 0.94], [0, 1, 1, 0]);
  const ctaY = useTransform(scrollYProgress, [0, 0.12, 0.82, 0.94], [16, 0, 0, 16]);
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video) return;

    let raf = 0;
    const syncVideoToScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = section.getBoundingClientRect();
        const scrollableDistance = Math.max(1, section.offsetHeight - window.innerHeight);
        const rawProgress = Math.abs(rect.top) / scrollableDistance;
        const progress = Math.min(1, Math.max(0, rawProgress));
        const targetTime = Math.min(videoDuration - 0.04, Math.max(0.001, progress * videoDuration));

        if (video.readyState >= 1 && Math.abs(video.currentTime - targetTime) > 0.02) {
          video.currentTime = targetTime;
        }
      });
    };

    syncVideoToScroll();
    window.addEventListener('scroll', syncVideoToScroll, { passive: true });
    document.addEventListener('scroll', syncVideoToScroll, { passive: true, capture: true });
    window.addEventListener('resize', syncVideoToScroll);
    video.addEventListener('loadedmetadata', syncVideoToScroll);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', syncVideoToScroll);
      document.removeEventListener('scroll', syncVideoToScroll, { capture: true });
      window.removeEventListener('resize', syncVideoToScroll);
      video.removeEventListener('loadedmetadata', syncVideoToScroll);
    };
  }, [videoDuration]);

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section ref={sectionRef} className="relative" style={{ height: '520vh' }}>
      <div className="sticky top-0 h-[100dvh] overflow-hidden bg-gradient-parium">
        <video
          ref={videoRef}
          src={scrollHeroVideo}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
          preload="auto"
          aria-label="Parium scroll-baserad introduktionsvideo"
          onLoadedMetadata={(event) => {
            const duration = event.currentTarget.duration;
            if (Number.isFinite(duration) && duration > 0) setVideoDuration(duration);
            event.currentTarget.currentTime = 0.001;
          }}
        />

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--primary)/0.05)_0%,hsl(var(--primary)/0)_44%,hsl(var(--primary)/0.28)_100%)]" />

        <motion.div
          className="absolute inset-x-0 bottom-20 z-20 flex justify-center px-6 sm:bottom-24 md:bottom-28"
          style={{ opacity: ctaOpacity, y: ctaY }}
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

        <div className="absolute inset-x-0 bottom-0 z-20 px-6 pb-5 lg:px-16 lg:pb-8">
          <div className="h-[2px] w-full overflow-hidden rounded-full bg-primary-foreground/10">
            <motion.div className="h-full rounded-full bg-secondary" style={{ width: progressWidth }} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
