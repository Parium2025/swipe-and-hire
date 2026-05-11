import { useEffect, useRef, useState } from 'react';

import real1 from '@/assets/landing/jobseeker-real-1.jpg';
import real2 from '@/assets/landing/jobseeker-real-2.jpg';
import real3 from '@/assets/landing/jobseeker-real-3.jpg';
import real4 from '@/assets/landing/jobseeker-real-4.jpg';
import real5 from '@/assets/landing/jobseeker-real-5.jpg';
import real6 from '@/assets/landing/jobseeker-real-6.jpg';
import real7 from '@/assets/landing/jobseeker-real-7.jpg';

/**
 * Apple-style cinematic media sequence.
 *
 * The section pins for several viewport heights. As the user scrolls, each
 * media item enters fullscreen with a slow Ken Burns zoom, crossfades into
 * the next, and is paired with a clean caption. No bento, no cropping —
 * one hero at a time, premium and editorial.
 */

type MediaItem = {
  type: 'image' | 'video';
  src: string;
  poster?: string;
  /** object-position for portrait subjects so heads aren't cut off */
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

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
// Smooth s-curve so zoom feels like Apple keynote, not linear
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const BentoZoomGallery = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const sectionEl = sectionRef.current;
    if (!sectionEl) return;

    const scroller =
      (sectionEl.closest('[data-landing-scroll-root]') as HTMLElement | null) ?? window;

    const slides = Array.from(sectionEl.querySelectorAll<HTMLElement>('[data-slide]'));
    const captions = Array.from(sectionEl.querySelectorAll<HTMLElement>('[data-caption]'));
    const progressBar = sectionEl.querySelector<HTMLElement>('[data-progress]');
    const counter = sectionEl.querySelector<HTMLElement>('[data-counter]');
    const total = items.length;
    let frame = 0;

    const tick = () => {
      frame = 0;
      const sectionRect = sectionEl.getBoundingClientRect();
      const viewportTop =
        scroller instanceof Window ? 0 : scroller.getBoundingClientRect().top;
      const viewportHeight =
        scroller instanceof Window ? window.innerHeight : scroller.clientHeight;
      const distance = sectionEl.offsetHeight - viewportHeight;
      const overall = distance <= 0 ? 0 : clamp01((viewportTop - sectionRect.top) / distance);

      // Map overall progress to a per-slide progress.
      // Each slide gets 1/total of the scroll, with a small overlap window
      // around boundaries for the crossfade.
      const slot = 1 / total;
      const overlap = slot * 0.35; // crossfade window between slides

      let newActive = 0;
      let maxOpacity = 0;

      slides.forEach((slide, i) => {
        const start = i * slot;
        const end = start + slot;
        // Local 0..1 progress within this slide's slot (extended by overlap on both sides)
        const p = clamp01((overall - (start - overlap)) / (slot + overlap * 2));

        // Ken Burns: 1.0 -> 1.12 across the slide
        const eased = easeInOut(p);
        const scale = 1.0 + 0.12 * eased;

        // Opacity: ramp in over first overlap window, hold full, ramp out over last overlap window
        let opacity: number;
        if (overall < start) {
          opacity = clamp01((overall - (start - overlap)) / overlap);
        } else if (overall > end) {
          opacity = clamp01(1 - (overall - end) / overlap);
        } else {
          opacity = 1;
        }

        slide.style.opacity = String(opacity);
        slide.style.transform = `scale(${scale.toFixed(4)})`;
        slide.style.zIndex = opacity > 0.01 ? String(10 + i) : '0';

        // Pause off-screen videos to save battery / decode budget
        const video = slide.querySelector('video');
        if (video) {
          if (opacity > 0.4) {
            if (video.paused) video.play().catch(() => {});
          } else {
            if (!video.paused) video.pause();
          }
        }

        if (opacity > maxOpacity) {
          maxOpacity = opacity;
          newActive = i;
        }

        // Caption mirrors the slide's opacity but with a small upward drift
        const caption = captions[i];
        if (caption) {
          const cOpacity = Math.max(0, opacity * 1.15 - 0.15);
          const drift = (1 - opacity) * 16;
          caption.style.opacity = String(cOpacity);
          caption.style.transform = `translateY(${drift}px)`;
        }
      });

      if (progressBar) {
        progressBar.style.transform = `scaleX(${overall.toFixed(4)})`;
      }
      if (counter) {
        counter.textContent = `${String(newActive + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
      }
      setActiveIndex(newActive);
    };

    const requestTick = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    tick();
    scroller.addEventListener('scroll', requestTick, { passive: true });
    window.addEventListener('resize', requestTick);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', requestTick);
      window.removeEventListener('resize', requestTick);
    };
  }, []);

  return (
    <>
      <style>{`
        .cinema-section {
          position: relative;
          width: 100%;
          /* one viewport per slide for slow, deliberate Apple-like pacing */
          height: calc(${items.length} * 100svh);
        }
        .cinema-stage {
          position: sticky;
          top: 0;
          width: 100%;
          height: 100svh;
          overflow: hidden;
          background: transparent;
        }
        .cinema-frame {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(16px, 4vw, 64px);
          padding-bottom: clamp(96px, 18vh, 200px);
        }
        .cinema-card {
          position: relative;
          width: 100%;
          height: 100%;
          max-width: 1280px;
          border-radius: clamp(20px, 3vw, 36px);
          overflow: hidden;
          opacity: 0;
          transform: scale(1);
          transform-origin: center center;
          will-change: transform, opacity;
          box-shadow:
            0 30px 80px -20px rgba(0, 0, 0, 0.55),
            0 0 0 1px rgba(255, 255, 255, 0.06);
          background: rgba(0, 0, 0, 0.4);
        }
        .cinema-card img,
        .cinema-card video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          pointer-events: none;
          user-select: none;
        }
        /* Subtle vignette for cinematic depth */
        .cinema-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%),
            linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 35%);
          pointer-events: none;
        }
        .cinema-captions {
          position: absolute;
          left: 0;
          right: 0;
          bottom: clamp(28px, 6vh, 64px);
          padding: 0 clamp(24px, 6vw, 80px);
          pointer-events: none;
          z-index: 100;
        }
        .cinema-caption {
          position: absolute;
          left: 0;
          right: 0;
          padding: 0 clamp(24px, 6vw, 80px);
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.4s ease, transform 0.4s ease;
          color: white;
          text-align: center;
        }
        .cinema-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 10px;
        }
        .cinema-title {
          font-size: clamp(22px, 4.2vw, 44px);
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.05;
          color: white;
          text-shadow: 0 2px 24px rgba(0, 0, 0, 0.45);
        }
        .cinema-meta {
          position: absolute;
          top: clamp(20px, 4vh, 40px);
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 110;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.6);
        }
        .cinema-progress {
          position: relative;
          width: clamp(80px, 14vw, 160px);
          height: 2px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 999px;
          overflow: hidden;
        }
        .cinema-progress::after {
          content: '';
          display: block;
          width: 100%;
          height: 100%;
          background: white;
          transform-origin: left center;
          transform: scaleX(0);
          transition: transform 0.15s linear;
        }
        .cinema-progress[data-progress] {
          /* the bar inside takes the data-progress transform via JS using ::after... fallback below */
        }
        /* We can't transform pseudo-elements from JS, so use a real child instead */

        @media (max-width: 767px) {
          .cinema-frame {
            padding: 12px;
            padding-bottom: clamp(120px, 22vh, 180px);
          }
          .cinema-card {
            border-radius: 20px;
          }
        }
      `}</style>

      <section ref={sectionRef} className="cinema-section" aria-label="Möt människorna bakom yrkena">
        <div className="cinema-stage">
          {/* Top meta: progress + counter */}
          <div className="cinema-meta">
            <span data-counter>01 / {String(items.length).padStart(2, '0')}</span>
            <div className="cinema-progress">
              <div
                data-progress
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'white',
                  transformOrigin: 'left center',
                  transform: 'scaleX(0)',
                  transition: 'transform 0.15s linear',
                }}
              />
            </div>
          </div>

          {/* Stacked media slides */}
          {items.map((item, i) => (
            <div className="cinema-frame" key={i} data-slide style={{ opacity: 0 }}>
              <div className="cinema-card">
                {item.type === 'video' ? (
                  <video
                    src={item.src}
                    poster={item.poster}
                    muted
                    loop
                    playsInline
                    preload={i < 2 ? 'auto' : 'metadata'}
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
              </div>
            </div>
          ))}

          {/* Captions overlay (one per slide, fades with its slide) */}
          <div className="cinema-captions" aria-live="polite">
            {items.map((item, i) => (
              <div className="cinema-caption" key={i} data-caption>
                <div className="cinema-eyebrow">{item.eyebrow}</div>
                <div className="cinema-title">{item.title}</div>
              </div>
            ))}
          </div>

          {/* SR-only active label */}
          <span className="sr-only">{items[activeIndex]?.title}</span>
        </div>
      </section>
    </>
  );
};

export default BentoZoomGallery;
