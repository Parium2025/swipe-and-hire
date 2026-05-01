import { useEffect, useRef, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(ScrollTrigger, Flip);

/**
 * BentoScrollGallery
 *
 * GSAP Flip-driven bento grid that expands to a full-screen layout as the user
 * scrolls. Mirrors the CodePen reference but uses Parium colors and tokens.
 *
 * Layout: 3 columns × 4 rows of placeholder tiles. Replace `placeholders`
 * with real images later — the scroll system stays the same.
 */

type Props = {
  scrollContainerRef?: RefObject<HTMLDivElement>;
};

// Placeholder tiles — replace `src` with real images later.
// Using Parium-toned gradients as fallbacks so the system reads correctly
// before real assets land.
const placeholders = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  // Subtle Parium-tinted gradients per tile
  gradient: [
    'linear-gradient(135deg, hsl(215 100% 18%), hsl(200 100% 35%))',
    'linear-gradient(160deg, hsl(200 100% 40%), hsl(215 100% 14%))',
    'linear-gradient(120deg, hsl(215 100% 22%), hsl(200 100% 50%))',
    'linear-gradient(200deg, hsl(200 100% 30%), hsl(215 100% 10%))',
    'linear-gradient(140deg, hsl(215 100% 16%), hsl(200 100% 45%))',
    'linear-gradient(180deg, hsl(200 100% 38%), hsl(215 100% 18%))',
    'linear-gradient(150deg, hsl(215 100% 20%), hsl(200 100% 42%))',
    'linear-gradient(170deg, hsl(200 100% 34%), hsl(215 100% 14%))',
  ][i],
}));

export const BentoScrollGallery = ({ scrollContainerRef }: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const galleryElement = galleryRef.current;
    const wrapElement = wrapRef.current;
    if (!galleryElement || !wrapElement) return;

    const scroller = scrollContainerRef?.current ?? window;

    let flipCtx: gsap.Context | null = null;

    const createTween = () => {
      const galleryItems = galleryElement.querySelectorAll('.gallery__item');

      flipCtx?.revert();
      galleryElement.classList.remove('gallery--final');

      flipCtx = gsap.context(() => {
        // Capture target (final) state
        galleryElement.classList.add('gallery--final');
        const flipState = Flip.getState(galleryItems);
        galleryElement.classList.remove('gallery--final');

        const flip = Flip.to(flipState, {
          simple: true,
          ease: 'expoScale(1, 5)',
        });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: galleryElement,
            scroller: scroller as Element | Window,
            start: 'center center',
            end: '+=100%',
            scrub: true,
            pin: wrapElement,
          },
        });

        tl.add(flip);
      });

      ScrollTrigger.refresh();
    };

    createTween();

    const handleResize = () => createTween();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      flipCtx?.revert();
    };
  }, [scrollContainerRef]);

  return (
    <section className="bento-scroll-section relative" aria-label="Parium showcase">
      <div ref={wrapRef} className="gallery-wrap">
        <div
          ref={galleryRef}
          id="bento-gallery"
          className="gallery gallery--bento"
        >
          {placeholders.map((p) => (
            <div
              key={p.id}
              className="gallery__item"
              style={{ background: p.gradient }}
            >
              {/* Replace this inner block with <img src=... /> when real assets are ready */}
              <div className="gallery__placeholder">
                <span>{p.id}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BentoScrollGallery;
