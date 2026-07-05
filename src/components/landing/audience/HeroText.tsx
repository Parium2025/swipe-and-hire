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
    ? 'landing-h2 mt-5 max-w-4xl min-[376px]:mt-6 md:[@media_(orientation:portrait)]:mx-auto md:[@media_(orientation:portrait)]:max-w-[min(88vw,52rem)]'
    : 'landing-h2 mt-6 max-w-[min(92vw,60rem)] md:[@media_(orientation:portrait)]:mx-auto md:[@media_(orientation:portrait)]:max-w-[min(88vw,52rem)]';

  // Följer samma vågmask som bakgrunden: vit på blått, blå på vitt.
  const subtitleClass = isMobile
    ? 'wave-text mt-7 max-w-xl text-base leading-8 font-medium md:[@media_(orientation:portrait)]:mx-auto md:[@media_(orientation:portrait)]:mt-10 md:[@media_(orientation:portrait)]:max-w-[min(82vw,46rem)] md:[@media_(orientation:portrait)]:text-2xl md:[@media_(orientation:portrait)]:leading-9'
    : 'wave-text mt-7 max-w-xl text-lg leading-8 font-medium md:[@media_(orientation:landscape)_and_(min-width:900px)_and_(max-width:1400px)]:text-xl md:[@media_(orientation:landscape)_and_(min-width:900px)_and_(max-width:1400px)]:leading-9 md:[@media_(orientation:landscape)_and_(min-width:900px)_and_(max-width:1400px)]:max-w-2xl md:[@media_(orientation:portrait)]:mx-auto md:[@media_(orientation:portrait)]:mt-10 md:[@media_(orientation:portrait)]:max-w-[min(82vw,46rem)] md:[@media_(orientation:portrait)]:text-2xl md:[@media_(orientation:portrait)]:leading-9';

  // Texten får aldrig vänta på Spline/3D-lagret. Om telefonen är sen eller
  // previewn renderar om ska hero-copy alltid vara synlig direkt, utan tom blå yta.
  const visibleStyle = { opacity: 1, transform: 'none' } as const;

  return (
    <>
      <motion.span
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        style={visibleStyle}
        className={eyebrowClass}
      >
        {eyebrow}
      </motion.span>

      <motion.h1
        id={headingId}
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        style={visibleStyle}
        className={headlineClass}
      >
        {headline.map((line, i) => (
          <span
            key={i}
            className={isMobile ? 'wave-text block' : 'wave-text block whitespace-nowrap'}
          >
            {line}
          </span>
        ))}
      </motion.h1>

      <motion.p
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        style={visibleStyle}
        className={subtitleClass}
      >
        {subtitle}
      </motion.p>



    </>
  );
};

export default HeroText;
