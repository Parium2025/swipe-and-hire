import { motion } from 'framer-motion';

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

const LandingTestimonials = () => {
  return (
    <section
      className="relative py-24 sm:py-32 lg:py-40 px-5 sm:px-6 md:px-12 lg:px-24"
      aria-labelledby="testimonials-heading"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 max-w-lg h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="max-w-7xl mx-auto">
        <motion.header
          className="text-center mb-16 sm:mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-secondary text-[11px] sm:text-xs font-semibold tracking-[0.2em] uppercase mb-4 block">
            Vad folk säger
          </span>
          <h2 id="testimonials-heading" className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-[-0.03em] text-white">
            Älskad av rekryterare{' '}
            <span className="text-white/40">och jobbsökare</span>
          </h2>
        </motion.header>

        <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
          {testimonials.map((t, i) => (
            <motion.blockquote
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative p-6 sm:p-8 rounded-2xl border border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.03] transition-colors duration-300"
            >
              {/* Quote mark */}
              <div className="text-secondary/20 text-5xl font-serif leading-none mb-4" aria-hidden="true">"</div>
              <p className="text-white/60 text-[14px] sm:text-[15px] leading-relaxed mb-6 italic">
                {t.quote}
              </p>
              <footer className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary/30 to-accent/30 border border-white/10 flex items-center justify-center text-white text-xs font-semibold">
                  {t.initials}
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{t.name}</div>
                  <div className="text-white/30 text-xs">{t.role}</div>
                </div>
              </footer>
            </motion.blockquote>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LandingTestimonials;
