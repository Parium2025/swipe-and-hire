import { motion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;

type HeroTextProps = {
  eyebrow: string;
  headline: string[];
  subtitle: string;
  variant: 'mobile' | 'desktop';
  headingId?: string;
};

/**
 * Delad text-blockkomponent för hero på audience-landningssidan.
 *
 * Desktop är "source of truth" — ändringar i innehåll/animation görs här
 * och både mobil och desktop följer med automatiskt. Variant-prop styr
 * endast utseende-skillnader (drop-shadow, fontstorlek, opacitet) som är
 * specifika per layout, så 100% visuell paritet bevaras.
 */
export const HeroText = ({ eyebrow, headline, subtitle, variant, headingId }: HeroTextProps) => {
  const isMobile = variant === 'mobile';

  const eyebrowClass = isMobile
    ? 'text-xs font-bold uppercase tracking-[0.28em] text-secondary drop-shadow-[0_2px_8px_hsl(var(--background)/0.6)]'
    : 'text-xs font-bold uppercase tracking-[0.28em] text-secondary/80';

  const headlineClass = isMobile
    ? 'mt-6 max-w-4xl text-[3.25rem] font-black leading-[1.04] tracking-[-0.025em] text-white drop-shadow-[0_4px_24px_hsl(var(--background)/0.6)] sm:text-[4rem]'
    : 'mt-6 max-w-4xl text-[5rem] font-black leading-[1.04] tracking-[-0.025em] text-white lg:text-[6rem]';

  const subtitleClass = isMobile
    ? 'mt-7 max-w-xl text-base leading-8 text-white drop-shadow-[0_2px_12px_hsl(var(--background)/0.55)]'
    : 'mt-7 max-w-xl text-lg leading-8 text-white';

  return (
    <>
      <motion.span
        variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease } } }}
        className={eyebrowClass}
      >
        {eyebrow}
      </motion.span>

      <h1 id={headingId} className={headlineClass}>
        {headline.map((line, i) => (
          <motion.span
            key={i}
            variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease } } }}
            className="block"
          >
            {line}
          </motion.span>
        ))}
      </h1>

      <motion.p
        variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease } } }}
        className={subtitleClass}
      >
        {subtitle}
      </motion.p>
    </>
  );
};

export default HeroText;
