import { useEffect, useRef, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

type LandingHeroProps = {
  scrollContainerRef: RefObject<HTMLDivElement>;
};

const FRAME_COUNT = 85;
const frameSrc = (frame: number) => `/landing-frames/frame-${String(frame).padStart(3, '0')}.jpg`;

const LandingHero = ({ scrollContainerRef }: LandingHeroProps) => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCacheRef = useRef<Map<number, HTMLImageElement>>(new Map());

  useEffect(() => {
    const container = scrollContainerRef.current;
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!container || !section || !canvas || !context) return;

    let raf = 0;
    let activeFrame = 1;
    let disposed = false;

    const loadFrame = (frame: number) => {
      const clampedFrame = Math.min(FRAME_COUNT, Math.max(1, frame));
      const cached = imageCacheRef.current.get(clampedFrame);
      if (cached) return Promise.resolve(cached);

      return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => {
          imageCacheRef.current.set(clampedFrame, image);
          resolve(image);
        };
        image.onerror = reject;
        image.src = frameSrc(clampedFrame);
      });
    };

    const drawCover = (image: HTMLImageElement) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const drawX = (width - drawWidth) / 2;
      const drawY = (height - drawHeight) / 2;

      context.clearRect(0, 0, width, height);
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    };

    const renderFrame = (frame: number) => {
      activeFrame = Math.min(FRAME_COUNT, Math.max(1, frame));
      void loadFrame(activeFrame)
        .then((image) => {
          if (!disposed && activeFrame === frame) drawCover(image);
        })
        .catch(() => undefined);

      void loadFrame(activeFrame + 1).catch(() => undefined);
      void loadFrame(activeFrame + 2).catch(() => undefined);
    };

    const syncToScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const scrollableDistance = Math.max(1, section.offsetHeight - window.innerHeight);
        const rawProgress = (container.scrollTop - section.offsetTop) / scrollableDistance;
        const progress = Math.min(1, Math.max(0, rawProgress));
        renderFrame(Math.round(progress * (FRAME_COUNT - 1)) + 1);
      });
    };

    renderFrame(1);
    syncToScroll();
    container.addEventListener('scroll', syncToScroll, { passive: true });
    window.addEventListener('resize', syncToScroll);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      container.removeEventListener('scroll', syncToScroll);
      window.removeEventListener('resize', syncToScroll);
    };
  }, [scrollContainerRef]);

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section ref={sectionRef} className="relative bg-gradient-parium" style={{ height: '520vh' }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-label="Parium scrollstyrd frame-by-frame-introduktion"
          role="img"
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
