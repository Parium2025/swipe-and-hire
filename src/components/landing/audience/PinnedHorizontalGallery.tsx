import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValueEvent } from 'framer-motion';

import real1 from '@/assets/landing/jobseeker-real-1.jpg';
import real2 from '@/assets/landing/jobseeker-real-2.jpg';
import real3 from '@/assets/landing/jobseeker-real-3.jpg';
import real4 from '@/assets/landing/jobseeker-real-4.jpg';
import real5 from '@/assets/landing/jobseeker-real-5.jpg';
import real6 from '@/assets/landing/jobseeker-real-6.jpg';
import real7 from '@/assets/landing/jobseeker-real-7.jpg';

/**
 * PinnedHorizontalGallery
 * - GSAP-stil pinned section: rubrik zoomar in, sedan glider mediestripen horisontellt
 * - Bygger på framer-motion (useScroll/useTransform) — ingen extern dep
 * - Behåller Pariums mörkblå bakgrund (transparent — ärver från sidan)
 */

type MediaItem = {
  type: 'image' | 'video';
  src: string;
  poster?: string;
  position?: string;
  eyebrow: string;
  title: string;
};

const items: MediaItem[] = [
  { type: 'image', src: real1, position: '50% 30%', eyebrow: 'Riktiga människor', title: 'Personliga träningsledare' },
  { type: 'image', src: real5, position: '50% 30%', eyebrow: 'Hantverk', title: 'Rörmokare & byggare' },
  { type: 'video', src: '/landing/jobseeker-real-center.mp4', eyebrow: 'I rörelse', title: 'Yrkespersoner i sitt element' },
  { type: 'video', src: '/landing/jobseeker-real-4.mp4', poster: real2, eyebrow: 'Service', title: 'Mäklare & rådgivare' },
  { type: 'video', src: '/landing/jobseeker-real-3.mp4', poster: real3, eyebrow: 'Restaurang', title: 'Kockar & köksmästare' },
  { type: 'image', src: real4, position: '50% 28%', eyebrow: 'Tekniker', title: 'Elektriker & installatörer' },
  { type: 'image', src: real7, position: '50% 35%', eyebrow: 'Lantbruk', title: 'Bönder & djurskötare' },
  { type: 'image', src: real6, position: '50% 25%', eyebrow: 'Vård', title: 'Undersköterskor & vårdpersonal' },
];

const PinnedHorizontalGallery = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const [containerReady, setContainerReady] = useState(false);

  // Find the landing scroll container (AudienceLanding wraps in a fixed scroll root)
  useEffect(() => {
    const el = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;
    containerRef.current = el;
    setContainerReady(true);
  }, []);

  // 4 viewports tall = generous scroll distance for the pinned animation
  const SCROLL_VH = 420;

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    container: containerRef as React.RefObject<HTMLElement>,
    offset: ['start start', 'end end'],
  });
  void containerReady;

  // Phase 1 (0 → 0.18): headline enters + zooms toward viewer
  const headlineScale = useTransform(scrollYProgress, [0, 0.18, 0.32], [0.92, 1.08, 1.18]);
  const headlineOpacity = useTransform(scrollYProgress, [0, 0.05, 0.22, 0.34], [0, 1, 1, 0]);
  const headlineY = useTransform(scrollYProgress, [0, 0.32], ['0vh', '-12vh']);
  const headlineBlur = useTransform(scrollYProgress, [0.22, 0.34], [0, 8]);

  // Phase 2 (0.28 → 1): horizontal strip travels from right → left
  // Strip width = items * card-width; we move so last card aligns to viewport right
  const xRaw = useTransform(scrollYProgress, [0.28, 0.98], ['8vw', '-118vw']);
  const x = useSpring(xRaw, { stiffness: 120, damping: 26, mass: 0.6 });

  // Subtle progress indicator
  const progressScale = useTransform(scrollYProgress, [0.28, 0.98], [0, 1]);
  const headlineFilter = useTransform(headlineBlur, (b) => `blur(${b}px)`);

  // Try to keep videos playing
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const videos = Array.from(strip.querySelectorAll('video'));
    const playAll = () => videos.forEach((v) => {
      v.muted = true; v.playsInline = true;
      const p = v.play(); if (p && typeof p.catch === 'function') p.catch(() => {});
    });
    playAll();
    const onVis = () => { if (document.visibilityState === 'visible') playAll(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Pause videos when section leaves viewport (perf)
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const strip = stripRef.current;
    if (!strip) return;
    const visible = v > -0.05 && v < 1.05;
    Array.from(strip.querySelectorAll('video')).forEach((vid) => {
      if (visible && vid.paused) vid.play().catch(() => {});
      else if (!visible && !vid.paused) vid.pause();
    });
  });

  return (
    <>
      <style>{`
        .phg-section { position: relative; width: 100%; }
        .phg-sticky {
          position: sticky;
          top: 0;
          height: 100vh;
          width: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .phg-headline {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 0 24px;
          z-index: 3;
          pointer-events: none;
        }
        .phg-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: hsl(var(--secondary) / 0.85);
          margin-bottom: 18px;
        }
        .phg-title {
          font-size: clamp(2.6rem, 8.5vw, 8rem);
          font-weight: 900;
          line-height: 0.94;
          letter-spacing: -0.035em;
          color: white;
          max-width: 12ch;
          text-shadow: 0 12px 60px rgba(0, 0, 0, 0.45);
        }
        .phg-title em {
          font-style: normal;
          background: linear-gradient(120deg, hsl(var(--secondary)), #7cc6ff 60%, hsl(var(--secondary)));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .phg-sub {
          margin-top: 22px;
          font-size: clamp(0.95rem, 1.4vw, 1.15rem);
          line-height: 1.6;
          color: rgba(255,255,255,0.65);
          max-width: 540px;
        }

        .phg-strip-wrap {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          z-index: 2;
        }
        .phg-strip {
          display: flex;
          gap: clamp(18px, 2vw, 32px);
          padding-left: 6vw;
          padding-right: 6vw;
          will-change: transform;
        }
        .phg-card {
          flex: 0 0 auto;
          width: clamp(280px, 36vw, 520px);
          aspect-ratio: 4 / 5;
          border-radius: clamp(20px, 2vw, 28px);
          overflow: hidden;
          position: relative;
          background: rgba(0,0,0,0.4);
          box-shadow:
            0 30px 80px -30px rgba(0,0,0,0.7),
            0 0 0 1px rgba(255,255,255,0.07);
        }
        .phg-card.tall { aspect-ratio: 3 / 5; }
        .phg-card.wide { aspect-ratio: 5 / 4; width: clamp(360px, 44vw, 620px); }
        .phg-card img,
        .phg-card video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          pointer-events: none;
          user-select: none;
        }
        @keyframes phg-kenburns {
          0%   { transform: scale(1.05) translate3d(0,0,0); }
          50%  { transform: scale(1.12) translate3d(-1.5%,-1%,0); }
          100% { transform: scale(1.05) translate3d(0,0,0); }
        }
        .phg-card img { animation: phg-kenburns 22s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .phg-card img { animation: none; }
        }
        .phg-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.4) 100%),
            linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%);
          pointer-events: none;
        }
        .phg-cap {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          padding: clamp(18px, 2vw, 28px);
          color: white;
          z-index: 2;
        }
        .phg-cap-eyebrow {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.78);
          margin-bottom: 6px;
        }
        .phg-cap-title {
          font-size: clamp(16px, 1.6vw, 22px);
          font-weight: 800;
          letter-spacing: -0.015em;
          line-height: 1.15;
          text-shadow: 0 2px 16px rgba(0,0,0,0.55);
        }

        .phg-progress {
          position: absolute;
          left: 50%;
          bottom: 28px;
          transform: translateX(-50%);
          width: min(280px, 50vw);
          height: 2px;
          background: rgba(255,255,255,0.1);
          border-radius: 999px;
          overflow: hidden;
          z-index: 4;
        }
        .phg-progress > span {
          display: block;
          height: 100%;
          background: linear-gradient(90deg, hsl(var(--secondary)), #7cc6ff);
          transform-origin: left center;
          will-change: transform;
        }
        .phg-hint {
          position: absolute;
          bottom: 56px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          z-index: 4;
        }

        @media (max-width: 767px) {
          .phg-card { width: 78vw; }
          .phg-card.wide { width: 86vw; }
        }
      `}</style>

      <div ref={sectionRef} className="phg-section" style={{ height: `${SCROLL_VH}vh` }}>
        <div className="phg-sticky">
          {/* Headline overlay (Phase 1) */}
          <motion.div
            className="phg-headline"
            style={{
              scale: headlineScale,
              opacity: headlineOpacity,
              y: headlineY,
              filter: useTransform(headlineBlur, (b) => `blur(${b}px)`),
            }}
          >
            <div className="phg-eyebrow">För jobbsökare</div>
            <h2 className="phg-title">
              Hitta jobb som <em>faktiskt</em> passar dig.
            </h2>
            <p className="phg-sub">
              Riktiga människor. Riktiga yrken. Scrolla för att möta dem.
            </p>
          </motion.div>

          {/* Horizontal strip (Phase 2) */}
          <div className="phg-strip-wrap" aria-hidden={false}>
            <motion.div ref={stripRef} className="phg-strip" style={{ x }}>
              {items.map((item, i) => {
                const variant = i % 3 === 0 ? 'tall' : i % 3 === 1 ? '' : 'wide';
                return (
                  <div key={i} className={`phg-card ${variant}`}>
                    {item.type === 'video' ? (
                      <video
                        src={item.src}
                        poster={item.poster}
                        muted
                        loop
                        autoPlay
                        playsInline
                        preload="auto"
                        style={{ objectPosition: item.position ?? '50% 50%' }}
                      />
                    ) : (
                      <img
                        src={item.src}
                        alt={item.title}
                        loading={i < 2 ? 'eager' : 'lazy'}
                        decoding="async"
                        draggable={false}
                        style={{ objectPosition: item.position ?? '50% 50%' }}
                      />
                    )}
                    <div className="phg-cap">
                      <div className="phg-cap-eyebrow">{item.eyebrow}</div>
                      <div className="phg-cap-title">{item.title}</div>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </div>

          <div className="phg-hint">Scrolla för att utforska</div>
          <div className="phg-progress" aria-hidden>
            <motion.span style={{ scaleX: progressScale }} />
          </div>
        </div>
      </div>
    </>
  );
};

export default PinnedHorizontalGallery;
