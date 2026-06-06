import { memo } from 'react';

type WaveDividerProps = {
  className?: string;
};

const WaveDivider = memo(({ className = '' }: WaveDividerProps) => {
  return (
    <div className={`pointer-events-none relative z-10 -mb-px h-28 w-full overflow-hidden sm:h-36 md:h-44 ${className}`} aria-hidden>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 180"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d="M0,78 C180,126 365,118 540,82 C748,38 912,36 1094,76 C1242,108 1338,112 1440,84 L1440,180 L0,180 Z"
          fill="hsl(var(--landing-light))"
        />
      </svg>
    </div>
  );
});

WaveDivider.displayName = 'WaveDivider';

export default WaveDivider;
