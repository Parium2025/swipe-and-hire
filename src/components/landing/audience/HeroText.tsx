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
    ? 'mt-6 max-w-4xl text-[3.25rem] font-black leading-[1.04] tracking-[-0.025em] text-white drop-shadow-[0_4px_24px_hsl(var(--background)/0.6)] sm:text-[4rem] md:text-[5rem]'
    : 'mt-6 max-w-4xl text-[5rem] font-black leading-[1.04] tracking-[-0.025em] text-white lg:text-[6rem] 2xl:text-[7rem]';

  const subtitleClass = isMobile
    ? 'mt-7 max-w-xl text-base leading-8 text-white drop-shadow-[0_2px_12px_hsl(var(--background)/0.55)]'
    : 'mt-7 max-w-xl text-lg leading-8 text-white';

  // Pure opacity-fade (ingen y-translate på stora bold-rubriker) — translate
  // på 7rem font-black + ev. drop-shadow tvingar fram tunga repaints varje
  // frame och hackar. Opacity composit:as på GPU och förblir smooth även
  // medan Spline + bubblor renderas i bakgrunden.
  const fadeStyle = { willChange: 'opacity', transform: 'translateZ(0)' } as const;

  return (
    <>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, ease, delay: 0.05 }}
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
            transition={{ duration: 0.85, ease, delay: 0.18 + i * 0.14 }}
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
        transition={{ duration: 0.7, ease, delay: 0.18 + headline.length * 0.14 }}
        style={fadeStyle}
        className={subtitleClass}
      >
        {subtitle}
      </motion.p>
    </>
  );
};

export default HeroText;
