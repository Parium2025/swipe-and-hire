import { useEffect, useRef, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(ScrollTrigger, Flip);

/**
 * BentoScrollGallery — bento grid that expands via GSAP Flip on scroll.
 *
 * IMPORTANT: this app's <html> and <body> have `overflow:hidden`, so all
 * scrolling on Landing happens inside a custom container (passed as
 * `scrollerRef`). We register that element with ScrollTrigger via
 * `scrollerProxy` and use `pinType: 'transform'` so pin works correctly
 * inside the non-window scroller (and on iOS Safari).
 */

type Props = {
  scrollerRef: RefObject<HTMLDivElement>;
};

const placeholders = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
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

export const BentoScrollGallery = ({ scrollerRef }: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const galleryElement = galleryRef.current;
    const wrapElement = wrapRef.current;
    const scroller = scrollerRef.current;
    if (!galleryElement || !wrapElement || !scroller) return;

    // Bridge the custom scroller to ScrollTrigger
    ScrollTrigger.scrollerProxy(scroller, {
      scrollTop(value) {
        if (arguments.length && value !== undefined) {
          scroller.scrollTop = value;
        }
        return scroller.scrollTop;
      },
      getBoundingClientRect() {
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      },
      pinType: 'transform',
    });

    // Forward scroller's scroll events to ScrollTrigger
    const onScroll = () => ScrollTrigger.update();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    scroller.addEventListener('touchmove', onScroll, { passive: true });

    let flipCtx: gsap.Context | null = null;

    const createTween = () => {
      const galleryItems = galleryElement.querySelectorAll('.gallery__item');

      flipCtx?.revert();
      galleryElement.classList.remove('gallery--final');

      flipCtx = gsap.context(() => {
        // Capture target (final-grid) state via temporary class swap
        galleryElement.classList.add('gallery--final');
        const flipState = Flip.getState(galleryItems);
        galleryElement.classList.remove('gallery--final');

        const flip = Flip.to(flipState, {
          simple: true,
          ease: 'expoScale(1, 5)',
        });

        gsap.timeline({
          scrollTrigger: {
            trigger: galleryElement,
            scroller,
            start: 'center center',
            end: '+=100%',
            scrub: 0.5,
            pin: wrapElement,
            pinType: 'transform',
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        }).add(flip);

        ScrollTrigger.refresh();
      });
    };

    // Wait for layout to settle
    requestAnimationFrame(() => requestAnimationFrame(createTween));

    // Debounced resize
    let lastW = window.innerWidth;
    let lastH = window.innerHeight;
    let timer: number | null = null;
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w === lastW && Math.abs(h - lastH) <= 120) return;
      lastW = w;
      lastH = h;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(createTween, 180);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      scroller.removeEventListener('scroll', onScroll);
      scroller.removeEventListener('touchmove', onScroll);
      if (timer) window.clearTimeout(timer);
      flipCtx?.revert();
    };
  }, [scrollerRef]);

  return (
    <section className="bento-scroll-section relative" aria-label="Parium showcase">
      <div ref={wrapRef} className="gallery-wrap">
        <div ref={galleryRef} className="gallery gallery--bento">
          {placeholders.map((p) => (
            <div
              key={p.id}
              className="gallery__item"
              style={{ background: p.gradient }}
            >
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
