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
    ? 'text-xs font-bold uppercase tracking-[0.28em] text-secondary [text-indent:0.28em] md:[@media_(orientation:portrait)]:text-sm md:[@media_(orientation:portrait)]:tracking-[0.36em]'
    : 'text-xs font-bold uppercase tracking-[0.28em] text-secondary/80 md:[@media_(orientation:portrait)]:text-sm md:[@media_(orientation:portrait)]:tracking-[0.36em]';

  const headlineClass = isMobile
    ? 'audience-ipad-heading mt-5 max-w-4xl text-[2.5rem] font-black leading-[1.05] tracking-[0] min-[376px]:mt-6 min-[376px]:text-[3.25rem] min-[376px]:leading-[1.04] sm:text-[3.5rem] md:text-[3.75rem] md:[@media_(orientation:portrait)]:mx-auto md:[@media_(orientation:portrait)]:max-w-[min(88vw,52rem)] md:[@media_(orientation:portrait)]:text-[5.25rem] md:[@media_(orientation:portrait)]:leading-[1.0]'
    : 'audience-ipad-heading mt-6 max-w-[min(92vw,60rem)] text-[clamp(2.75rem,5.2vw,7rem)] font-black leading-[1.04] tracking-[0] md:[@media_(orientation:landscape)_and_(min-width:900px)_and_(max-width:1400px)]:text-[clamp(3.75rem,6.6vw,5.5rem)] md:[@media_(orientation:landscape)_and_(min-width:900px)_and_(max-width:1400px)]:leading-[1.02] md:[@media_(orientation:portrait)]:mx-auto md:[@media_(orientation:portrait)]:max-w-[min(88vw,52rem)] md:[@media_(orientation:portrait)]:text-[5.25rem] md:[@media_(orientation:portrait)]:leading-[1.0]';

  // Följer samma vågmask som bakgrunden: vit på blått, blå på vitt.
  const subtitleClass = isMobile
    ? 'wave-text mt-7 max-w-xl text-base leading-8 font-medium md:[@media_(orientation:portrait)]:mx-auto md:[@media_(orientation:portrait)]:mt-10 md:[@media_(orientation:portrait)]:max-w-[min(82vw,46rem)] md:[@media_(orientation:portrait)]:text-2xl md:[@media_(orientation:portrait)]:leading-9'
    : 'wave-text mt-7 max-w-xl text-lg leading-8 font-medium md:[@media_(orientation:landscape)_and_(min-width:900px)_and_(max-width:1400px)]:text-xl md:[@media_(orientation:landscape)_and_(min-width:900px)_and_(max-width:1400px)]:leading-9 md:[@media_(orientation:landscape)_and_(min-width:900px)_and_(max-width:1400px)]:max-w-2xl md:[@media_(orientation:portrait)]:mx-auto md:[@media_(orientation:portrait)]:mt-10 md:[@media_(orientation:portrait)]:max-w-[min(82vw,46rem)] md:[@media_(orientation:portrait)]:text-2xl md:[@media_(orientation:portrait)]:leading-9';

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
            className={isMobile ? 'wave-text block' : 'wave-text block whitespace-nowrap'}
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
