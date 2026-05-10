import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';

import img1 from '@/assets/landing/jobseeker-placeholder-1.jpg';
import img2 from '@/assets/landing/jobseeker-placeholder-2.jpg';
import img3 from '@/assets/landing/jobseeker-placeholder-3.jpg';
import img4 from '@/assets/landing/jobseeker-placeholder-4.jpg';

gsap.registerPlugin(ScrollTrigger, Flip);

// 8 images for the bento grid. Reuses the 4 placeholders for now —
// swap any of these to dedicated assets when the final shoot is in.
const images = [img1, img2, img3, img4, img1, img3, img2, img4];

/**
 * Codrops-style pinned bento → fullscreen zoom.
 *
 * On scroll, the section pins and the 8-cell bento grid Flip-animates
 * from a small centered grid to a much larger grid where each tile
 * fills (close to) the entire viewport — creating the "drag-you-in"
 * cinematic zoom effect.
 *
 * Grid math mirrors the original Codrops pen exactly:
 *   initial: 3 × 32.5vw  /  4 × 23vh   (gap 1vh)
 *   final:   3 × 100vw   /  4 × 49.5vh (gap 1vh)
 */
const BentoZoomGallery = () => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const galleryEl = galleryRef.current;
    const wrapEl = wrapRef.current;
    if (!galleryEl || !wrapEl) return;

    // The landing page uses an inner scrollable container.
    const scroller =
      (wrapEl.closest('[data-landing-scroll-root]') as HTMLElement | null) ?? undefined;

    const items = galleryEl.querySelectorAll<HTMLElement>('.gallery__item');
    let flipCtx: gsap.Context | null = null;

    const build = () => {
      flipCtx?.revert();
      galleryEl.classList.remove('gallery--final');

      flipCtx = gsap.context(() => {
        // GPU hint för smidig scrub
        gsap.set(items, { willChange: 'transform', force3D: true });

        // Capture final state by briefly applying the final layout class.
        galleryEl.classList.add('gallery--final');
        const flipState = Flip.getState(items);
        galleryEl.classList.remove('gallery--final');

        const flip = Flip.to(flipState, {
          simple: true,
          ease: 'none',
        });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: galleryEl,
            scroller,
            start: 'center center',
            end: '+=120%',
            scrub: 0.6,
            pin: wrapEl,
            pinType: scroller ? 'transform' : 'fixed',
            anticipatePin: 1,
            invalidateOnRefresh: true,
            fastScrollEnd: true,
          },
        });

        tl.add(flip);

        return () => {
          gsap.set(items, { clearProps: 'all' });
        };
      }, galleryEl);
    };

    build();
    const onResize = () => build();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      flipCtx?.revert();
    };
  }, []);

  return (
    <>
      <style>{`
        .bz-wrap {
          position: relative;
          width: 100%;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .bz-gallery {
          position: relative;
          width: 100%;
          height: 100%;
          flex: none;
          display: grid;
          gap: 1vh;
          grid-template-columns: repeat(3, 32.5vw);
          grid-template-rows: repeat(4, 23vh);
          justify-content: center;
          align-content: center;
        }
        .bz-gallery.gallery--final {
          grid-template-columns: repeat(3, 100vw);
          grid-template-rows: repeat(4, 49.5vh);
          gap: 1vh;
        }
        .bz-gallery .gallery__item {
          position: relative;
          flex: none;
          overflow: hidden;
          border-radius: 1.25rem;
          background-position: 50% 50%;
          background-size: cover;
        }
        .bz-gallery.gallery--final .gallery__item {
          border-radius: 0;
        }
        .bz-gallery .gallery__item img {
          object-fit: cover;
          width: 100%;
          height: 100%;
          display: block;
        }
        .bz-gallery .gallery__item:nth-child(1) { grid-area: 1 / 1 / 3 / 2; }
        .bz-gallery .gallery__item:nth-child(2) { grid-area: 1 / 2 / 2 / 3; }
        .bz-gallery .gallery__item:nth-child(3) { grid-area: 2 / 2 / 4 / 3; }
        .bz-gallery .gallery__item:nth-child(4) { grid-area: 1 / 3 / 3 / 3; }
        .bz-gallery .gallery__item:nth-child(5) { grid-area: 3 / 1 / 3 / 2; }
        .bz-gallery .gallery__item:nth-child(6) { grid-area: 3 / 3 / 5 / 4; }
        .bz-gallery .gallery__item:nth-child(7) { grid-area: 4 / 1 / 5 / 2; }
        .bz-gallery .gallery__item:nth-child(8) { grid-area: 4 / 2 / 5 / 3; }
      `}</style>

      <div ref={wrapRef} className="bz-wrap">
        <div ref={galleryRef} className="bz-gallery">
          {images.map((src, i) => (
            <div className="gallery__item" key={i}>
              <img src={src} alt="" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default BentoZoomGallery;
