import { useInViewAnimation } from '@/hooks/useInViewAnimation';
import LandingV2Button from './Button';

const HeroSection = () => {
  const { ref, inView } = useInViewAnimation();

  const cls = (delay: number) =>
    inView ? 'animate-landing-fade-in-up' : 'opacity-0';
  const style = (delay: number) => ({ animationDelay: `${delay}s` });

  return (
    <section
      ref={ref}
      className="relative z-10 mx-auto w-full max-w-[440px] px-6 pt-28 md:pt-32"
    >
      <div className={cls(0.1)} style={style(0.1)}>
        <h2 className="font-pp-mondwest text-[32px] md:text-[40px] lg:text-[44px] font-semibold text-white tracking-tight mb-4">
          Parium
        </h2>
      </div>

      <p
        className={`font-mono text-xs md:text-sm text-white/70 mb-2 ${cls(0.2)}`}
        style={style(0.2)}
      >
        Studion bakom rekrytering på 60 sekunder
      </p>

      <h1
        className={`font-pp-neue text-[32px] md:text-[40px] lg:text-[44px] leading-[1.1] text-white tracking-tight ${cls(
          0.3,
        )}`}
        style={style(0.3)}
      >
        <span className="block">Bygg framtidens</span>
        <span className="block">
          <span className="font-pp-mondwest italic">team, snabbt.</span>
        </span>
      </h1>

      <div
        className={`flex flex-col gap-6 text-sm md:text-base text-white/85 leading-relaxed mt-5 md:mt-6 ${cls(
          0.4,
        )}`}
        style={style(0.4)}
      >
        <p>
          Vi byggde Parium för att rekrytering är trasigt. Trasiga annonser, trasiga
          CV:n, trasiga processer. På 60 sekunder swipear du fram en match som
          faktiskt funkar.
        </p>
        <p>
          Teamet är medvetet litet. Jag och en handfull byggare som rör oss snabbt
          utan att tumma på kvalitet — för dig som söker jobb och dig som söker folk.
        </p>
        <p>Annonsering startar från 0 kr per månad.</p>
      </div>

      <div
        className={`flex flex-col sm:flex-row gap-3 md:gap-4 mt-5 md:mt-6 ${cls(
          0.5,
        )}`}
        style={style(0.5)}
      >
        <LandingV2Button variant="primary">Kom igång</LandingV2Button>
        <LandingV2Button variant="secondary">Se hur det funkar</LandingV2Button>
      </div>
    </section>
  );
};

export default HeroSection;
