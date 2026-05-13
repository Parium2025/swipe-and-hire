interface SplinePhoneProps {
  className?: string;
}

const SCENE_URL = 'https://my.spline.design/untitled-R9AE3iFR515l7EKvHCNavLb7/';

/**
 * Renderar Parium-telefonen som en interaktiv 3D-scen från Spline via iframe.
 * Iframe är det stabila sättet att bädda in en publicerad Spline-scen utan
 * att behöva exportera .splinecode-filen.
 */
export const SplinePhone = ({ className }: SplinePhoneProps) => {
  return (
    <div className={className}>
      <iframe
        src={SCENE_URL}
        title="Parium 3D-telefon"
        loading="lazy"
        allow="autoplay; fullscreen"
        className="h-full w-full border-0 bg-transparent"
        style={{ colorScheme: 'normal' }}
      />
    </div>
  );
};

export default SplinePhone;
