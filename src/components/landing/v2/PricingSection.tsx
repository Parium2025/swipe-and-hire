import { useInViewAnimation } from '@/hooks/useInViewAnimation';
import LandingV2Button from './Button';

const PricingSection = () => {
  const { ref, inView } = useInViewAnimation();
  const cls = (d: number) =>
    inView ? 'animate-landing-fade-in-up' : 'opacity-0';
  const sd = (d: number) => ({ animationDelay: `${d}s` });

  return (
    <section
      ref={ref}
      className="relative z-10 w-full py-12 px-6"
      aria-labelledby="pricing-heading"
    >
      <h2 id="pricing-heading" className="sr-only">
        Priser
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:max-w-4xl md:ml-auto">
        {/* Card 1 — Premium */}
        <div
          className={`rounded-[40px] pl-10 pr-10 md:pr-16 pt-10 pb-10 ${cls(
            0.1,
          )}`}
          style={{
            ...sd(0.1),
            background: 'rgba(5, 26, 36, 0.55)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 60px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          <h3 className="text-[22px] font-medium text-white">
            Premium-partner
          </h3>
          <p className="mt-3 text-sm text-white/70 leading-relaxed">
            Dedikerad rekryteringsmotor.
            <br />
            Du jobbar direkt med oss.
          </p>
          <div className="mt-8">
            <div className="text-2xl text-white">2 990 kr</div>
            <div className="text-xs text-white/60 mt-1">per månad</div>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <LandingV2Button variant="primary">Kom igång</LandingV2Button>
            <LandingV2Button variant="secondary">Hur det funkar</LandingV2Button>
          </div>
        </div>

        {/* Card 2 — Light */}
        <div
          className={`rounded-[40px] pl-10 pr-10 md:pr-16 pt-10 pb-10 bg-white text-[#0D212C] shadow-[0_4px_16px_rgba(0,0,0,0.18)] ${cls(
            0.2,
          )}`}
          style={sd(0.2)}
        >
          <h3 className="text-[22px] font-medium">Engångsannons</h3>
          <p className="mt-3 text-sm text-[#0D212C]/70 leading-relaxed">
            Fast scope, fast tidsplan.
            <br />
            Samma kvalitet, ingen bindning.
          </p>
          <div className="mt-8">
            <div className="text-2xl">499 kr</div>
            <div className="text-xs text-[#0D212C]/60 mt-1">per annons</div>
          </div>
          <div className="mt-8 flex">
            <LandingV2Button
              variant="tertiary"
              className="!bg-[#051A24] !text-white"
            >
              Lägg upp jobb
            </LandingV2Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
