const testimonials = [
  {
    quote: 'Det här känns mer som ett produktbolag än ett traditionellt HR-verktyg. Vi fick överblick direkt.',
    name: 'Emma Lindström',
    role: 'HR-chef, TechCo AB',
    initials: 'EL',
  },
  {
    quote: 'Jag förstod direkt hur jag skulle agera på mobilen. Snabbt, tydligt och mycket snyggare än allt annat jag testat.',
    name: 'Marcus Eriksson',
    role: 'Utvecklare',
    initials: 'ME',
  },
  {
    quote: 'AI-screeningen gör att vi lägger tiden på rätt kandidater istället för att drunkna i manuellt urval.',
    name: 'Sara Bergqvist',
    role: 'VD, StartupHub',
    initials: 'SB',
  },
];

const faqs = [
  {
    question: 'Vad är Parium?',
    answer:
      'Parium är en AI-driven rekryteringsplattform för företag och kandidater i Sverige och Norden med jobbmatchning, video, screening och direktdialog i samma system.',
  },
  {
    question: 'Hur fungerar AI-rekrytering i Parium?',
    answer:
      'Plattformen kombinerar AI-screening, urvalslogik och direktdialog för att korta vägen från intresse till intervju och anställning.',
  },
  {
    question: 'Fungerar Parium på mobil, surfplatta och desktop?',
    answer:
      'Ja, upplevelsen är byggd för Android, iPhone, surfplatta, laptop och stora skärmar med stöd för touch, mus och responsiv skalning.',
  },
  {
    question: 'Kan både företag och kandidater använda Parium?',
    answer:
      'Ja, Parium har separata men sammanhängande flöden för arbetsgivare som vill hitta kandidater och kandidater som vill hitta jobb snabbare.',
  },
  {
    question: 'Varför är landningssidan byggd så här?',
    answer:
      'För att spegla produktens premiumkänsla bättre, skapa tydligare budskap för båda målgrupperna och ge starkare SEO med semantisk struktur, FAQ och tydligare innehåll.',
  },
];

const LandingTestimonials = () => {
  return (
    <section id="faq" className="relative px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24 lg:py-40" aria-labelledby="testimonials-heading">
      <div className="mx-auto max-w-7xl">
        <header className="max-w-[46rem]">
          <span className="landing-eyebrow">Proof & SEO</span>
          <h2 id="testimonials-heading" className="mt-6 text-[clamp(2.35rem,5vw,4.8rem)] font-bold leading-[0.94] tracking-[-0.06em] text-pure-white">
            Social proof för människor. Tydliga svar för Google.
          </h2>
          <p className="mt-6 text-[1rem] leading-8 text-pure-white sm:text-[1.05rem]">
            Sektionen nedan är skriven för att övertyga två gånger: först visuellt för besökaren, sedan strukturellt för sökmotorer som läser sidan semantiskt.
          </p>
        </header>

        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            {testimonials.map((testimonial, index) => (
              <blockquote key={testimonial.name} className={`landing-story-card rounded-[1.7rem] p-6 sm:p-7 ${index === 2 ? 'md:col-span-2' : ''}`}>
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

          <div className="grid gap-4">
            {faqs.map((faq) => (
              <article key={faq.question} className="landing-faq-card rounded-[1.5rem] p-5 sm:p-6">
                <h3 className="text-lg font-semibold tracking-[-0.03em] text-pure-white">{faq.question}</h3>
                <p className="mt-3 text-sm leading-7 text-pure-white sm:text-[0.96rem]">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingTestimonials;
