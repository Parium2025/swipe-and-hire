import { motion } from 'framer-motion';

const ease = [0.22, 1, 0.36, 1] as const;

const testimonials = [
  {
    quote: 'Vi hittade tre perfekta kandidater på mindre än en vecka. Parium förändrade helt hur vi rekryterar.',
    name: 'Emma Lindström',
    role: 'HR-chef, TechCo AB',
    initials: 'EL',
  },
  {
    quote: 'Swipe-funktionen gör det genuint roligt att söka jobb. Jag fick mitt drömjobb på 3 dagar.',
    name: 'Marcus Eriksson',
    role: 'Utvecklare',
    initials: 'ME',
  },
  {
    quote: 'AI-screeningen sparar oss 15 timmar per vecka. Det är som att ha en extra rekryterare i teamet.',
    name: 'Sara Bergqvist',
    role: 'VD, StartupHub',
    initials: 'SB',
  },
];

const LandingTestimonials = () => (
  <section
    className="relative py-24 sm:py-32 lg:py-40 px-5 sm:px-6 md:px-12 lg:px-24"
    aria-labelledby="testimonials-heading"
  >
    <div className="max-w-[1400px] mx-auto">
      <motion.div
        className="mb-16 sm:mb-24"
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease }}
      >
        <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] uppercase text-white/30">
          <span className="w-8 sm:w-12 h-px bg-gradient-to-r from-[hsl(250_80%_70%)] to-transparent" />
          Vad folk säger
        </span>
        <h2
          id="testimonials-heading"
          className="mt-4 text-3xl sm:text-5xl md:text-6xl font-black tracking-[-0.04em] text-white uppercase"
        >
          Älskad
          <span className="text-white/15"> av alla.</span>
        </h2>
      </motion.div>

      {/* Editorial testimonial blocks */}
      <div className="space-y-4 sm:space-y-6">
        {testimonials.map((t, i) => (
          <motion.blockquote
            key={t.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.1, ease }}
            className="relative flex flex-col sm:flex-row items-start gap-6 sm:gap-10 p-6 sm:p-10 rounded-2xl sm:rounded-3xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.025] hover:border-white/[0.08] transition-all duration-500"
          >
            {/* Large quote mark */}
            <div className="text-[5rem] sm:text-[8rem] font-black leading-none text-white/[0.03] select-none flex-shrink-0 -mt-4 sm:-mt-6">
              "
            </div>

            <div className="flex-1">
              <p className="text-white/50 text-base sm:text-lg md:text-xl leading-relaxed mb-6 font-medium italic">
                {t.quote}
              </p>
              <footer className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(250_60%_50%/0.25)] to-[hsl(200_80%_50%/0.25)] border border-white/[0.06] flex items-center justify-center text-white text-xs font-bold">
                  {t.initials}
                </div>
                <div>
                  <div className="text-white text-sm font-semibold">{t.name}</div>
                  <div className="text-white/20 text-xs">{t.role}</div>
                </div>
              </footer>
            </div>
          </motion.blockquote>
        ))}
      </div>
    </div>
  </section>
);

export default LandingTestimonials;
