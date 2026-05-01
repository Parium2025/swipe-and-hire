import { useEffect, useRef, useState } from 'react';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { useInViewAnimation } from '@/hooks/useInViewAnimation';

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  avatar: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'Vi fick fyra kvalificerade kandidater på 48 timmar. Ingen annan tjänst kommer i närheten.',
    name: 'Marcus Andersson',
    role: 'CEO, Datalager AB',
    avatar:
      'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
  {
    quote:
      'Parium hjälpte oss bygga vårt grundningsteam. Bästa rekryteringsverktyget vi testat.',
    name: 'Alex Wu',
    role: 'Grundare, Nexgate',
    avatar:
      'https://images.pexels.com/photos/2182970/pexels-photo-2182970.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
  {
    quote:
      'Vår första anställning via Parium signade kontrakt på två veckor. Helt galet.',
    name: 'James Mitchell',
    role: 'VP Product, LaunchPad',
    avatar:
      'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
  {
    quote:
      'Kvaliteten på matchningarna översteg våra förväntningar — vi swipear hellre än läser CV.',
    name: 'Rachel Foster',
    role: 'Medgrundare, Nexus Labs',
    avatar:
      'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
  {
    quote:
      'Otroligt jobb från start till mål. Jag rekommenderar Parium till varje founder jag känner.',
    name: 'David Zhang',
    role: 'Head of Design, Paradigm',
    avatar:
      'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
];

const TestimonialCarousel = () => {
  const { ref, inView } = useInViewAnimation();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const tripled = [...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS];

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setIndex((i) => i + 1), 3000);
    return () => window.clearInterval(id);
  }, [paused]);

  // Reset index when reaching end of second copy (seamless loop)
  useEffect(() => {
    if (index >= TESTIMONIALS.length * 2) {
      const t = window.setTimeout(() => setIndex(index - TESTIMONIALS.length), 800);
      return () => window.clearTimeout(t);
    }
  }, [index]);

  const cardWidth = 427.5;
  const gap = 24;

  return (
    <section
      ref={ref}
      className="relative z-10 w-full py-20"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className={`mx-auto md:max-w-4xl md:ml-auto px-6 flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10 ${
          inView ? 'animate-landing-fade-in-up' : 'opacity-0'
        }`}
        style={{ animationDelay: '0.1s' }}
      >
        <h2 className="font-pp-neue text-[32px] md:text-[40px] lg:text-[44px] leading-[1.1] text-white tracking-tight">
          Det <span className="font-pp-mondwest italic">arbetsgivare</span> säger
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-white text-white" />
            ))}
          </div>
          <span className="text-sm text-white/80">G2 5/5</span>
        </div>
      </div>

      <div className="overflow-hidden px-6">
        <div
          className="flex gap-6"
          style={{
            transform: `translateX(calc(-${index * (cardWidth + gap)}px))`,
            transition:
              index === 0 || index >= TESTIMONIALS.length * 2
                ? 'none'
                : 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {tripled.map((t, i) => (
            <article
              key={i}
              className="shrink-0 rounded-[32px] md:rounded-[40px] px-6 md:pl-10 md:pr-16 py-8 ring-1 ring-white/10"
              style={{
                width: `min(${cardWidth}px, calc(100vw - 48px))`,
                background: 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
              }}
            >
              <svg
                width="32"
                height="24"
                viewBox="0 0 32 24"
                fill="none"
                aria-hidden
                className="mb-6"
              >
                <path
                  d="M0 24V14.4C0 10.4 0.853333 6.93333 2.56 4C4.26667 1.06667 6.93333 -0.266667 10.56 0L11.84 4.32C9.49333 4.85333 7.84 5.97333 6.88 7.68C5.97333 9.38667 5.49333 11.6533 5.44 14.48H10.56V24H0ZM21.44 24V14.4C21.44 10.4 22.2933 6.93333 24 4C25.7067 1.06667 28.3733 -0.266667 32 0L33.28 4.32C30.9333 4.85333 29.28 5.97333 28.32 7.68C27.4133 9.38667 26.9333 11.6533 26.88 14.48H32V24H21.44Z"
                  fill="white"
                  fillOpacity="0.85"
                />
              </svg>
              <p className="text-base text-white/90 leading-relaxed">
                "{t.quote}"
              </p>
              <div className="mt-8 flex items-center gap-3">
                <img
                  src={t.avatar}
                  alt={t.name}
                  loading="lazy"
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="font-semibold text-sm text-white">
                    {t.name}
                  </div>
                  <div className="text-xs text-white/60">→ {t.role}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-8 flex justify-center gap-3 px-6">
        <button
          aria-label="Föregående"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="w-12 h-12 rounded-full border border-white/25 text-white flex items-center justify-center hover:bg-white/10 transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          aria-label="Nästa"
          onClick={() => setIndex((i) => i + 1)}
          className="w-12 h-12 rounded-full border border-white/25 text-white flex items-center justify-center hover:bg-white/10 transition"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
};

export default TestimonialCarousel;
