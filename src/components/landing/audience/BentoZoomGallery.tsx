import { useEffect, useRef, useState, useCallback } from 'react';

import real1 from '@/assets/landing/jobseeker-real-1.jpg';
import real2 from '@/assets/landing/jobseeker-real-2.jpg';
import real3 from '@/assets/landing/jobseeker-real-3.jpg';
import real4 from '@/assets/landing/jobseeker-real-4.jpg';
import real5 from '@/assets/landing/jobseeker-real-5.jpg';
import real6 from '@/assets/landing/jobseeker-real-6.jpg';
import real7 from '@/assets/landing/jobseeker-real-7.jpg';

/**
 * Premium horizontal snap-carousel.
 *
 * Motion model (Apple-feel):
 *  - Each slide's transform is a continuous function of its distance from the
 *    viewport center (scale, opacity, slight translateX parallax). This makes
 *    swipes/scroll feel physical instead of "snap then jump".
 *  - All videos autoplay muted+loop so motion lives across every card.
 *  - A subtle Ken Burns drift gives still images life.
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

const AUTOPLAY_MS = 5500;

const BentoZoomGallery = () => {
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);
  const inViewRef = useRef(true);
  const interactingRef = useRef(false);
  const snapTimerRef = useRef<number | null>(null);

  const scrollToIndex = useCallback((i: number, smooth = true) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[i] as HTMLElement | undefined;
    if (!slide) return;
    const left = slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2;
    track.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Continuous, per-slide transforms tied to scroll position (Apple feel).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;

    const update = () => {
      raf = 0;
      const center = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      const slides = Array.from(track.children) as HTMLElement[];
      slides.forEach((el, i) => {
        const mid = el.offsetLeft + el.clientWidth / 2;
        const d = mid - center;
        const w = el.clientWidth || 1;
        // Normalised distance from center, clamped to [-1.4, 1.4]
        const t = Math.max(-1.4, Math.min(1.4, d / w));
        const abs = Math.abs(t);
        // Smooth easing curve
        const ease = 1 - Math.pow(1 - Math.min(abs, 1), 2);
        const scale = 1 - ease * 0.12;          // 1 → 0.88
        const opacity = 1 - ease * 0.55;        // 1 → 0.45
        const translate = -t * 18;              // subtle parallax (px)
        el.style.transform = `translate3d(${translate}px,0,0) scale(${scale})`;
        el.style.opacity = String(opacity);
        if (abs < bestDist) {
          bestDist = abs;
          best = i;
        }
      });
      setActive((prev) => (prev === best ? prev : best));
    };

    const scheduleSnap = () => {
      if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = window.setTimeout(() => {
        if (interactingRef.current) return;
        // find nearest slide to center and softly scroll there
        const center = track.scrollLeft + track.clientWidth / 2;
        let nearest = 0;
        let nd = Infinity;
        const sl = Array.from(track.children) as HTMLElement[];
        sl.forEach((el, i) => {
          const mid = el.offsetLeft + el.clientWidth / 2;
          const d = Math.abs(mid - center);
          if (d < nd) { nd = d; nearest = i; }
        });
        scrollToIndex(nearest);
      }, 120);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
      scheduleSnap();
    };

    track.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
    return () => {
      track.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Pause autoplay when section is off-screen
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        inViewRef.current = entries[0]?.isIntersecting ?? false;
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Autoplay
  useEffect(() => {
    const id = window.setInterval(() => {
      if (pausedRef.current || !inViewRef.current) return;
      const next = (active + 1) % items.length;
      scrollToIndex(next);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [active, scrollToIndex]);

  // Center first slide on mount
  useEffect(() => {
    const t = window.setTimeout(() => scrollToIndex(0, false), 0);
    return () => window.clearTimeout(t);
  }, [scrollToIndex]);

  // Make sure every video keeps playing (muted+loop) — gives motion across all cards.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const videos = Array.from(track.querySelectorAll('video'));
    const tryPlayAll = () => {
      videos.forEach((v) => {
        v.muted = true;
        v.playsInline = true;
        const p = v.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      });
    };
    tryPlayAll();
    const onVis = () => { if (document.visibilityState === 'visible') tryPlayAll(); };
    document.addEventListener('visibilitychange', onVis);
    const onFirstTouch = () => tryPlayAll();
    window.addEventListener('touchstart', onFirstTouch, { passive: true, once: true });
    window.addEventListener('pointerdown', onFirstTouch, { once: true });
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('touchstart', onFirstTouch);
      window.removeEventListener('pointerdown', onFirstTouch);
    };
  }, []);

  const pause = () => { pausedRef.current = true; interactingRef.current = true; };
  const resume = () => {
    pausedRef.current = false;
    interactingRef.current = false;
    if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
    snapTimerRef.current = window.setTimeout(() => {
      const track = trackRef.current;
      if (!track) return;
      const center = track.scrollLeft + track.clientWidth / 2;
      let nearest = 0;
      let nd = Infinity;
      const sl = Array.from(track.children) as HTMLElement[];
      sl.forEach((el, i) => {
        const mid = el.offsetLeft + el.clientWidth / 2;
        const d = Math.abs(mid - center);
        if (d < nd) { nd = d; nearest = i; }
      });
      scrollToIndex(nearest);
    }, 80);
  };

  return (
    <>
      <style>{`
        .pcar-section {
          position: relative;
          width: 100%;
          padding: clamp(40px, 8vw, 96px) 0;
        }
        .pcar-track {
          display: flex;
          gap: clamp(12px, 2vw, 24px);
          overflow-x: auto;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
          overscroll-behavior-x: contain;
          padding: clamp(20px, 4vw, 40px) max(16px, calc((100% - min(720px, 88vw)) / 2));
          scrollbar-width: none;
        }
        .pcar-track::-webkit-scrollbar { display: none; }

        .pcar-slide {
          flex: 0 0 min(720px, 88vw);
          scroll-snap-align: center;
          scroll-snap-stop: always;
          aspect-ratio: 4 / 5;
          position: relative;
          border-radius: clamp(20px, 2.4vw, 32px);
          overflow: hidden;
          background: rgba(0, 0, 0, 0.4);
          box-shadow:
            0 20px 50px -20px rgba(0, 0, 0, 0.55),
            0 0 0 1px rgba(255, 255, 255, 0.06);
          transform: translate3d(0,0,0) scale(0.88);
          opacity: 0.45;
          will-change: transform, opacity;
          transition: box-shadow 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .pcar-slide.is-active {
          box-shadow:
            0 35px 80px -25px rgba(0, 0, 0, 0.75),
            0 0 0 1px rgba(255, 255, 255, 0.1);
        }

        .pcar-slide img,
        .pcar-slide video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          pointer-events: none;
          user-select: none;
        }

        /* Subtle Ken Burns drift on images — gives life without distraction */
        @keyframes pcar-kenburns {
          0%   { transform: scale(1.04) translate3d(0, 0, 0); }
          50%  { transform: scale(1.10) translate3d(-1.2%, -0.8%, 0); }
          100% { transform: scale(1.04) translate3d(0, 0, 0); }
        }
        .pcar-slide img {
          animation: pcar-kenburns 18s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .pcar-slide img { animation: none; }
        }

        .pcar-slide::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%),
            linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 45%);
          pointer-events: none;
        }

        .pcar-caption {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          padding: clamp(20px, 3vw, 32px) clamp(20px, 3vw, 32px) clamp(24px, 3.5vw, 40px);
          color: white;
          z-index: 2;
          opacity: 1;
          transform: translateY(0);
        }
        .pcar-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.75);
          margin-bottom: 8px;
        }
        .pcar-title {
          font-size: clamp(20px, 2.6vw, 32px);
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.1;
          text-shadow: 0 2px 18px rgba(0, 0, 0, 0.5);
        }

        .pcar-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin-top: clamp(16px, 2.4vw, 24px);
          padding: 0 16px;
        }
        .pcar-arrow {
          width: 44px;
          height: 44px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: white;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          transition: background 0.2s ease, transform 0.2s ease;
          cursor: pointer;
        }
        .pcar-arrow:hover { background: rgba(255, 255, 255, 0.16); }
        .pcar-arrow:active { transform: scale(0.94); }

        .pcar-dots {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .pcar-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.25);
          transition: width 0.3s ease, background 0.3s ease;
          cursor: pointer;
          border: none;
          padding: 0;
        }
        .pcar-dot.is-active {
          width: 22px;
          background: rgba(255, 255, 255, 0.95);
        }

        @media (max-width: 767px) {
          .pcar-slide { flex-basis: 84vw; aspect-ratio: 3 / 4; }
        }
      `}</style>

      <section
        ref={sectionRef}
        className="pcar-section"
        aria-label="Möt människorna bakom yrkena"
        onMouseEnter={pause}
        onMouseLeave={resume}
        onTouchStart={pause}
        onTouchEnd={resume}
      >
        <div ref={trackRef} className="pcar-track">
          {items.map((item, i) => (
            <div
              key={i}
              className={`pcar-slide${i === active ? ' is-active' : ''}`}
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
                  loading={i < 2 ? 'eager' : 'lazy'}
                  decoding="async"
                  draggable={false}
                  style={{ objectPosition: item.position ?? '50% 50%' }}
                />
              )}
              <div className="pcar-caption">
                <div className="pcar-eyebrow">{item.eyebrow}</div>
                <div className="pcar-title">{item.title}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="pcar-controls">
          <button
            type="button"
            className="pcar-arrow"
            aria-label="Föregående"
            onClick={() => scrollToIndex((active - 1 + items.length) % items.length)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>

          <div className="pcar-dots" role="tablist">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Gå till bild ${i + 1}`}
                className={`pcar-dot${i === active ? ' is-active' : ''}`}
                onClick={() => scrollToIndex(i)}
              />
            ))}
          </div>

          <button
            type="button"
            className="pcar-arrow"
            aria-label="Nästa"
            onClick={() => scrollToIndex((active + 1) % items.length)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </section>
    </>
  );
};

export default BentoZoomGallery;
