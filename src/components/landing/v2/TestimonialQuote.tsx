import { useEffect, useRef, useState } from 'react';
import { Quote } from 'lucide-react';
import { useInViewAnimation } from '@/hooks/useInViewAnimation';

const PARALLAX_IMG =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260330_103804_7aa5494f-4d5b-432e-9dc7-20715275f143.png&w=1280&q=85';

const TestimonialQuote = () => {
  const { ref, inView } = useInViewAnimation();
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const wrap = imgWrapRef.current;
    if (!wrap) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = wrap.getBoundingClientRect();
        const vh = window.innerHeight;
        const progress = 1 - (rect.top + rect.height / 2) / (vh + rect.height / 2);
        const clamped = Math.max(0, Math.min(1, progress));
        setOffset((clamped - 0.5) * 200);
      });
    };
    const scroller =
      (document.querySelector('.landing-v2-scroll') as HTMLElement) || window;
    scroller.addEventListener('scroll', onScroll, { passive: true } as any);
    onScroll();
    return () => {
      scroller.removeEventListener('scroll', onScroll as any);
      cancelAnimationFrame(raf);
    };
  }, []);

  const fade = (d: number) =>
    inView ? 'animate-landing-fade-in-up' : 'opacity-0';
  const sd = (d: number) => ({ animationDelay: `${d}s` });

  return (
    <section
      ref={ref}
      className="relative z-10 mx-auto w-full max-w-2xl py-12 px-6 text-center"
    >
      <div className={`flex justify-center mb-6 ${fade(0.1)}`} style={sd(0.1)}>
        <Quote className="w-6 h-6 text-white" />
      </div>

      <h3
        className={`font-pp-neue text-[32px] md:text-[40px] lg:text-[44px] leading-[1.1] text-white tracking-tight ${fade(
          0.2,
        )}`}
        style={sd(0.2)}
      >
        Jag byggde Parium för att{' '}
        <span className="font-pp-mondwest italic">rekrytering</span> ska kännas
        som magi — inte mejlbilagor.
      </h3>

      <p
        className={`mt-6 text-sm italic text-white/70 ${fade(0.3)}`}
        style={sd(0.3)}
      >
        — Grundaren, Parium
      </p>

      <div
        className={`mt-10 flex items-center justify-center gap-8 flex-wrap ${fade(
          0.4,
        )}`}
        style={sd(0.4)}
      >
        <span className="text-[24px] font-medium text-white/90 w-[100px]">Spotify</span>
        <span className="text-[24px] font-medium text-white/90 w-[83px]">IKEA</span>
        <span className="text-[24px] font-medium text-white/90 w-[110px]">Klarna</span>
      </div>

      <div
        ref={imgWrapRef}
        className={`mt-12 flex justify-center ${fade(0.5)}`}
        style={sd(0.5)}
      >
        <img
          src={PARALLAX_IMG}
          alt="Grundaren av Parium"
          loading="lazy"
          className="w-full max-w-xs rounded-2xl shadow-lg ring-1 ring-white/10"
          style={{
            transform: `translateY(${offset}px)`,
            transition: 'transform 0.05s linear',
            willChange: 'transform',
          }}
        />
      </div>
    </section>
  );
};

export default TestimonialQuote;
