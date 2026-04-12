import { motion } from 'framer-motion';

const testimonials = [
  {
    quote: 'Vi hittade tre perfekta kandidater på mindre än en vecka. Parium förändrade helt hur vi rekryterar.',
    name: 'Emma Lindström',
    role: 'HR-chef, TechCo AB',
    initials: 'EL',
  },
  {
    quote: 'Swipe-funktionen gör det genuint roligt att söka jobb. Jag fick mitt drömjobb på tre dagar.',
    name: 'Marcus Eriksson',
    role: 'Utvecklare',
    initials: 'ME',
  },
  {
    quote: 'AI-screeningen sparar oss 15 timmar per vecka. Det känns som att ha en extra rekryterare i teamet.',
    name: 'Sara Bergqvist',
    role: 'VD, StartupHub',
    initials: 'SB',
  },
];

const LandingTestimonials = () => {
  return (
    <section
      className="relative px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24 lg:py-40"
      aria-labelledby="testimonials-heading"
    >
      <div className="absolute left-1/2 top-0 h-px w-2/3 max-w-lg -translate-x-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="mx-auto max-w-7xl">
        <motion.header
          className="mb-16 text-center sm:mb-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
          <span className="mb-4 block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/86 sm:text-xs">
            Social proof
          </span>
          <h2 id="testimonials-heading" className="text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl md:text-5xl">
            Älskad av rekryterare
            <span className="text-white"> och jobbsökare</span>
          </h2>
        </motion.header>

        <div className="grid gap-5 sm:gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.blockquote
              key={t.name}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative rounded-2xl border border-white/[0.05] bg-white/[0.015] p-6 transition-colors duration-300 hover:bg-white/[0.03] sm:p-8"
            >
              <div className="mb-4 font-serif text-5xl leading-none text-white/22" aria-hidden="true">"</div>
              <p className="mb-6 text-[14px] leading-relaxed text-white/82 sm:text-[15px]">
                {t.quote}
              </p>
              <footer className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.05] text-xs font-semibold text-white">
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{t.name}</div>
                  <div className="text-xs text-white/68">{t.role}</div>
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
