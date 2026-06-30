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

  // Premium-entré: mjuk opacity + liten translateY, exakt som SEO/yrkessidornas hero.
  // Alla element animeras samtidigt — ingen stagger, ingen trappa.
  const fadeStyle = { willChange: 'opacity, transform' } as const;
  const premiumEase = [0.22, 1, 0.36, 1] as const;

  return (
    <>
      <motion.span
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: premiumEase }}
        style={fadeStyle}
        className={eyebrowClass}
      >
        {eyebrow}
      </motion.span>

      <motion.h1
        id={headingId}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: premiumEase }}
        style={fadeStyle}
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
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: premiumEase }}
        style={fadeStyle}
        className={subtitleClass}
      >
        {subtitle}
      </motion.p>



    </>
  );
};

export default HeroText;
