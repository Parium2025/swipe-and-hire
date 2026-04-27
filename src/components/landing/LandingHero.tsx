import { useEffect, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BriefcaseBusiness, Check, MapPin, MessageCircle, Sparkles } from 'lucide-react';

type LandingHeroProps = {
  scrollContainerRef: RefObject<HTMLDivElement>;
};

const messages = ['Är du tillgänglig?', 'Ja, absolut.', 'Perfekt matchning.'];

const TypingMessages = () => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentMessage = messages[messageIndex];
    const isComplete = displayText === currentMessage;
    const isEmpty = displayText.length === 0;

    const timeout = window.setTimeout(
      () => {
        if (!isDeleting && isComplete) {
          setIsDeleting(true);
          return;
        }

        if (isDeleting && isEmpty) {
          setIsDeleting(false);
          setMessageIndex((index) => (index + 1) % messages.length);
          return;
        }

        setDisplayText((text) =>
          isDeleting ? currentMessage.slice(0, text.length - 1) : currentMessage.slice(0, text.length + 1),
        );
      },
      !isDeleting && isComplete ? 1700 : isDeleting ? 46 : 92,
    );

    return () => window.clearTimeout(timeout);
  }, [displayText, isDeleting, messageIndex]);

  return (
    <div className="min-h-[44px] max-w-[168px] text-left font-mono text-[12px] font-semibold leading-snug text-primary">
      <span>{displayText}</span>
      <motion.span
        className="ml-1 inline-block h-3 w-1 translate-y-0.5 bg-secondary"
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
};

const PhoneMockup = () => (
  <motion.div
    className="relative mx-auto h-[520px] w-[258px] sm:h-[590px] sm:w-[292px] md:h-[650px] md:w-[322px]"
    initial={{ opacity: 0, y: 42, rotate: -2 }}
    animate={{ opacity: 1, y: 0, rotate: 0 }}
    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.18 }}
  >
    <div className="absolute -inset-12 rounded-full bg-primary-glow/20 blur-[80px]" />
    <div className="relative h-full rounded-[2.7rem] border border-white/20 bg-white/12 p-3 shadow-[0_34px_110px_hsl(var(--primary)/0.45)] backdrop-blur-xl">
      <div className="h-full overflow-hidden rounded-[2.15rem] border border-white/10 bg-[linear-gradient(180deg,hsl(var(--primary))_0%,hsl(var(--primary)/0.96)_55%,hsl(var(--primary-glow)/0.32)_100%)]">
        <div className="mx-auto mt-3 h-5 w-24 rounded-full bg-white/12" />
        <div className="px-5 pt-6 text-primary-foreground">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
            <span>Parium</span>
            <span>Live</span>
          </div>
          <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                <BriefcaseBusiness className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold">Produktdesigner</p>
                <p className="text-xs text-white/55">Stockholm · Hybrid</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-white/60">
              <MapPin className="h-3.5 w-3.5" />
              <span>Matchar din profil till 94%</span>
            </div>
          </div>

          <div className="mt-4 rounded-[1.4rem] border border-secondary/20 bg-secondary/15 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold text-secondary">
              <MessageCircle className="h-4 w-4" />
              <span>Ny kontakt</span>
            </div>
            <TypingMessages />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {['Snabb ansökan', 'Verifierad roll'].map((label) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/8 p-3">
                <Check className="mb-2 h-4 w-4 text-secondary" />
                <p className="text-[11px] font-semibold leading-tight text-white/70">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-x-6 bottom-8 rounded-[1.6rem] border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Redo att matcha</p>
              <p className="text-xs text-white/55">3 nya möjligheter idag</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);

const LandingHero = ({ scrollContainerRef }: LandingHeroProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: 0, behavior: 'auto' });
  }, [scrollContainerRef]);

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-gradient-parium px-5 pb-14 pt-24 sm:px-8 md:pt-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-6 top-28 h-2 w-2 rounded-full bg-secondary/60" />
        <div className="absolute left-[12%] top-[32%] h-3 w-3 rounded-full bg-white/20" />
        <div className="absolute right-[10%] top-24 h-2.5 w-2.5 rounded-full bg-secondary/45" />
        <div className="absolute bottom-[18%] right-8 h-4 w-4 rounded-full bg-accent/35" />
        <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-primary-glow/25 blur-[95px]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-9rem)] w-full max-w-[1180px] items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
        <div className="mx-auto max-w-2xl text-center md:mx-0 md:text-left">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/60 backdrop-blur-xl"
          >
            <span className="h-2 w-2 rounded-full bg-secondary" />
            Jobbmatchning i realtid
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
            className="text-balance text-5xl font-black leading-[0.92] tracking-normal text-white sm:text-6xl lg:text-7xl"
          >
            Hitta rätt jobb. Matcha på sekunder.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.22 }}
            className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg md:mx-0"
          >
            Parium kopplar ihop kandidater och arbetsgivare med smarta matchningar, snabb kontakt och ett flöde som känns naturligt från första swipen.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.36 }}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row md:justify-start"
          >
            <motion.button
              type="button"
              onPointerDown={handleStart}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="group inline-flex min-h-touch items-center gap-3 rounded-full bg-secondary px-7 py-3.5 text-sm font-bold text-secondary-foreground shadow-[0_18px_56px_hsl(var(--secondary)/0.35)] transition-shadow hover:shadow-[0_22px_70px_hsl(var(--secondary)/0.45)]"
            >
              Kom igång gratis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </motion.button>
            <span className="text-sm font-medium text-white/45">För kandidater och arbetsgivare</span>
          </motion.div>
        </div>

        <AnimatePresence>
          <PhoneMockup />
        </AnimatePresence>
      </div>
    </section>
  );
};

export default LandingHero;