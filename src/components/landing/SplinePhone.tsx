import pariumPhoneScreen from '@/assets/parium-phone-screen.png';

interface SplinePhoneProps {
  className?: string;
  zoom?: number;
}

export const SplinePhone = ({ className }: SplinePhoneProps) => {
  return (
    <div
      className={`pointer-events-none relative flex select-none items-center justify-center ${className ?? ''}`}
      role="img"
      aria-label="Parium-telefon"
      style={{ touchAction: 'pan-y', overscrollBehavior: 'auto' }}
    >
      <div className="relative aspect-[9/19.5] h-full max-h-full rounded-[2.25rem] border-[5px] border-white/10 bg-[hsl(var(--background))] shadow-[0_22px_55px_hsl(var(--background)/0.45)]">
        <div className="absolute -left-2 top-[16%] h-8 w-1 rounded-l-full bg-white/25" />
        <div className="absolute -left-2 top-[26%] h-12 w-1 rounded-l-full bg-white/20" />
        <div className="absolute -right-2 top-[22%] h-16 w-1 rounded-r-full bg-white/20" />
        <div className="absolute inset-[5px] overflow-hidden rounded-[1.8rem] bg-primary">
          <img
            src={pariumPhoneScreen}
            alt="Parium på telefonskärm"
            className="h-full w-full object-cover object-center"
            draggable={false}
            loading="eager"
            decoding="async"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-white/[0.02]" />
        </div>
      </div>
    </div>
  );
};

export default SplinePhone;
