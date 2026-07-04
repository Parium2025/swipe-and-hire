import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  PenLine,
  Users,
  LayoutGrid,
  UserPlus,
  MessagesSquare,
  Mail,
  type LucideIcon,
} from 'lucide-react';

type JourneyStep = {
  title: string;
  body: string;
  icon: LucideIcon;
};

const steps: JourneyStep[] = [
  {
    title: 'Skapa annonsen på några minuter',
    body: 'Bygg en tydlig och professionell jobbannons direkt i appen eller i webben — steg för steg, utan krångliga mallar.',
    icon: PenLine,
  },
  {
    title: 'Möt kandidater som verkligen vill',
    body: 'Ni ser bara kandidater som aktivt sökt just er roll — inga slumpmässiga profiler eller kalla listor.',
    icon: Users,
  },
  {
    title: 'Samla favoriterna\u00a0',
    body: 'Lägg till kandidaterna ni vill gå vidare med och flytta dem mellan era egna steg i en tydlig vy.',
    icon: LayoutGrid,
  },
  {
    title: 'Rekrytera tillsammans med teamet',
    body: 'Med våra Premium-paket bjuder ni in kollegor och arbetar tillsammans i samma vy — välj antal användare efter behov.',
    icon: UserPlus,
  },
  {
    title: 'Öppna dialogen direkt',
    body: 'Chatta med kandidater som vill vidare, ställ följdfrågor och boka in intervju när det känns rätt.',
    icon: MessagesSquare,
  },
  {
    title: 'Ge alla kandidater ett svar',
    body: 'När processen är klar skickar Parium ett automatiskt mejl till de kandidater som inte gått vidare. Välj vår förinställda text eller skriv ert helt egna meddelande — så ingen lämnas utan återkoppling.',
    icon: Mail,
  },
];

const ease = [0.16, 1, 0.3, 1] as const;

function JourneyItem({
  step,
  index,
  isOpen,
  onToggle,
  reduce,
}: {
  step: JourneyStep;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  reduce: boolean;
}) {
  const Icon = step.icon;
  const number = String(index + 1);

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.7, ease, delay: Math.min(index, 5) * 0.09 }}
      className="relative"
    >
      <div className="grid gap-5 md:grid-cols-[56px_1fr] md:gap-8">
        {/* Nummer / ikon-kolumn */}
        <div className="relative flex md:justify-center">
          <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-secondary bg-gradient-to-br from-secondary/25 to-secondary/5 text-secondary shadow-[0_10px_30px_-16px_hsl(var(--secondary)/0.6)] [@media_(hover:hover)]:backdrop-blur-xl">
            <Icon className="h-6 w-6" strokeWidth={2} />
          </div>
        </div>

        {/* Textkort — nu klickbar accordion */}
        <article className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.055] to-white/[0.02] transition-[border-color,box-shadow] duration-500 hover:border-secondary/35 hover:shadow-[0_28px_60px_-30px_hsl(var(--secondary)/0.55)] [@media_(hover:hover)]:backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-secondary/60 to-transparent opacity-60 transition-opacity duration-500 group-hover:opacity-100" />

          <button
            type="button"
            aria-expanded={isOpen}
            onClick={onToggle}
            className="flex w-full min-h-[56px] cursor-pointer items-start justify-between gap-4 px-6 py-5 text-left sm:px-8 sm:py-6"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] font-semibold tracking-[0.28em] text-secondary/80">
                  STEG {number}
                </span>
                <span className="h-px flex-1 bg-gradient-to-r from-secondary/30 to-transparent" />
              </div>
              <h3 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
                {step.title}
              </h3>
            </div>
            <motion.span
              className="ml-4 mt-1 text-secondary text-xl leading-none flex-shrink-0"
              animate={{ rotate: isOpen ? 45 : 0 }}
              transition={{ duration: 0.35, ease }}
            >
              +
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {isOpen && (
              <motion.div
                key="content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  height: { duration: 0.45, ease },
                  opacity: { duration: 0.3, ease, delay: isOpen ? 0.08 : 0 },
                }}
                className="overflow-hidden"
              >
                <p className="px-6 pb-6 text-[15px] leading-7 text-white sm:px-8 sm:text-base">
                  {step.body}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </article>
      </div>
    </motion.li>
  );
}

export function EmployerJourney({ steps: stepsProp }: { steps?: JourneyStep[] } = {}) {
  const activeSteps = stepsProp ?? steps;
  const reduce = useReducedMotion() ?? false;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="relative mt-10 sm:mt-14">
      {/* Vertikal tidslinje — synlig från md och uppåt */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[27px] top-2 hidden h-[calc(100%-16px)] w-px bg-gradient-to-b from-secondary/60 via-secondary/25 to-transparent md:block"
      />

      <ol className="space-y-6 md:space-y-8">
        {activeSteps.map((step, idx) => (
          <JourneyItem
            key={step.title}
            step={step}
            index={idx}
            isOpen={openIndex === idx}
            onToggle={() => setOpenIndex((cur) => (cur === idx ? null : idx))}
            reduce={reduce}
          />
        ))}
      </ol>
    </div>
  );
}

export default EmployerJourney;
