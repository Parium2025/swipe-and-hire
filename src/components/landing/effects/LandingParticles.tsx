import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type LandingParticlesProps = {
  className?: string;
  quantity?: number;
  color?: string; // rgb triplet "255,255,255"
  staticity?: number;
  ease?: number;
};

/**
 * Lightweight drifting particle field rendered on a canvas. Atmospheric depth
 * for hero / dark sections. Respects prefers-reduced-motion (no animation).
 * Self-contained — no external deps.
 */
const LandingParticles = ({
  className,
  quantity = 50,
  color = '255,255,255',
  staticity = 50,
  ease = 50,
}: LandingParticlesProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0;
    let h = 0;
    let particles: Array<{
      x: number; y: number; tx: number; ty: number;
      size: number; alpha: number; tAlpha: number; dx: number; dy: number;
      mag: number;
    }> = [];

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
      init();
    };

    const rand = (min: number, max: number) => Math.random() * (max - min) + min;

    const init = () => {
      particles = Array.from({ length: quantity }).map(() => ({
        x: rand(0, w),
        y: rand(0, h),
        tx: 0,
        ty: 0,
        size: rand(0.4, 1.6),
        alpha: 0,
        tAlpha: rand(0.18, 0.7),
        dx: rand(-0.12, 0.12),
        dy: rand(-0.12, 0.12),
        mag: rand(0.4, 1.2),
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        // ease alpha in
        p.alpha += (p.tAlpha - p.alpha) * 0.02;

        // drift
        p.x += p.dx;
        p.y += p.dy;

        // soft wrap
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${p.alpha})`;
        ctx.fill();
      }
      if (!reduced) rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    if (reduced) {
      // single static frame
      for (const p of particles) p.alpha = p.tAlpha;
      draw();
    } else {
      rafRef.current = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(wrapper);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantity, color]);

  return (
    <div ref={wrapperRef} className={cn('pointer-events-none absolute inset-0', className)} aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default LandingParticles;
