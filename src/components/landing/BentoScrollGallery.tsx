import { useEffect, useRef, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(ScrollTrigger, Flip);

/**
 * BentoScrollGallery
 *
 * GSAP Flip-driven bento grid that expands to a full-screen layout as the user
 * scrolls. Mirrors the CodePen reference but uses Parium tokens.
 *
 * iOS Safari hardening:
 *  - scrollerProxy bridges the custom scroll container to ScrollTrigger so
 *    momentum scroll & rubber-banding don't desync the pinned element.
 *  - pinType: 'transform' avoids the broken `position: fixed` behavior inside
 *    nested scrollers (which iOS handles incorrectly).
 *  - scrub: 0.5 smooths fast finger flings without feeling laggy.
 *  - touchmove on the scroller forces ScrollTrigger.update() so animation
 *    keeps up with iOS's throttled scroll events during momentum.
 *  - Resize is debounced and ignores tiny height changes from the URL bar
 *    showing/hiding, which would otherwise re-pin mid-scroll.
 *  - will-change + translateZ promotes tiles to their own GPU layer.
 */

type Props = {
  scrollContainerRef?: RefObject<HTMLDivElement>;
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

export const BentoScrollGallery = ({ scrollContainerRef }: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const galleryElement = galleryRef.current;
    const wrapElement = wrapRef.current;
    if (!galleryElement || !wrapElement) return;

    const customScroller = scrollContainerRef?.current ?? null;
    const scrollerTarget: Element | Window = customScroller ?? window;

    // Register scrollerProxy ONCE per scroller so ScrollTrigger reads
    // scroll position from the right element on iOS.
    if (customScroller) {
      ScrollTrigger.scrollerProxy(customScroller, {
        scrollTop(value) {
          if (arguments.length && value !== undefined) {
            customScroller.scrollTop = value;
          }
          return customScroller.scrollTop;
        },
        getBoundingClientRect() {
          return {
            top: 0,
            left: 0,
            width: window.innerWidth,
            height: window.innerHeight,
          };
        },
        // pinType 'transform' is required for ANY non-window scroller on iOS.
        pinType: 'transform',
      });
    }

    let flipCtx: gsap.Context | null = null;

    const createTween = () => {
      const galleryItems = galleryElement.querySelectorAll('.gallery__item');

      flipCtx?.revert();
      galleryElement.classList.remove('gallery--final');

      flipCtx = gsap.context(() => {
        // Promote tiles to their own GPU layer for smoother iOS rendering.
        gsap.set(galleryItems, {
          willChange: 'transform',
          force3D: true,
          backfaceVisibility: 'hidden',
        });

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
            scroller: scrollerTarget,
            start: 'center center',
            end: '+=100%',
            // Smoothing scrub: catches up over 0.5s after fast finger flings
            // so iOS momentum doesn't cause animation snap.
            scrub: 0.5,
            pin: wrapElement,
            pinType: customScroller ? 'transform' : 'fixed',
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        tl.add(flip);
      });

      ScrollTrigger.refresh();
    };

    // Wait for fonts + layout settle before first measurement to avoid
    // mis-pinned positions on iOS.
    const startWhenReady = () => {
      if (document.readyState === 'complete') {
        // Two RAFs ensures any final layout pass (Safari URL bar, fonts) is in.
        requestAnimationFrame(() => requestAnimationFrame(createTween));
      } else {
        window.addEventListener('load', startWhenReady, { once: true });
      }
    };
    startWhenReady();

    // ── iOS touchmove sync ───────────────────────────────────────────────
    // iOS throttles `scroll` events during momentum; pulling ScrollTrigger
    // forward on every touchmove keeps the pinned animation in lock-step.
    const handleTouch = () => ScrollTrigger.update();
    if (customScroller) {
      customScroller.addEventListener('touchmove', handleTouch, { passive: true });
      customScroller.addEventListener('touchstart', handleTouch, { passive: true });
    }

    // ── Debounced resize that ignores iOS URL-bar jitter ─────────────────
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    let resizeTimer: number | null = null;

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const widthChanged = w !== lastWidth;
      // Ignore height-only changes <= 120px (URL bar show/hide is ~80-100px).
      const significantHeightChange = Math.abs(h - lastHeight) > 120;

      if (!widthChanged && !significantHeightChange) return;

      lastWidth = w;
      lastHeight = h;

      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        createTween();
      }, 180);
    };

    window.addEventListener('resize', handleResize);
    // visualViewport gives more accurate iOS resize signals (keyboard, zoom)
    window.visualViewport?.addEventListener('resize', handleResize);

    // Orientation change requires a hard refresh AFTER the new layout settles.
    const handleOrientation = () => {
      window.setTimeout(createTween, 350);
    };
    window.addEventListener('orientationchange', handleOrientation);

    return () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientation);
      if (customScroller) {
        customScroller.removeEventListener('touchmove', handleTouch);
        customScroller.removeEventListener('touchstart', handleTouch);
      }
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
