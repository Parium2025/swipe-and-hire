import { useNavigate } from 'react-router-dom';
import {
  motion,
  useMotionValue,
  useTransform,
  useScroll,
  animate,
  AnimatePresence,
} from 'framer-motion';
import { ArrowRight, MapPin, Clock, Heart, Check, Star, MessageCircle, Send, User, Briefcase } from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

/* ─── Demo data ─── */
const demoJobs = [
  { title: 'Frontend Developer', company: 'TechCorp AB', location: 'Stockholm', type: 'Heltid', color: 'from-secondary to-[hsl(220_80%_40%)]' },
  { title: 'UX Designer', company: 'Design Studio', location: 'Göteborg', type: 'Heltid', color: 'from-[hsl(190_90%_45%)] to-[hsl(210_80%_35%)]' },
  { title: 'Product Manager', company: 'StartUp Co', location: 'Malmö', type: 'Heltid', color: 'from-[hsl(210_85%_50%)] to-[hsl(230_70%_35%)]' },
];

/* ─── Phone Screen Components ─── */

/** Screen 0: Swipe cards */
const SwipeScreen = ({ isActive }: { isActive: boolean }) => {
  const [currentCard, setCurrentCard] = useState(0);
  const [liked, setLiked] = useState(0);
  const x = useMotionValue(0);
  const cardRotate = useTransform(x, [-200, 0, 200], [-12, 0, 12]);
  const likeOpacity = useTransform(x, [0, 60], [0, 1]);
  const nopeOpacity = useTransform(x, [-60, 0], [1, 0]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      const dir = Math.random() > 0.25 ? 1 : -1;
      animate(x, dir * 220, {
        type: 'spring', stiffness: 280, damping: 22,
        onComplete: () => {
          if (dir > 0) setLiked(p => p + 1);
          x.set(0);
          setCurrentCard(p => (p + 1) % demoJobs.length);
        },
      });
    }, 2800);
    return () => clearInterval(interval);
  }, [isActive, x]);

  const job = demoJobs[currentCard];
  const nextJob = demoJobs[(currentCard + 1) % demoJobs.length];

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-2 pb-1.5">
        <p className="text-[8px] text-white/30 font-semibold tracking-[0.15em] uppercase">Parium</p>
        <p className="text-[11px] text-white font-bold">Utforska jobb</p>
      </div>

      {/* Card stack */}
      <div className="relative flex-1 mx-3 mb-1">
        <div className={`absolute inset-2 rounded-xl bg-gradient-to-br ${nextJob.color} opacity-25 scale-[0.94]`} />
        <motion.div
          className={`absolute inset-0 rounded-xl bg-gradient-to-br ${job.color} overflow-hidden`}
          style={{ x, rotate: cardRotate }}
        >
          <motion.div className="absolute top-3 left-3 z-20 border-2 border-[hsl(160_80%_55%)] rounded-md px-2 py-0.5 -rotate-12"
            style={{ opacity: likeOpacity }}>
            <span className="text-[hsl(160_80%_55%)] text-[9px] font-black flex items-center gap-0.5">
              <Check className="w-2.5 h-2.5" /> LIKE
            </span>
          </motion.div>
          <motion.div className="absolute top-3 right-3 z-20 border-2 border-red-400 rounded-md px-2 py-0.5 rotate-12"
            style={{ opacity: nopeOpacity }}>
            <span className="text-red-400 text-[9px] font-black">NOPE</span>
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-5 h-5 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <span className="text-[6px] font-bold text-white">{job.company[0]}</span>
              </div>
              <p className="text-white/70 text-[8px] font-medium">{job.company}</p>
            </div>
            <h3 className="text-white text-sm font-bold leading-tight">{job.title}</h3>
            <div className="flex gap-1.5 mt-1.5">
              <span className="flex items-center gap-0.5 text-white/60 text-[7px] bg-white/10 rounded-full px-1.5 py-0.5">
                <MapPin className="w-2 h-2" />{job.location}
              </span>
              <span className="flex items-center gap-0.5 text-white/60 text-[7px] bg-white/10 rounded-full px-1.5 py-0.5">
                <Clock className="w-2 h-2" />{job.type}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-center gap-3 py-1.5">
        <div className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
          <span className="text-red-400 text-[10px]">✕</span>
        </div>
        <div className="w-9 h-9 rounded-full bg-secondary/20 border border-secondary/30 flex items-center justify-center">
          <Heart className="w-3.5 h-3.5 text-secondary" />
        </div>
        <div className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
          <span className="text-white/40 text-[10px]">⟳</span>
        </div>
      </div>

      {/* Match counter */}
      <div className="flex justify-center pb-2">
        <div className="flex items-center gap-1 px-2.5 py-0.5 bg-white/[0.04] rounded-full">
          <Heart className="w-2 h-2 text-secondary fill-secondary" />
          <span className="text-white/50 text-[8px] font-semibold">{liked} matchningar</span>
        </div>
      </div>
    </div>
  );
};

/** Screen 1: Match notification */
const MatchScreen = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      className="flex flex-col items-center"
    >
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-secondary to-[hsl(190_100%_45%)] flex items-center justify-center">
          <Star className="w-8 h-8 text-white" />
        </div>
        <motion.div
          className="absolute -inset-3 rounded-full border-2 border-secondary/40"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>
      <p className="text-secondary text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Det är en match!</p>
      <p className="text-white text-base font-black">TechCorp AB</p>
      <p className="text-white/40 text-[9px] mt-0.5">gillar din profil</p>

      <div className="flex gap-2 mt-5">
        <div className="px-4 py-1.5 rounded-full bg-secondary text-primary text-[9px] font-bold">
          Skicka meddelande
        </div>
        <div className="px-4 py-1.5 rounded-full bg-white/10 text-white/60 text-[9px] font-medium">
          Fortsätt swipea
        </div>
      </div>
    </motion.div>
  </div>
);

/** Screen 2: Chat */
const ChatScreen = () => (
  <div className="absolute inset-0 flex flex-col">
    {/* Chat header */}
    <div className="px-4 pt-2 pb-2 border-b border-white/[0.06] flex items-center gap-2">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-secondary to-[hsl(190_100%_45%)] flex items-center justify-center">
        <span className="text-[7px] font-bold text-white">TC</span>
      </div>
      <div>
        <p className="text-white text-[10px] font-bold">TechCorp AB</p>
        <p className="text-white/30 text-[7px]">Online</p>
      </div>
    </div>

    {/* Messages */}
    <div className="flex-1 px-3 py-3 space-y-2 overflow-hidden">
      <motion.div className="flex justify-start" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
        <div className="bg-white/[0.08] rounded-xl rounded-tl-sm px-3 py-1.5 max-w-[75%]">
          <p className="text-white/80 text-[9px]">Hej! Vi såg din profil och vill gärna boka en intervju 🙌</p>
          <p className="text-white/20 text-[6px] mt-0.5">14:32</p>
        </div>
      </motion.div>
      <motion.div className="flex justify-end" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}>
        <div className="bg-secondary/20 rounded-xl rounded-tr-sm px-3 py-1.5 max-w-[75%]">
          <p className="text-white/90 text-[9px]">Tack! Låter jättebra, jag är tillgänglig nästa vecka 😊</p>
          <p className="text-white/20 text-[6px] mt-0.5 text-right">14:33</p>
        </div>
      </motion.div>
      <motion.div className="flex justify-start" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.3 }}>
        <div className="bg-white/[0.08] rounded-xl rounded-tl-sm px-3 py-1.5 max-w-[75%]">
          <p className="text-white/80 text-[9px]">Perfekt! Tisdag kl 10? Vi skickar en Teams-länk 🎯</p>
          <p className="text-white/20 text-[6px] mt-0.5">14:34</p>
        </div>
      </motion.div>
    </div>

    {/* Input */}
    <div className="px-3 pb-2">
      <div className="flex items-center gap-2 bg-white/[0.06] rounded-full px-3 py-1.5">
        <p className="text-white/20 text-[8px] flex-1">Skriv ett meddelande...</p>
        <Send className="w-3 h-3 text-secondary" />
      </div>
    </div>
  </div>
);

/** Screen 3: Profile/hired */
const HiredScreen = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      className="flex flex-col items-center"
    >
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[hsl(160_80%_45%)] to-[hsl(140_70%_35%)] flex items-center justify-center mb-3">
        <Check className="w-7 h-7 text-white" />
      </div>
      <p className="text-[hsl(160_80%_55%)] text-[10px] font-bold tracking-[0.15em] uppercase mb-1">Grattis!</p>
      <p className="text-white text-base font-black">Du fick jobbet!</p>
      <p className="text-white/40 text-[9px] mt-1 text-center">Frontend Developer på TechCorp AB</p>

      <div className="mt-4 w-full space-y-1.5">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] rounded-lg">
          <Briefcase className="w-3 h-3 text-secondary" />
          <span className="text-white/60 text-[8px]">Startdatum: 1 maj 2026</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] rounded-lg">
          <MapPin className="w-3 h-3 text-secondary" />
          <span className="text-white/60 text-[8px]">Stockholm, Hybrid</span>
        </div>
      </div>
    </motion.div>
  </div>
);

/* ─── Phone with scroll-driven screens ─── */
const phoneScreens = [
  { label: 'Swipe', icon: Heart },
  { label: 'Match', icon: Star },
  { label: 'Chatt', icon: MessageCircle },
  { label: 'Anställd', icon: Check },
];

const PhoneMockup = ({ activeScreen }: { activeScreen: number }) => {
  return (
    <div className="relative">
      {/* Ambient glow */}
      <div className="absolute -inset-10 sm:-inset-16 rounded-[4rem]"
        style={{ background: 'radial-gradient(ellipse, hsl(200 100% 60% / 0.15) 0%, hsl(200 100% 50% / 0.05) 50%, transparent 70%)', filter: 'blur(50px)' }} />

      {/* iPhone frame */}
      <div className="relative w-[220px] h-[450px] sm:w-[260px] sm:h-[530px] lg:w-[300px] lg:h-[610px]">
        {/* Titanium shell */}
        <div className="absolute inset-0 rounded-[2.4rem] sm:rounded-[2.8rem] bg-[hsl(220_15%_13%)] shadow-[0_30px_100px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]" />

        {/* Screen bezel */}
        <div className="absolute inset-[3px] sm:inset-[4px] rounded-[2.1rem] sm:rounded-[2.5rem] overflow-hidden"
          style={{ background: 'linear-gradient(180deg, hsl(215 60% 10%) 0%, hsl(215 70% 7%) 100%)' }}>

          {/* Dynamic Island */}
          <div className="absolute top-[8px] sm:top-[10px] left-1/2 -translate-x-1/2 w-[75px] sm:w-[95px] h-[22px] sm:h-[28px] bg-black rounded-full z-30">
            <div className="absolute right-[14px] sm:right-[18px] top-1/2 -translate-y-1/2 w-[5px] h-[5px] sm:w-[7px] sm:h-[7px] rounded-full bg-[hsl(220_20%_10%)] border border-[hsl(220_10%_18%)]">
              <div className="absolute inset-[1px] rounded-full bg-[hsl(240_30%_16%)]" />
            </div>
          </div>

          {/* Status bar */}
          <div className="absolute top-0 left-0 right-0 flex justify-between items-center px-5 sm:px-6 pt-[14px] sm:pt-[16px] z-20">
            <span className="text-[7px] sm:text-[8px] text-white/40 font-semibold">9:41</span>
            <div />
            <div className="flex items-center gap-0.5">
              <div className="flex gap-[1px]">
                {[3.5, 5, 7, 9].map(h => <div key={h} className="w-[1.5px] rounded-sm bg-white/35" style={{ height: h }} />)}
              </div>
              <div className="ml-1 w-[14px] h-[7px] rounded-[1.5px] border border-white/25 relative">
                <div className="absolute inset-[1px] rounded-[0.5px] bg-white/35 w-[60%]" />
              </div>
            </div>
          </div>

          {/* Screen content — animates based on scroll */}
          <div className="absolute inset-0 pt-[40px] sm:pt-[48px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeScreen}
                className="absolute inset-0 pt-[40px] sm:pt-[48px]"
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.5, ease }}
              >
                {activeScreen === 0 && <SwipeScreen isActive={true} />}
                {activeScreen === 1 && <MatchScreen />}
                {activeScreen === 2 && <ChatScreen />}
                {activeScreen === 3 && <HiredScreen />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Home indicator */}
          <div className="absolute bottom-[4px] sm:bottom-[6px] left-1/2 -translate-x-1/2 w-[80px] sm:w-[100px] h-[3px] sm:h-[4px] rounded-full bg-white/15 z-20" />
        </div>

        {/* Side buttons */}
        <div className="absolute -right-[1px] top-[30%] w-[2px] h-[38px] sm:h-[48px] rounded-l-sm bg-[hsl(220_15%_18%)]" />
        <div className="absolute -left-[1px] top-[25%] w-[2px] h-[22px] sm:h-[28px] rounded-r-sm bg-[hsl(220_15%_18%)]" />
        <div className="absolute -left-[1px] top-[35%] w-[2px] h-[38px] sm:h-[48px] rounded-r-sm bg-[hsl(220_15%_18%)]" />
        <div className="absolute -left-[1px] top-[46%] w-[2px] h-[38px] sm:h-[48px] rounded-r-sm bg-[hsl(220_15%_18%)]" />

        {/* Glass reflection */}
        <div className="absolute inset-[3px] sm:inset-[4px] rounded-[2.1rem] sm:rounded-[2.5rem] pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent" />
          <div className="absolute top-0 left-[10%] w-[25%] h-[40%] bg-gradient-to-b from-white/[0.015] to-transparent rounded-full blur-xl" />
        </div>
      </div>

      {/* Floor glow */}
      <div className="absolute -bottom-10 sm:-bottom-14 left-1/2 -translate-x-1/2 w-[70%] h-[40px] sm:h-[60px]"
        style={{ background: 'radial-gradient(ellipse, hsl(200 100% 60% / 0.1) 0%, transparent 70%)', filter: 'blur(15px)' }} />
    </div>
  );
};

/* ═══════════════════════════════════════════
   HERO — Scroll-driven storytelling
   The page is ~4x viewport height.
   The phone stays sticky and changes screen
   based on how far you've scrolled.
   ═══════════════════════════════════════════ */
const LandingHero = () => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Map scroll progress → active screen (0-3)
  const [activeScreen, setActiveScreen] = useState(0);
  useEffect(() => {
    const unsub = scrollYProgress.on('change', v => {
      if (v < 0.25) setActiveScreen(0);
      else if (v < 0.5) setActiveScreen(1);
      else if (v < 0.75) setActiveScreen(2);
      else setActiveScreen(3);
    });
    return unsub;
  }, [scrollYProgress]);

  // Parallax transforms
  const phoneScale = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0.9, 1, 1, 0.92]);
  const phoneRotateX = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [6, 0, 0, -8]);

  const goTo = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section ref={sectionRef} className="relative" style={{ height: '400vh' }}>
      {/* Sticky container — stays in view while scrolling through 400vh */}
      <div className="sticky top-0 h-[100dvh] flex flex-col overflow-hidden">
        {/* Background — Parium brand gradient (same as auth page) */}
        <div className="absolute inset-0" style={{
          background: 'var(--gradient-parium)',
          backgroundColor: 'hsl(215 100% 12%)',
        }} />

        {/* Animated bubbles — same as auth page */}
        <div className="absolute inset-0 pointer-events-none z-[1]">
          {/* Left bubbles */}
          <div className="absolute top-20 left-10 w-4 h-4 bg-secondary/30 rounded-full" />
          <div className="absolute top-32 left-16 w-2 h-2 bg-accent/40 rounded-full animate-soft-bounce" style={{ animationDuration: '2.5s', animationDelay: '-1.2s' }} />
          <div className="absolute top-24 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-soft-bounce" style={{ animationDuration: '3s', animationDelay: '-0.7s' }} />
          {/* Right bubbles */}
          <div className="absolute bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-soft-bounce" style={{ animationDuration: '2.2s', animationDelay: '-0.8s' }} />
          <div className="absolute bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-soft-bounce" style={{ animationDuration: '2.8s', animationDelay: '-1.5s' }} />
          <div className="absolute bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-soft-bounce" style={{ animationDuration: '2.3s', animationDelay: '-0.5s' }} />
          {/* Pulsing lights */}
          <div className="absolute top-12 left-8 w-3 h-3 bg-accent/40 rounded-full animate-pulse" style={{ animationDuration: '1.8s', animationDelay: '-0.6s' }} />
          <div className="absolute top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse" style={{ animationDuration: '1.5s', animationDelay: '-0.4s' }} />
          <div className="absolute top-16 right-20 w-2 h-2 bg-accent/30 rounded-full animate-pulse" style={{ animationDuration: '2s', animationDelay: '-1.0s' }} />
          {/* Stars */}
          <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-accent/60 rounded-full animate-pulse" style={{ animationDuration: '3s', animationDelay: '-0.9s' }} />
          <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-secondary/60 rounded-full animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '-1.3s' }} />
        </div>

        {/* Bottom-right glow (same as auth) */}
        <div className="absolute -right-32 bottom-0 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 opacity-10 sm:opacity-15 md:opacity-40 lg:opacity-60 pointer-events-none z-[1]">
          <div className="absolute inset-0 bg-primary-glow/40 rounded-full hidden md:block blur-[120px]" />
          <div className="absolute inset-4 bg-primary-glow/30 rounded-full hidden md:block blur-[100px]" />
          <div className="absolute inset-8 bg-primary-glow/25 rounded-full blur-[40px] md:blur-[80px]" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-5 sm:px-6 md:px-12 max-w-[1400px] mx-auto w-full">
          <div className="flex flex-col items-center lg:flex-row lg:items-center gap-6 lg:gap-20 w-full">

            {/* Phone — scroll-driven, stays sticky */}
            <motion.div
              className="flex-shrink-0 order-1 lg:order-2"
              style={{ scale: phoneScale, rotateX: phoneRotateX, transformPerspective: 1200, transformStyle: 'preserve-3d' }}
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 0.4, ease }}
            >
              <PhoneMockup activeScreen={activeScreen} />
            </motion.div>

            {/* Text + CTA */}
            <div className="flex-1 space-y-4 order-2 lg:order-1 text-center lg:text-left">
              <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1, ease }}>
                <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.25em] uppercase text-secondary/70">
                  <span className="hidden lg:block w-12 h-px bg-gradient-to-r from-secondary to-transparent" />
                  Framtidens rekrytering
                </span>
              </motion.div>

              <motion.h1
                className="text-[2.4rem] leading-[0.92] sm:text-[3.2rem] md:text-[4rem] lg:text-[5.5rem] font-black tracking-[-0.04em] uppercase"
                initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.2, ease }}
              >
                <span className="text-white block">Swipe.</span>
                <span className="bg-gradient-to-r from-secondary via-[hsl(190_100%_55%)] to-secondary bg-clip-text text-transparent block">Matcha.</span>
                <span className="text-white/25 block text-[0.6em]">Anställ.</span>
              </motion.h1>

              <motion.p className="text-white/45 text-sm sm:text-base leading-relaxed font-medium max-w-md mx-auto lg:mx-0"
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6, ease }}>
                Rekrytering som känns lika enkelt som att scrolla sociala medier.{' '}
                <span className="text-white/25">Scrolla ner och se hur det fungerar.</span>
              </motion.p>

              {/* Step indicator — shows which screen is active */}
              <motion.div className="flex items-center justify-center lg:justify-start gap-1.5 pt-2"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.8 }}>
                {phoneScreens.map((screen, i) => (
                  <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] sm:text-[10px] font-semibold transition-all duration-500 ${
                    activeScreen === i
                      ? 'bg-secondary/20 text-secondary border border-secondary/30'
                      : 'bg-white/[0.03] text-white/20 border border-white/[0.04]'
                  }`}>
                    <screen.icon className="w-3 h-3" />
                    <span className="hidden sm:inline">{screen.label}</span>
                  </div>
                ))}
              </motion.div>

              <motion.div className="flex flex-col items-center lg:items-start gap-3 pt-2"
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8, ease }}>
                <button onClick={goTo}
                  className="group relative flex items-center gap-3 px-7 py-3.5 rounded-full bg-secondary text-primary font-bold text-sm
                    hover:bg-[hsl(200_100%_65%)] active:scale-[0.97] transition-all duration-300
                    shadow-[0_0_40px_hsl(200_100%_60%/0.25),0_0_80px_hsl(200_100%_60%/0.08)]">
                  <span className="absolute inset-0 rounded-full bg-secondary/30 animate-landing-cta-pulse" />
                  <span className="relative z-10 flex items-center gap-3">
                    Kom igång gratis
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
                <span className="text-white/20 text-[10px] sm:text-xs tracking-wider">Inget kreditkort · Gratis under beta</span>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 1 }}>
          <span className="text-white/15 text-[9px] font-medium tracking-widest uppercase">Scrolla</span>
          <div className="w-5 h-8 rounded-full border border-white/[0.1] flex justify-center pt-1.5 animate-landing-scroll-border">
            <div className="w-1 h-1.5 rounded-full bg-secondary/60 animate-landing-scroll-dot" />
          </div>
        </motion.div>

        {/* Bottom line */}
        <div className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, hsl(200 100% 60% / 0.15), transparent)' }} />
      </div>
    </section>
  );
};

export default LandingHero;
