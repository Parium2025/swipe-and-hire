import { useNavigate } from 'react-router-dom';
import {
  motion,
  useMotionValue,
  useTransform,
  useScroll,
  animate,
} from 'framer-motion';
import { ArrowRight, MapPin, Clock, Heart } from 'lucide-react';
import { useState, useCallback, useRef } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

/* ─── CSS-only ambient blobs (GPU-accelerated, no JS) ─── */
const AmbientGlow = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div
      className="absolute w-[500px] h-[500px] md:w-[800px] md:h-[800px] rounded-full animate-landing-blob-1"
      style={{
        background: 'radial-gradient(circle, hsl(var(--secondary) / 0.18) 0%, hsl(var(--secondary) / 0.04) 55%, transparent 70%)',
        top: '-15%',
        left: '-10%',
        filter: 'blur(60px)',
        willChange: 'transform',
      }}
    />
    <div
      className="absolute w-[400px] h-[400px] md:w-[600px] md:h-[600px] rounded-full animate-landing-blob-2"
      style={{
        background: 'radial-gradient(circle, hsl(var(--primary-glow) / 0.15) 0%, transparent 65%)',
        bottom: '-20%',
        right: '-5%',
        filter: 'blur(70px)',
        willChange: 'transform',
      }}
    />
    {/* Self-drawing SVG accent */}
    <svg
      className="absolute w-full h-full opacity-[0.04]"
      viewBox="0 0 1200 800"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      <circle cx="600" cy="400" r="280" stroke="hsl(var(--secondary))" strokeWidth="0.6" className="animate-landing-draw" />
    </svg>
  </div>
);

/* ─── Word reveal (much lighter than letter-by-letter) ─── */
const WordReveal = ({
  words,
  className,
  delay = 0,
}: {
  words: string[];
  className?: string;
  delay?: number;
}) => (
  <span className={`inline-flex flex-wrap gap-x-[0.3em] overflow-hidden ${className ?? ''}`}>
    {words.map((word, i) => (
      <motion.span
        key={i}
        className="inline-block"
        initial={{ y: '110%', opacity: 0 }}
        animate={{ y: '0%', opacity: 1 }}
        transition={{ duration: 0.7, delay: delay + i * 0.1, ease }}
      >
        {word}
      </motion.span>
    ))}
  </span>
);

/* ─── Swipe phone mockup (simplified, fewer motion instances) ─── */
const demoJobs = [
  { title: 'Frontend Developer', company: 'TechCorp AB', location: 'Stockholm', type: 'Heltid', gradient: 'from-secondary to-primary' },
  { title: 'UX Designer', company: 'Design Studio', location: 'Göteborg', type: 'Heltid', gradient: 'from-[hsl(190_90%_45%)] to-primary' },
  { title: 'Product Manager', company: 'StartUp Co', location: 'Malmö', type: 'Heltid', gradient: 'from-[hsl(210_80%_50%)] to-primary' },
];

const PhoneMockup = ({ scrollYProgress }: { scrollYProgress: any }) => {
  const [currentCard, setCurrentCard] = useState(0);
  const [liked, setLiked] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-12, 0, 12]);
  const likeOpacity = useTransform(x, [0, 80], [0, 1]);
  const nopeOpacity = useTransform(x, [-80, 0], [1, 0]);
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, -50]);

  const handleDragEnd = useCallback((_: any, info: any) => {
    if (Math.abs(info.offset.x) > 80) {
      const dir = info.offset.x > 0 ? 1 : -1;
      animate(x, dir * 400, { type: 'spring', stiffness: 500, damping: 30 });
      if (dir > 0) setLiked(p => p + 1);
      setTimeout(() => {
        x.set(0);
        setCurrentCard(p => (p + 1) % demoJobs.length);
      }, 300);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 25 });
    }
  }, [x]);

  const job = demoJobs[currentCard];
  const nextJob = demoJobs[(currentCard + 1) % demoJobs.length];

  return (
    <motion.div
      className="relative w-[220px] h-[400px] sm:w-[260px] sm:h-[460px] lg:w-[280px] lg:h-[500px]"
      style={{ y: phoneY }}
      initial={{ opacity: 0, y: 60, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1.2, delay: 0.6, ease }}
    >
      {/* Glow ring — CSS animation, not framer */}
      <div
        className="absolute -inset-5 rounded-[3rem] animate-landing-glow-spin"
        style={{
          background: 'conic-gradient(from 0deg, hsl(var(--secondary) / 0.2), transparent 40%, hsl(var(--secondary) / 0.15), transparent 80%)',
          filter: 'blur(25px)',
        }}
      />

      {/* Phone frame */}
      <div className="absolute inset-0 rounded-[2.5rem] bg-primary border border-white/[0.1] shadow-[0_0_50px_hsl(var(--secondary)/0.12),0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Status bar */}
        <div className="flex justify-between items-center px-5 pt-3 pb-2">
          <span className="text-[9px] text-white/30 font-medium">9:41</span>
          <div className="w-16 h-5 rounded-full bg-black/80 mx-auto" />
          <div className="w-3 h-1.5 rounded-sm bg-white/20" />
        </div>

        {/* Card area */}
        <div className="relative mx-3 h-[275px] sm:h-[320px] lg:h-[360px]">
          {/* Background card */}
          <div className={`absolute inset-1 rounded-2xl bg-gradient-to-br ${nextJob.gradient} opacity-30 scale-[0.92]`} />

          {/* Active card */}
          <motion.div
            className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${job.gradient} cursor-grab active:cursor-grabbing overflow-hidden shadow-2xl`}
            style={{ x, rotate }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            onDragEnd={handleDragEnd}
          >
            {/* LIKE / NOPE stamps */}
            <motion.div
              className="absolute top-4 left-4 z-20 border-2 border-[hsl(160_80%_50%)] rounded-lg px-3 py-0.5 -rotate-12"
              style={{ opacity: likeOpacity }}
            >
              <span className="text-[hsl(160_80%_50%)] text-sm font-black">SÖK!</span>
            </motion.div>
            <motion.div
              className="absolute top-4 right-4 z-20 border-2 border-red-400 rounded-lg px-3 py-0.5 rotate-12"
              style={{ opacity: nopeOpacity }}
            >
              <span className="text-red-400 text-xs font-black">NOPE</span>
            </motion.div>

            {/* Shimmer — CSS only */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent animate-landing-shimmer" />

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="text-white/70 text-xs font-medium">{job.company}</p>
              <h3 className="text-white text-lg font-bold leading-tight mt-0.5">{job.title}</h3>
              <div className="flex gap-3 mt-2">
                <span className="flex items-center gap-1 text-white/60 text-[10px]">
                  <MapPin className="w-3 h-3" />{job.location}
                </span>
                <span className="flex items-center gap-1 text-white/60 text-[10px]">
                  <Clock className="w-3 h-3" />{job.type}
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-center gap-2 mt-3 px-4">
          <div className="flex items-center gap-1.5 px-4 py-1.5 bg-white/[0.06] rounded-full border border-white/[0.08]">
            <Heart className="w-3.5 h-3.5 text-secondary fill-secondary" />
            <span className="text-white/70 text-xs font-semibold">{liked}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════
   HERO SECTION
   ═══════════════════════════════════════════ */
const LandingHero = () => {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const textY = useTransform(scrollYProgress, [0, 1], [0, -30]);

  const goTo = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section
      ref={heroRef}
      className="relative min-h-[100dvh] flex flex-col justify-center overflow-hidden pt-16 pb-8 sm:pt-20 sm:pb-12"
    >
      <AmbientGlow />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        aria-hidden="true"
        style={{
          backgroundImage: 'linear-gradient(hsl(var(--secondary) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--secondary) / 0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <motion.div
        style={{ y: textY }}
        className="relative z-10 max-w-[1400px] mx-auto px-5 sm:px-6 md:px-12 w-full"
      >
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
          {/* Left — text */}
          <div className="flex-1 space-y-5 sm:space-y-6">
            {/* Label */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease }}
            >
              <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.25em] uppercase text-secondary/70">
                <motion.span
                  className="w-0 h-px bg-gradient-to-r from-secondary to-transparent"
                  animate={{ width: 40 }}
                  transition={{ duration: 0.8, delay: 0.4, ease }}
                />
                Framtidens rekrytering
              </span>
            </motion.div>

            {/* Headline */}
            <div className="space-y-1">
              <div className="overflow-hidden">
                <h1 className="text-[2.8rem] leading-[0.9] sm:text-[4rem] md:text-[5.5rem] lg:text-[7rem] font-black tracking-[-0.04em] uppercase">
                  <WordReveal words={['Rekry']} className="text-white" delay={0.2} />
                  <WordReveal
                    words={['tering.']}
                    className="bg-gradient-to-r from-secondary via-[hsl(190_100%_55%)] to-secondary bg-clip-text text-transparent"
                    delay={0.35}
                  />
                </h1>
              </div>

              <div className="overflow-hidden">
                <motion.p
                  className="text-[1.5rem] leading-[1] sm:text-[2.2rem] md:text-[3rem] font-black tracking-[-0.03em] text-white/15 uppercase flex items-center gap-3"
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, ease, delay: 0.5 }}
                >
                  På 60 sekunder
                  <motion.span
                    className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-secondary flex-shrink-0"
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.4, 1] }}
                    transition={{ duration: 0.5, delay: 1.2, ease }}
                  />
                </motion.p>
              </div>
            </div>

            {/* Subline */}
            <motion.p
              className="text-white/50 text-sm sm:text-base leading-relaxed font-medium max-w-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7, ease }}
            >
              Swipe. Matcha. Anställ.{' '}
              <span className="text-white/30">
                Rekrytering som känns lika enkelt som att scrolla sociala medier.
              </span>
            </motion.p>

            {/* CTA */}
            <motion.div
              className="flex flex-col gap-3 pt-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9, ease }}
            >
              <button
                onClick={goTo}
                className="group relative flex items-center gap-3 px-7 py-3.5 rounded-full bg-secondary text-primary font-bold text-sm w-fit
                  hover:bg-[hsl(200_100%_65%)] active:scale-[0.97] transition-all duration-300 shadow-[0_0_40px_hsl(var(--secondary)/0.3)]"
              >
                {/* Pulsing glow ring */}
                <span className="absolute inset-0 rounded-full bg-secondary/40 animate-landing-cta-pulse" />
                <span className="relative z-10 flex items-center gap-3">
                  Kom igång gratis
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <span className="text-white/25 text-[10px] sm:text-xs tracking-wide">
                Inget kreditkort · Gratis under beta
              </span>
            </motion.div>

            {/* Stats */}
            <motion.div
              className="flex items-center gap-6 sm:gap-8 pt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
            >
              {[
                { value: '200+', label: 'I väntelistan' },
                { value: '60s', label: 'Snittmatchning' },
                { value: '95%', label: 'Nöjda användare' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-white font-black text-lg sm:text-xl">{stat.value}</p>
                  <p className="text-white/30 text-[9px] sm:text-[10px] font-medium">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — Phone */}
          <div className="flex-shrink-0 relative">
            <PhoneMockup scrollYProgress={scrollYProgress} />
          </div>
        </div>
      </motion.div>

      {/* Bottom line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(var(--secondary) / 0.2), transparent)',
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.5, delay: 1, ease }}
      />

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.8 }}
      >
        <div className="w-5 h-8 rounded-full border border-white/10 flex justify-center pt-1.5 animate-landing-scroll-border">
          <div className="w-1 h-1.5 rounded-full bg-secondary animate-landing-scroll-dot" />
        </div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
