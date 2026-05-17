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
    : 'text-[10px] sm:text-xs font-bold uppercase tracking-[0.24em] sm:tracking-[0.28em] text-secondary/80';

  const headlineClass = isMobile
    ? 'mt-6 max-w-4xl text-[3.25rem] font-black leading-[1.04] tracking-[-0.025em] text-white drop-shadow-[0_4px_24px_hsl(var(--background)/0.6)] sm:text-[4rem] md:text-[5rem]'
    : 'mt-4 sm:mt-5 lg:mt-6 max-w-4xl text-[2.75rem] xs:text-[3rem] sm:text-[3.5rem] md:text-[4rem] lg:text-[5rem] xl:text-[6rem] 2xl:text-[7rem] font-black leading-[1.04] tracking-[-0.025em] text-white';

  const subtitleClass = isMobile
    ? 'mt-7 max-w-xl text-base leading-8 text-white drop-shadow-[0_2px_12px_hsl(var(--background)/0.55)]'
    : 'mt-5 sm:mt-6 lg:mt-7 max-w-xl text-base sm:text-base md:text-lg lg:text-lg leading-7 sm:leading-7 lg:leading-8 text-white';

  // Premium-entré: enbart opacity. Ingen blur, ingen skugga, ingen translate.
  // Långsam, lugn ease (Apple-style) med en mjuk stagger rad-för-rad.
  const fadeStyle = { willChange: 'opacity' } as const;
  const premiumEase = [0.22, 1, 0.36, 1] as const;

  return (
    <>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: premiumEase, delay: 0.2 }}
        style={fadeStyle}
        className={eyebrowClass}
      >
        {eyebrow}
      </motion.span>

      <h1 id={headingId} className={headlineClass}>
        {headline.map((line, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.6, ease: premiumEase, delay: 0.5 + i * 0.32 }}
            style={fadeStyle}
            className="block"
          >
            {line}
          </motion.span>
        ))}
      </h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: premiumEase, delay: 0.5 + headline.length * 0.32 + 0.15 }}
        style={fadeStyle}
        className={subtitleClass}
      >
        {subtitle}
      </motion.p>
    </>
  );
};

export default HeroText;
