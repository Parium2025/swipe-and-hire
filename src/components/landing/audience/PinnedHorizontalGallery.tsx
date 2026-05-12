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
 * Apple-style "Så funkar det" sektion.
 * - Centrerad rubrik som kommer in med fade+lyft (ingen dubblett av hero)
 * - En lugn pinned horizontell mediestrip med raffinerade kort (~340px)
 * - Generöst whitespace, subtil rörelse — inte scroll-jacking-overkill
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
  { type: 'video', src: '/landing/jobseeker-pt.mp4', poster: real1, position: '50% 30%', eyebrow: 'Träning', title: 'Personliga tränare' },
  { type: 'image', src: real5, position: '50% 30%', eyebrow: 'Hantverk', title: 'Rörmokare & byggare' },
  { type: 'video', src: '/landing/jobseeker-real-center.mp4', eyebrow: 'I rörelse', title: 'Yrkespersoner i sitt element' },
  { type: 'video', src: '/landing/jobseeker-real-4.mp4', poster: real2, eyebrow: 'Service', title: 'Mäklare & rådgivare' },
  { type: 'video', src: '/landing/jobseeker-real-3.mp4', poster: real3, eyebrow: 'Restaurang', title: 'Kockar & köksmästare' },
  { type: 'image', src: real4, position: '50% 28%', eyebrow: 'Tekniker', title: 'Elektriker' },
  { type: 'image', src: real7, position: '50% 35%', eyebrow: 'Lantbruk', title: 'Bönder & djurskötare' },
  { type: 'image', src: real6, position: '50% 25%', eyebrow: 'Vård', title: 'Undersköterskor' },
];

const PinnedHorizontalGallery = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const [, setReady] = useState(false);

  useEffect(() => {
    const el = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;
    containerRef.current = el;
    setReady(true);
  }, []);

  // Lagom scroll — innehållet är synligt direkt, ingen tom yta
  const SCROLL_VH = 200;

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    container: containerRef as React.RefObject<HTMLElement>,
    offset: ['start start', 'end end'],
  });

  // Headline syns direkt, glider lugnt uppåt mot slutet
  const headerOpacity = useTransform(scrollYProgress, [0, 0.55, 0.85], [1, 1, 0.25]);
  const headerY = useTransform(scrollYProgress, [0, 0.85], [0, -60]);

  // Strip: synlig direkt, glider höger → vänster
  const xRaw = useTransform(scrollYProgress, [0, 1], ['6vw', '-115vw']);
  const x = useSpring(xRaw, { stiffness: 110, damping: 28, mass: 0.5 });

  const progressScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

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
          display: grid;
          grid-template-rows: auto 1fr auto;
          align-items: stretch;
        }
        .phg-header {
          padding: clamp(48px, 8vh, 96px) 24px clamp(24px, 4vh, 48px);
          text-align: center;
          z-index: 3;
          will-change: transform, opacity;
        }
        .phg-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: hsl(var(--secondary) / 0.9);
          margin-bottom: 14px;
        }
        .phg-title {
          font-size: clamp(2.25rem, 5.4vw, 4.75rem);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.028em;
          color: white;
          max-width: 18ch;
          margin: 0 auto;
        }
        .phg-title em {
          font-style: normal;
          background: linear-gradient(120deg, #ffffff 0%, #9bd3ff 50%, hsl(var(--secondary)) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .phg-sub {
          margin: 22px auto 0;
          font-size: clamp(1rem, 1.2vw, 1.125rem);
          line-height: 1.65;
          color: rgba(255,255,255,0.62);
          max-width: 52ch;
        }

        .phg-strip-wrap {
          position: relative;
          display: flex;
          align-items: center;
          overflow: hidden;
          z-index: 2;
        }
        .phg-strip {
          display: flex;
          gap: clamp(14px, 1.6vw, 22px);
          padding: 0 6vw;
          will-change: transform, opacity;
        }
        .phg-card {
          flex: 0 0 auto;
          width: clamp(240px, 23vw, 340px);
          aspect-ratio: 4 / 5;
          border-radius: 26px;
          overflow: hidden;
          position: relative;
          background: rgba(0,0,0,0.4);
          box-shadow:
            0 30px 70px -28px rgba(0,0,0,0.7),
            0 0 0 1px rgba(255,255,255,0.07);
          transition: transform 0.6s cubic-bezier(0.22,1,0.36,1), box-shadow 0.6s ease;
        }
        .phg-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 38%, hsl(var(--secondary) / 0.25) 100%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          z-index: 3;
        }
        .phg-card:hover {
          transform: translateY(-8px);
          box-shadow:
            0 44px 90px -28px rgba(0,0,0,0.85),
            0 0 0 1px rgba(255,255,255,0.14),
            0 0 60px -12px hsl(var(--secondary) / 0.4);
        }
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
          0%   { transform: scale(1.04) translate3d(0,0,0); }
          50%  { transform: scale(1.10) translate3d(-1.2%,-0.8%,0); }
          100% { transform: scale(1.04) translate3d(0,0,0); }
        }
        .phg-card img { animation: phg-kenburns 24s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .phg-card img { animation: none; }
        }
        .phg-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.15) 42%, transparent 65%);
          pointer-events: none;
        }
        .phg-cap {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          padding: 22px 22px 24px;
          color: white;
          z-index: 2;
        }
        .phg-cap-eyebrow {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: hsl(var(--secondary) / 0.95);
          margin-bottom: 6px;
        }
        .phg-cap-title {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.012em;
          line-height: 1.18;
          text-shadow: 0 2px 14px rgba(0,0,0,0.6);
        }

        .phg-footer {
          padding: clamp(20px, 3vh, 32px) 24px clamp(28px, 4vh, 48px);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          z-index: 4;
        }
        .phg-progress {
          width: min(220px, 40vw);
          height: 2px;
          background: rgba(255,255,255,0.1);
          border-radius: 999px;
          overflow: hidden;
        }
        .phg-progress > span {
          display: block;
          height: 100%;
          background: linear-gradient(90deg, hsl(var(--secondary)), #7cc6ff);
          transform-origin: left center;
          will-change: transform;
        }
        .phg-hint {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.4);
        }

        @media (max-width: 767px) {
          .phg-card { width: 64vw; border-radius: 18px; }
          .phg-title { font-size: clamp(1.75rem, 7vw, 2.25rem); }
          .phg-strip { padding: 0 18vw 0 8vw; }
        }
      `}</style>

      <div ref={sectionRef} className="phg-section" style={{ height: `${SCROLL_VH}vh` }}>
        <div className="phg-sticky">
          <motion.div className="phg-header" style={{ opacity: headerOpacity, y: headerY }}>
            <div className="phg-eyebrow">Så funkar det</div>
            <h2 className="phg-title">
              Yrken som <em>bygger</em> Sverige.
            </h2>
            <p className="phg-sub">
              Från kockar till elektriker, från tränare till undersköterskor.
              Parium är gjort för människorna som faktiskt utför jobben — och företagen som söker dem.
            </p>
          </motion.div>

          <div className="phg-strip-wrap">
            <motion.div ref={stripRef} className="phg-strip" style={{ x }}>
              {items.map((item, i) => {
                // Subtil vertikal stagger: kort 0 = 0, 1 = -16, 2 = +12, … (rotation av 4 värden)
                const offsets = [0, -18, 14, -8];
                const dy = offsets[i % offsets.length];
                return (
                  <div
                    key={i}
                    className="phg-card"
                    style={{ transform: `translateY(${dy}px)` }}
                  >
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
                      loading={i < 3 ? 'eager' : 'lazy'}
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

          <div className="phg-footer">
            <div className="phg-progress" aria-hidden>
              <motion.span style={{ scaleX: progressScale }} />
            </div>
            <div className="phg-hint">Scrolla för att utforska</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PinnedHorizontalGallery;
