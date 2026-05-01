import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInViewAnimation } from '@/hooks/useInViewAnimation';
import { MARQUEE_IMAGES } from './MarqueeStrip';
import LandingV2Button from './Button';

type Trail = {
  id: number;
  x: number;
  y: number;
  rot: number;
  src: string;
};

const PartnerSection = () => {
  const navigate = useNavigate();
  const { ref, inView } = useInViewAnimation();
  const [trails, setTrails] = useState<Trail[]>([]);
  const lastSpawn = useRef(0);
  const idCounter = useRef(0);

  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    const now = performance.now();
    if (now - lastSpawn.current < 80) return;
    lastSpawn.current = now;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const src =
      MARQUEE_IMAGES[Math.floor(Math.random() * MARQUEE_IMAGES.length)];
    const rot = -10 + Math.random() * 20;
    const id = ++idCounter.current;
    setTrails((t) => [...t, { id, x, y, rot, src }]);
    window.setTimeout(() => {
      setTrails((t) => t.filter((tr) => tr.id !== id));
    }, 1000);
  };

  useEffect(() => {
    return () => setTrails([]);
  }, []);

  return (
    <section
      ref={ref}
      className="relative z-10 w-full py-12 px-6"
    >
      <div
        onPointerMove={handleMove}
        className={`relative mx-auto max-w-7xl py-32 md:py-48 rounded-[40px] overflow-hidden ring-1 ring-white/10 ${
          inView ? 'animate-landing-fade-in-up' : 'opacity-0'
        }`}
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        }}
      >
        {trails.map((tr) => (
          <img
            key={tr.id}
            src={tr.src}
            alt=""
            aria-hidden
            className="pointer-events-none absolute h-32 w-32 rounded-2xl object-cover shadow-xl"
            style={{
              left: tr.x - 64,
              top: tr.y - 64,
              transform: `rotate(${tr.rot}deg)`,
              animation: 'landingFadeInUp 1s ease-out forwards reverse',
              opacity: 0,
            }}
          />
        ))}

        <div className="relative z-10 flex flex-col items-center text-center px-6">
          <h2 className="font-pp-mondwest text-[48px] md:text-[64px] lg:text-[80px] text-white mb-12 leading-[0.95]">
            Bygg framtiden med oss
          </h2>
          <LandingV2Button
            variant="primary"
            onClick={() => {
              sessionStorage.setItem('parium-skip-splash', '1');
              navigate('/auth');
            }}
            className="!pl-2 !pr-6 !py-2 gap-3"
          >
            <img
              src="https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=200"
              alt=""
              className="w-10 h-10 rounded-full object-cover"
            />
            <span>Starta din rekrytering</span>
          </LandingV2Button>
        </div>
      </div>
    </section>
  );
};

export default PartnerSection;
