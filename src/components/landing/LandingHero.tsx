import { useNavigate } from 'react-router-dom';
import {
  motion,
  useMotionValue,
  useTransform,
  useScroll,
  animate,
} from 'framer-motion';
import { ArrowRight, MapPin, Clock, Heart, Zap, Users, TrendingUp } from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

/* ─── Animated gradient blobs ─── */
const AnimatedBlobs = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    {/* Large primary blob */}
    <motion.div
      className="absolute w-[600px] h-[600px] md:w-[900px] md:h-[900px] rounded-full"
      style={{
        background: 'radial-gradient(circle, hsl(200 100% 50% / 0.15) 0%, hsl(200 100% 40% / 0.05) 50%, transparent 70%)',
        top: '-20%',
        left: '-15%',
        filter: 'blur(60px)',
      }}
      animate={{
        x: [0, 40, -20, 0],
        y: [0, -30, 20, 0],
        scale: [1, 1.08, 0.95, 1],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
    />
    {/* Secondary blob */}
    <motion.div
      className="absolute w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full"
      style={{
        background: 'radial-gradient(circle, hsl(215 100% 40% / 0.2) 0%, hsl(200 100% 60% / 0.06) 50%, transparent 70%)',
        bottom: '-30%',
        right: '-10%',
        filter: 'blur(80px)',
      }}
      animate={{
        x: [0, -50, 30, 0],
        y: [0, 40, -20, 0],
        scale: [1, 0.92, 1.06, 1],
      }}
      transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
    />
    {/* Accent blob - cyan */}
    <motion.div
      className="absolute w-[300px] h-[300px] md:w-[500px] md:h-[500px] rounded-full"
      style={{
        background: 'radial-gradient(circle, hsl(190 100% 55% / 0.12) 0%, transparent 60%)',
        top: '40%',
        left: '30%',
        filter: 'blur(50px)',
      }}
      animate={{
        x: [0, 60, -40, 0],
        y: [0, -50, 30, 0],
        opacity: [0.6, 1, 0.7, 0.6],
      }}
      transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
    />

    {/* Organic flowing SVG lines */}
    <svg
      className="absolute w-full h-full opacity-[0.03]"
      viewBox="0 0 1200 800"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      <motion.path
        d="M-100,400 C200,100 400,700 600,300 S1000,600 1300,200"
        stroke="hsl(200 100% 60%)"
        strokeWidth="1.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 3, ease, delay: 0.5 }}
      />
      <motion.path
        d="M-50,600 C150,200 500,800 750,350 S1100,500 1350,300"
        stroke="hsl(200 100% 50%)"
        strokeWidth="1"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 4, ease, delay: 1 }}
      />
      <motion.circle
        cx="600" cy="400" r="300"
        stroke="hsl(200 100% 60%)"
        strokeWidth="0.5"
        initial={{ pathLength: 0, rotate: 0 }}
        animate={{ pathLength: 1, rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      />
      <motion.ellipse
        cx="600" cy="400" rx="500" ry="280"
        stroke="hsl(215 80% 50%)"
        strokeWidth="0.4"
        initial={{ rotate: -15 }}
        animate={{ rotate: 345 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
      />
    </svg>
  </div>
);

/* ─── Staggered letter reveal ─── */
const LetterReveal = ({
  text,
  className,
  gradient = false,
  delay = 0,
}: {
  text: string;
  className: string;
  gradient?: boolean;
  delay?: number;
}) => (
  <span className={`inline-flex overflow-hidden ${className}`}>
    {text.split('').map((char, i) => (
      <motion.span
        key={i}
        className={gradient ? 'bg-gradient-to-r from-[hsl(200_100%_60%)] via-[hsl(190_100%_55%)] to-[hsl(200_100%_70%)] bg-clip-text text-transparent' : ''}
        initial={{ y: '120%', opacity: 0 }}
        animate={{ y: '0%', opacity: 1 }}
        transition={{
          duration: 0.8,
          delay: delay + i * 0.04,
          ease,
        }}
      >
        {char}
      </motion.span>
    ))}
  </span>
);

/* ─── Floating stat badge ─── */
const FloatingBadge = ({
  icon: Icon,
  label,
  value,
  delay,
  position,
}: {
  icon: any;
  label: string;
  value: string;
  delay: number;
  position: string;
}) => (
  <motion.div
    className={`absolute ${position} z-20 hidden lg:flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.3)]`}
    initial={{ opacity: 0, scale: 0.5, y: 30 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ duration: 0.8, delay, ease }}
  >
    <div className="w-8 h-8 rounded-xl bg-[hsl(200_100%_60%/0.15)] flex items-center justify-center">
      <Icon className="w-4 h-4 text-[hsl(200_100%_60%)]" />
    </div>
    <div>
      <p className="text-white font-bold text-sm leading-tight">{value}</p>
      <p className="text-white/40 text-[10px] font-medium">{label}</p>
    </div>
  </motion.div>
);

/* ─── Interactive swipe phone mockup ─── */
const demoJobs = [
  { title: 'Frontend Developer', company: 'TechCorp AB', location: 'Stockholm', type: 'Heltid', gradient: 'from-[hsl(200_100%_45%)] to-[hsl(215_100%_25%)]' },
  { title: 'UX Designer', company: 'Design Studio', location: 'Göteborg', type: 'Heltid', gradient: 'from-[hsl(190_90%_40%)] to-[hsl(200_100%_30%)]' },
  { title: 'Product Manager', company: 'StartUp Co', location: 'Malmö', type: 'Heltid', gradient: 'from-[hsl(210_80%_50%)] to-[hsl(220_90%_35%)]' },
];

const PhoneMockup = ({ scrollYProgress }: { scrollYProgress: any }) => {
  const [currentCard, setCurrentCard] = useState(0);
  const [liked, setLiked] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  const likeOpacity = useTransform(x, [0, 80], [0, 1]);
  const nopeOpacity = useTransform(x, [-80, 0], [1, 0]);
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const phoneRotate = useTransform(scrollYProgress, [0, 1], [0, -3]);

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
      className="relative w-[260px] h-[460px] sm:w-[280px] sm:h-[500px]"
      style={{ y: phoneY, rotate: phoneRotate }}
      initial={{ opacity: 0, y: 80, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1.4, delay: 0.8, ease }}
    >
      {/* Animated glow ring behind phone */}
      <motion.div
        className="absolute -inset-6 rounded-[3rem]"
        style={{
          background: 'conic-gradient(from 0deg, hsl(200 100% 60% / 0.15), hsl(215 100% 40% / 0.05), hsl(190 100% 55% / 0.15), hsl(200 100% 60% / 0.05), hsl(200 100% 60% / 0.15))',
          filter: 'blur(30px)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />

      {/* Phone frame */}
      <div className="absolute inset-0 rounded-[2.5rem] bg-[hsl(215_100%_8%)] border border-white/[0.1] shadow-[0_0_60px_rgba(0,150,255,0.1),0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Status bar */}
        <div className="flex justify-between items-center px-6 pt-3 pb-2">
          <span className="text-[9px] text-white/30 font-medium">9:41</span>
          <div className="w-20 h-5 rounded-full bg-black/80 mx-auto" />
          <div className="flex gap-1">
            <div className="w-3 h-1.5 rounded-sm bg-white/20" />
          </div>
        </div>

        {/* Card area */}
        <div className="relative mx-3 h-[320px] sm:h-[360px]">
          {/* Background card */}
          <div className={`absolute inset-1 rounded-2xl bg-gradient-to-br ${nextJob.gradient} opacity-40 scale-[0.92]`} />

          {/* Active card */}
          <motion.div
            className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${job.gradient} cursor-grab active:cursor-grabbing overflow-hidden shadow-2xl`}
            style={{ x, rotate }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            onDragEnd={handleDragEnd}
          >
            {/* LIKE stamp */}
            <motion.div
              className="absolute top-4 left-4 z-20 border-2 border-[hsl(160_80%_50%)] rounded-lg px-3 py-0.5 -rotate-12"
              style={{ opacity: likeOpacity }}
            >
              <span className="text-[hsl(160_80%_50%)] text-sm font-black">SÖK!</span>
            </motion.div>
            {/* NOPE stamp */}
            <motion.div
              className="absolute top-4 right-4 z-20 border-2 border-red-400 rounded-lg px-3 py-0.5 rotate-12"
              style={{ opacity: nopeOpacity }}
            >
              <span className="text-red-400 text-xs font-black">NOPE</span>
            </motion.div>

            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
            />

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
            <Heart className="w-3.5 h-3.5 text-[hsl(200_100%_60%)] fill-[hsl(200_100%_60%)]" />
            <span className="text-white/70 text-xs font-semibold">{liked}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ─── Animated counter ─── */
const AnimatedCounter = ({ target, suffix = '' }: { target: number; suffix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      let start = 0;
      const step = () => {
        start += Math.ceil(target / 40);
        if (start >= target) {
          setCount(target);
        } else {
          setCount(start);
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    }, 1500);
    return () => clearTimeout(timer);
  }, [target]);

  return <span ref={ref}>{count}{suffix}</span>;
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

  const bgY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -40]);

  const goTo = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section
      ref={heroRef}
      className="relative min-h-[100dvh] flex flex-col justify-center overflow-hidden pt-20 pb-12"
    >
      {/* Animated background blobs */}
      <motion.div style={{ y: bgY }} className="absolute inset-0">
        <AnimatedBlobs />
      </motion.div>

      {/* Grid overlay for depth */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        aria-hidden="true"
        style={{
          backgroundImage: 'linear-gradient(hsl(200 100% 60% / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(200 100% 60% / 0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <motion.div
        style={{ y: textY }}
        className="relative z-10 max-w-[1400px] mx-auto px-5 sm:px-6 md:px-12 w-full"
      >
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Left — text content */}
          <div className="flex-1 space-y-7">
            {/* Top label with animated line */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.2, ease }}
            >
              <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] uppercase text-[hsl(200_100%_60%/0.6)]">
                <motion.span
                  className="w-0 h-px bg-gradient-to-r from-[hsl(200_100%_60%)] to-transparent"
                  animate={{ width: 48 }}
                  transition={{ duration: 1, delay: 0.5, ease }}
                />
                Framtidens rekrytering
              </span>
            </motion.div>

            {/* Giant headline — letter by letter */}
            <div className="space-y-1">
              <div className="overflow-hidden">
                <h1 className="text-[3rem] leading-[0.88] sm:text-[4.5rem] md:text-[6rem] lg:text-[7rem] font-black tracking-[-0.05em] uppercase">
                  <LetterReveal text="Rekry" className="text-white" delay={0.3} />
                  <LetterReveal text="tering" className="" gradient delay={0.5} />
                </h1>
              </div>

              <div className="overflow-hidden">
                <motion.h2
                  className="text-[1.8rem] leading-[0.95] sm:text-[2.5rem] md:text-[3.5rem] font-black tracking-[-0.04em] text-white/10 uppercase flex items-center gap-4"
                  initial={{ y: '120%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 1.2, ease, delay: 0.7 }}
                >
                  På 60 sek
                  <motion.div
                    className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-[hsl(200_100%_60%)] flex-shrink-0"
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.3, 1] }}
                    transition={{ duration: 0.6, delay: 1.5, ease }}
                  />
                </motion.h2>
              </div>
            </div>

            {/* Subline with stagger */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1.0, ease }}
            >
              <p className="text-white/40 text-sm sm:text-base leading-relaxed font-medium max-w-md">
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                >
                  Swipe. Matcha. Anställ.
                </motion.span>
                <br />
                <motion.span
                  className="text-white/20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5 }}
                >
                  Rekrytering som känns lika enkelt som att scrolla sociala medier.
                </motion.span>
              </p>
            </motion.div>

            {/* CTA with glow */}
            <motion.div
              className="flex flex-col gap-3 pt-2"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1.3, ease }}
            >
              <button
                onClick={goTo}
                className="group relative flex items-center gap-3 px-7 py-3.5 rounded-full bg-[hsl(200_100%_60%)] text-[hsl(215_100%_8%)] font-bold text-sm w-fit
                  hover:bg-[hsl(200_100%_65%)] active:scale-[0.97] transition-all duration-300 shadow-[0_0_30px_rgba(0,150,255,0.3)]"
              >
                <motion.div
                  className="absolute inset-0 rounded-full bg-[hsl(200_100%_60%/0.4)]"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="relative z-10 flex items-center gap-3">
                  Kom igång gratis
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <span className="text-white/20 text-[10px] sm:text-xs tracking-wide">
                Inget kreditkort · Gratis under beta
              </span>
            </motion.div>

            {/* Mini stats row */}
            <motion.div
              className="flex items-center gap-6 pt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8, duration: 1 }}
            >
              {[
                { value: 200, suffix: '+', label: 'I väntelistan' },
                { value: 60, suffix: 's', label: 'Snittmatchning' },
                { value: 95, suffix: '%', label: 'Nöjda användare' },
              ].map((stat, i) => (
                <div key={stat.label} className="text-center">
                  <p className="text-white font-black text-lg sm:text-xl">
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                  </p>
                  <p className="text-white/25 text-[9px] sm:text-[10px] font-medium">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — Phone mockup with floating badges */}
          <div className="flex-shrink-0 relative">
            <FloatingBadge
              icon={Zap}
              label="Snabb matchning"
              value="< 60 sek"
              delay={2.0}
              position="top-[-20px] left-[-120px]"
            />
            <FloatingBadge
              icon={Users}
              label="Aktiva företag"
              value="50+"
              delay={2.3}
              position="top-[40%] right-[-130px]"
            />
            <FloatingBadge
              icon={TrendingUp}
              label="Matchningsgrad"
              value="95%"
              delay={2.6}
              position="bottom-[60px] left-[-100px]"
            />

            <PhoneMockup scrollYProgress={scrollYProgress} />
          </div>
        </div>
      </motion.div>

      {/* Bottom animated line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(200 100% 60% / 0.2), transparent)',
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 2, delay: 1.5, ease }}
      />

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5, duration: 1 }}
      >
        <motion.div
          className="w-5 h-8 rounded-full border border-white/10 flex justify-center pt-1.5"
          animate={{ borderColor: ['hsl(0 0% 100% / 0.1)', 'hsl(200 100% 60% / 0.3)', 'hsl(0 0% 100% / 0.1)'] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <motion.div
            className="w-1 h-1.5 rounded-full bg-[hsl(200_100%_60%)]"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
