import { motion } from 'framer-motion';
import {
  PenLine,
  Users,
  LayoutGrid,
  UserPlus,
  MessagesSquare,
  LineChart,
  type LucideIcon,
} from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

type JourneyStep = {
  title: string;
  body: string;
  detail: string;
  icon: LucideIcon;
};

const steps: JourneyStep[] = [
  {
    title: 'Skapa annonsen på några minuter',
    body: 'Bygg en tydlig och professionell jobbannons direkt i appen — steg för steg, utan krångliga mallar.',
    detail: 'Fyll i det som är viktigt, förhandsgranska och publicera. Annonsen når kandidater i hela Sverige.',
    icon: PenLine,
  },
  {
    title: 'Möt kandidater som verkligen vill',
    body: 'Ni ser bara kandidater som aktivt sökt just er roll — inga slumpmässiga profiler eller kalla listor.',
    detail: 'Varje ansökan är ett faktiskt intresse. Ni börjar samtalet där det redan finns motivation.',
    icon: Users,
  },
  {
    title: 'Samla favoriterna i Kanban',
    body: 'Lägg till kandidaterna ni vill gå vidare med och flytta dem mellan era egna steg i en tydlig vy.',
    detail: 'Ni bygger er egen rekryteringsprocess och får full överblick på ett ställe — inga kalkylark, inga mejlkedjor.',
    icon: LayoutGrid,
  },
  {
    title: 'Rekrytera tillsammans med teamet',
    body: 'Med våra Premium-paket bjuder ni in kollegor och arbetar tillsammans i samma vy — välj antal användare efter behov.',
    detail: 'Alla ser samma kandidater, samma anteckningar och samma beslut. Ingen tappar tråden.',
    icon: UserPlus,
  },
  {
    title: 'Öppna dialogen direkt',
    body: 'Chatta med kandidater som vill vidare, ställ följdfrågor och boka in intervju när det känns rätt.',
    detail: 'All löpande kommunikation samlas i plattformen så ni slipper hoppa mellan mejl och sms.',
    icon: MessagesSquare,
  },
  {
    title: 'Följ upp med insikter',
    body: 'Se annonsens räckvidd, ansökningstakt och kandidatflöde i realtid.',
    detail: 'Justera annonsen om det behövs. Ni fattar beslut på riktig data — inte gissningar.',
    icon: LineChart,
  },
];

export function EmployerJourney() {
  return (
    <div className="relative mt-10 sm:mt-14">
      {/* Vertikal tidslinje — synlig från md och uppåt */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[27px] top-2 hidden h-[calc(100%-16px)] w-px bg-gradient-to-b from-secondary/60 via-secondary/25 to-transparent md:block"
      />

      <ol className="space-y-6 md:space-y-8">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const number = String(idx + 1);
          return (
            <motion.li
              key={step.title}
              initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, amount: 0.25, margin: '0px 0px -80px 0px' }}
              transition={{ duration: 0.7, ease, delay: idx * 0.05 }}
              className="relative"
            >
              <div className="grid gap-5 md:grid-cols-[56px_1fr] md:gap-8">
                {/* Nummer / ikon-kolumn */}
                <div className="relative flex md:justify-center">
                  <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-secondary/30 bg-gradient-to-br from-secondary/25 to-secondary/5 text-secondary shadow-[0_10px_30px_-16px_hsl(var(--secondary)/0.6)] backdrop-blur-xl">
                    <Icon className="h-6 w-6" strokeWidth={2} />
                    <span className="pointer-events-none absolute inset-0 rounded-2xl bg-secondary/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
                  </div>
                </div>

                {/* Textkort */}
                <article className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.055] to-white/[0.02] p-6 backdrop-blur-xl transition-[border-color,box-shadow,transform] duration-500 hover:-translate-y-0.5 hover:border-secondary/35 hover:shadow-[0_28px_60px_-30px_hsl(var(--secondary)/0.55)] sm:p-8">
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-secondary/60 to-transparent opacity-60 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,hsl(var(--secondary)/0.16),transparent_65%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] font-semibold tracking-[0.28em] text-secondary/80">
                      STEG {number}
                    </span>
                    <span className="h-px flex-1 bg-gradient-to-r from-secondary/30 to-transparent" />
                  </div>

                  <h3 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-7 text-white/85 sm:text-base">
                    {step.body}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-white/60">
                    {step.detail}
                  </p>
                </article>
              </div>
            </motion.li>
          );
        })}
      </ol>

      {/* Avslutande statement */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease, delay: 0.1 }}
        className="mt-10 rounded-3xl border border-secondary/25 bg-gradient-to-br from-secondary/[0.12] via-white/[0.03] to-transparent p-6 text-center backdrop-blur-xl sm:mt-14 sm:p-8"
      >
        <p className="text-base font-semibold text-white sm:text-lg">
          Ingen matchning i det tysta. Ingen svart låda.
        </p>
        <p className="mt-2 text-sm leading-7 text-white/75 sm:text-base">
          Ni ser exakt vilka som sökt, vad de vill och var i processen ni är — hela vägen till anställning.
        </p>
      </motion.div>
    </div>
  );
}

export default EmployerJourney;
