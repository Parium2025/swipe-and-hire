/**
 * WaveDivider
 * Premium SVG-våg som visuellt delar en sektion. Används på publika
 * landningssidor för att övergå från mörk blå topp till off-white botten.
 *
 * - `fill` defaultar till landing-light token (off-white).
 * - `flip` vänder vågen vertikalt (för uppåt-böjda divider).
 * - Höjd skalar mellan mobil (~56px) och desktop (~130px).
 */
type WaveDividerProps = {
  fill?: string;
  flip?: boolean;
  className?: string;
  ariaHidden?: boolean;
};

export const WaveDivider = ({
  fill = 'hsl(var(--landing-light))',
  flip = false,
  className = '',
  ariaHidden = true,
}: WaveDividerProps) => {
  return (
    <div
      className={`pointer-events-none w-full leading-[0] ${className}`}
      style={{ transform: flip ? 'scaleY(-1)' : undefined }}
      aria-hidden={ariaHidden}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 140"
        preserveAspectRatio="none"
        className="block h-[56px] w-full sm:h-[80px] md:h-[110px] lg:h-[130px]"
      >
        <path
          d="M0,72 C220,128 420,16 720,52 C980,84 1180,140 1440,84 L1440,140 L0,140 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
};

export default WaveDivider;
