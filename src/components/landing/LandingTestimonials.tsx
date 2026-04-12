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

const faqs = [
  {
    question: 'Vad är Parium?',
    answer:
      'Parium är en AI-driven rekryteringsplattform för företag och kandidater i Sverige och Norden med swipe-matchning, video-profiler, screening och direktmeddelanden.',
  },
  {
    question: 'Hur fungerar AI-rekrytering i Parium?',
    answer:
      'Plattformen använder AI-screening, urvalslogik och direktdialog för att korta tiden från första intresse till intervju och anställning.',
  },
  {
    question: 'Fungerar Parium på mobil, surfplatta och desktop?',
    answer:
      'Ja, upplevelsen är byggd för Android, iPhone, surfplatta, laptop och stora skärmar med stöd för både touch och mus.',
  },
  {
    question: 'Kan både företag och kandidater använda Parium?',
    answer:
      'Ja, Parium har tydliga flöden för arbetsgivare som vill hitta kandidater och för kandidater som vill hitta jobb snabbare.',
  },
];

const LandingTestimonials = () => {
  return (
    <section
      className="relative px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24 lg:py-40"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:gap-6">
          <div>
            <header className="max-w-[34rem]">
              <span className="landing-eyebrow">Resultat och FAQ</span>
              <h2 id="testimonials-heading" className="mt-6 text-[clamp(2.35rem,5vw,4.6rem)] font-bold leading-[0.96] tracking-[-0.05em] text-pure-white">
                Byggd för att kännas självklar i verklig rekrytering.
              </h2>
              <p className="mt-6 text-[1rem] leading-8 text-pure-white sm:text-[1.05rem]">
                Social proof för människorna i flödet och tydliga svar för Google, kandidater och arbetsgivare som vill förstå produkten direkt.
              </p>
            </header>

            <div className="mt-6 grid gap-4">
              {testimonials.map((testimonial) => (
                <blockquote key={testimonial.name} className="landing-panel rounded-[1.6rem] p-6 sm:p-7">
                  <p className="text-lg leading-8 text-pure-white">“{testimonial.quote}”</p>
                  <footer className="mt-6 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[hsl(var(--landing-border)/0.18)] bg-[hsl(var(--landing-panel)/0.84)] text-xs font-semibold text-pure-white">
                      {testimonial.initials}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-pure-white">{testimonial.name}</div>
                      <div className="text-sm text-pure-white">{testimonial.role}</div>
                    </div>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>

          <div className="landing-panel-strong rounded-[2rem] p-6 sm:p-8 lg:p-10">
            <div className="grid gap-4">
              {faqs.map((faq) => (
                <article key={faq.question} className="rounded-[1.4rem] border border-[hsl(var(--landing-border)/0.14)] bg-[hsl(var(--landing-panel)/0.62)] p-5 sm:p-6">
                  <h3 className="text-lg font-semibold tracking-[-0.03em] text-pure-white">{faq.question}</h3>
                  <p className="mt-3 text-sm leading-7 text-pure-white sm:text-[0.96rem]">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingTestimonials;
