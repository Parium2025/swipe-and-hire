import { useEffect, useRef } from 'react';

import img1 from '@/assets/landing/jobseeker-placeholder-1.jpg';
import img2 from '@/assets/landing/jobseeker-placeholder-2.jpg';
import img3 from '@/assets/landing/jobseeker-placeholder-3.jpg';
import img4 from '@/assets/landing/jobseeker-placeholder-4.jpg';
import real1 from '@/assets/landing/jobseeker-real-1.jpg';
import real2 from '@/assets/landing/jobseeker-real-2.jpg';
import real3 from '@/assets/landing/jobseeker-real-3.jpg';
import real4 from '@/assets/landing/jobseeker-real-4.jpg';

// 8 images for the bento grid. Real photos in slots 0, 3, 4 and 5,
// rest are placeholders until final shoot is in.
type MediaItem = { type: 'image' | 'video'; src: string; poster?: string };
const images: MediaItem[] = [
  { type: 'image', src: real1 },
  { type: 'image', src: img2 },
  { type: 'image', src: img3 },
  { type: 'image', src: real2 },
  { type: 'image', src: real3 },
  { type: 'video', src: '/landing/jobseeker-real-4.mp4', poster: real4 },
  { type: 'image', src: img2 },
  { type: 'image', src: img4 },
];

// Per-image object-position so faces/heads aren't cropped out by `object-fit: cover`.
// Real photos have subjects centered horizontally with head in the upper portion,
// so we anchor toward the top.
const imagePositions: string[] = [
  '50% 25%', // real1 — fitness coach, head upper-center
  '50% 50%',
  '50% 50%',
  '50% 30%', // real2 — broker, head upper-center
  '50% 22%', // real3 — chef, head upper-center
  '50% 28%', // real4 — electrician, head upper-center
  '50% 50%',
  '50% 50%',
];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

type BentoArea = {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
};

type TileRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const areas: BentoArea[] = [
  { col: 0, row: 0, colSpan: 1, rowSpan: 2 },
  { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
  { col: 1, row: 1, colSpan: 1, rowSpan: 2 },
  { col: 2, row: 0, colSpan: 1, rowSpan: 2 },
  { col: 0, row: 2, colSpan: 1, rowSpan: 1 },
  { col: 2, row: 2, colSpan: 1, rowSpan: 2 },
  { col: 0, row: 3, colSpan: 1, rowSpan: 1 },
  { col: 1, row: 3, colSpan: 1, rowSpan: 1 },
];

const getTileRect = (
  area: BentoArea,
  startX: number,
  startY: number,
  columnWidth: number,
  rowHeight: number,
  gap: number,
): TileRect => ({
  x: startX + area.col * (columnWidth + gap),
  y: startY + area.row * (rowHeight + gap),
  width: area.colSpan * columnWidth + (area.colSpan - 1) * gap,
  height: area.rowSpan * rowHeight + (area.rowSpan - 1) * gap,
});

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
  const sectionRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sectionEl = sectionRef.current;
    const stageEl = stageRef.current;
    if (!sectionEl || !stageEl) return;

    // The landing page uses an inner scrollable container.
    const scroller =
      (sectionEl.closest('[data-landing-scroll-root]') as HTMLElement | null) ?? window;

    const items = Array.from(stageEl.querySelectorAll<HTMLElement>('.gallery__item'));
    let fromRects: TileRect[] = [];
    let toRects: TileRect[] = [];
    let targetProgress = 0;
    let currentProgress = 0;
    let frame = 0;

    const calculateLayout = () => {
      const vw = stageEl.clientWidth;
      const vh = stageEl.clientHeight;
      const gap = vh * 0.01;

      const fromColumn = vw * 0.325;
      const fromRow = vh * 0.23;
      const toColumn = vw;
      const toRow = vh * 0.495;

      const fromX = (vw - (fromColumn * 3 + gap * 2)) / 2;
      const fromY = (vh - (fromRow * 4 + gap * 3)) / 2;
      const toX = (vw - (toColumn * 3 + gap * 2)) / 2;
      const toY = (vh - (toRow * 4 + gap * 3)) / 2;

      fromRects = areas.map((area) => getTileRect(area, fromX, fromY, fromColumn, fromRow, gap));
      toRects = areas.map((area) => getTileRect(area, toX, toY, toColumn, toRow, gap));

      items.forEach((item, index) => {
        const rect = fromRects[index];
        item.style.width = `${rect.width}px`;
        item.style.height = `${rect.height}px`;
      });
    };

    // easeInOutCubic — gentle in the middle, no abrupt scaling jump
    const ease = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const render = (progress: number) => {
      const eased = ease(progress);
      items.forEach((item, index) => {
        const from = fromRects[index];
        const to = toRects[index];
        if (!from || !to) return;

        const x = from.x + (to.x - from.x) * eased;
        const y = from.y + (to.y - from.y) * eased;
        const scaleX = (from.width + (to.width - from.width) * eased) / from.width;
        const scaleY = (from.height + (to.height - from.height) * eased) / from.height;
        const radius = 20 * (1 - eased);

        item.style.transform = `translate3d(${x}px, ${y}px, 0) scale3d(${scaleX}, ${scaleY}, 1)`;
        item.style.borderRadius = `${radius}px`;
      });
    };

    const getProgress = () => {
      const sectionRect = sectionEl.getBoundingClientRect();
      const viewportTop = scroller instanceof Window ? 0 : scroller.getBoundingClientRect().top;
      const viewportHeight = scroller instanceof Window ? window.innerHeight : scroller.clientHeight;
      const distance = sectionEl.offsetHeight - viewportHeight;

      return distance <= 0 ? 0 : clamp01((viewportTop - sectionRect.top) / distance);
    };

    const tick = () => {
      currentProgress += (targetProgress - currentProgress) * 0.18;

      if (Math.abs(targetProgress - currentProgress) < 0.001) {
        currentProgress = targetProgress;
      }

      render(currentProgress);
      frame = currentProgress === targetProgress ? 0 : requestAnimationFrame(tick);
    };

    const requestRender = () => {
      targetProgress = getProgress();
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onResize = () => {
      calculateLayout();
      targetProgress = getProgress();
      currentProgress = targetProgress;
      render(currentProgress);
    };

    calculateLayout();
    onResize();

    scroller.addEventListener('scroll', requestRender, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', requestRender);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <>
      <style>{`
        .bz-section {
          position: relative;
          width: 100%;
          height: 380svh;
        }
        .bz-stage {
          position: sticky;
          top: 0;
          width: 100%;
          height: 100svh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          contain: layout paint style;
        }
        .bz-gallery {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .bz-gallery .gallery__item {
          position: absolute;
          left: 0;
          top: 0;
          flex: none;
          overflow: hidden;
          border-radius: 20px;
          background-position: 50% 50%;
          background-size: cover;
          backface-visibility: hidden;
          contain: paint;
          transform-origin: 0 0;
          transform: translate3d(0, 0, 0);
          will-change: transform, border-radius;
        }
        .bz-gallery .gallery__item img {
          object-fit: cover;
          width: 100%;
          height: 100%;
          display: block;
          pointer-events: none;
          user-select: none;
        }
        @media (max-width: 767px) {
          .bz-section { height: 320svh; }
        }
      `}</style>

      <div ref={sectionRef} className="bz-section">
        <div ref={stageRef} className="bz-stage">
          <div className="bz-gallery">
            {images.map((media, i) => (
              <div className="gallery__item" key={i}>
                {media.type === 'video' ? (
                  <video
                    src={media.src}
                    poster={media.poster}
                    muted
                    autoPlay
                    loop
                    playsInline
                    preload="auto"
                    style={{ objectPosition: imagePositions[i] ?? '50% 50%', objectFit: 'cover', width: '100%', height: '100%', display: 'block' }}
                  />
                ) : (
                  <img
                    src={media.src}
                    alt=""
                    loading={i < 4 ? 'eager' : 'lazy'}
                    decoding="async"
                    draggable={false}
                    style={{ objectPosition: imagePositions[i] ?? '50% 50%' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default BentoZoomGallery;
