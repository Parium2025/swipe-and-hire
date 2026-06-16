import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;

interface FaqAccordionProps {
  q: string;
  a: string;
}

/**
 * Premium FAQ-accordion med samma mjuka glid-ner-animation som
 * "Se alla funktioner" på landningssidan: + roterar 45° och svaret
 * animeras in med höjd + opacity. Används överallt på SEO-sidor.
 */
const FaqAccordion = ({ q, a }: FaqAccordionProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur-xl overflow-hidden transition-colors hover:border-secondary/25">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[56px] cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left text-base font-semibold text-white sm:text-lg"
      >
        <span>{q}</span>
        <motion.span
          className="ml-4 text-secondary text-xl leading-none flex-shrink-0"
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.35, ease }}
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.45, ease },
              opacity: { duration: 0.3, ease, delay: open ? 0.08 : 0 },
            }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-6 text-sm leading-7 text-white/85 sm:text-base">
              <span className="font-semibold text-white">Svar: </span>
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FaqAccordion;
