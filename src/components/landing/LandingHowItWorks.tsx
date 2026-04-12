import { UserPlus, Search, Handshake } from 'lucide-react';

const steps = [
  {
    icon: UserPlus,
    step: '01',
    title: 'Skapa profil',
    description: 'Registrera dig snabbt, ladda upp CV och aktivera video om du vill sticka ut direkt.',
  },
  {
    icon: Search,
    step: '02',
    title: 'Swipea & matcha',
    description: 'Se relevanta jobb eller kandidater först, utan långa listor eller onödigt brus.',
  },
  {
    icon: Handshake,
    step: '03',
    title: 'Anställ direkt',
    description: 'Chatta, boka intervju och gå från match till anställning i ett sammanhängande flöde.',
  },
];

const LandingHowItWorks = () => {
  return (
    <section
      id="hur-det-funkar"
      className="relative px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24 lg:py-40"
      aria-labelledby="how-heading"
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-14 max-w-[42rem] sm:mb-16 lg:mb-18">
          <span className="landing-eyebrow">Hur det funkar</span>
          <h2 id="how-heading" className="mt-6 text-[clamp(2.35rem,5vw,4.6rem)] font-bold leading-[0.96] tracking-[-0.05em] text-pure-white">
            Från profil till intervju i tre tydliga steg.
          </h2>
          <p className="mt-6 max-w-[38rem] text-[1rem] leading-8 text-pure-white sm:text-[1.05rem]">
            Designat för att kännas snabbt för kandidater och extremt överblickbart för arbetsgivare — oavsett om du använder touch eller mus.
          </p>
        </header>

        <div className="landing-panel-strong rounded-[2rem] p-6 sm:p-8 lg:p-10">
          <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
            {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article
                key={step.step}
                className="landing-panel rounded-[1.6rem] p-6 text-left sm:p-7"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] border border-[hsl(var(--landing-border)/0.18)] bg-[hsl(var(--landing-panel)/0.82)] sm:h-16 sm:w-16">
                    <Icon className="h-7 w-7 text-pure-white" strokeWidth={1.5} />
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(var(--landing-border)/0.18)] bg-[hsl(var(--landing-panel)/0.76)] text-xs font-bold tracking-[0.2em] text-pure-white">
                    {step.step}
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-semibold tracking-[-0.03em] text-pure-white sm:text-[1.4rem]">
                  {step.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-pure-white sm:text-[0.95rem]">
                  {step.description}
                </p>
              </article>
            );
          })}
          </div>

          <div className="mt-5 rounded-[1.6rem] border border-[hsl(var(--landing-border)/0.14)] bg-[hsl(var(--landing-panel)/0.62)] p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-pure-white">Varför det känns premium</p>
            <p className="mt-3 max-w-[58rem] text-sm leading-7 text-pure-white sm:text-[0.96rem]">
              Allt är byggt för tydlighet: kandidater får ett snabbt flöde med hög kontrast och låg friktion, medan arbetsgivare får ett rekryteringsverktyg där varje steg känns kontrollerat, modernt och redo för skala.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingHowItWorks;
