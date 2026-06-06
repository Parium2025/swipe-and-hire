import { memo } from 'react';

type WaveDividerProps = {
  className?: string;
};

/**
 * Organic liquid/glaze divider — en tjock, varm off-white "glasyr" som rinner
 * upp i den marinblå hero-sektionen ovanför med rundade droppar i varierande
 * längder, plus några fristående droppar som svävar lite högre upp.
 *
 * Färgen styrs av `--landing-light` så hela enterprise-paletten hänger ihop.
 * SVG:n behåller aspect ratio (xMidYMax slice) så de rundade dropparna inte
 * plattas till på breda skärmar.
 */

// Vertikala droppar: x-position (av 1440), bredd, höjd över baslinjen.
const DRIPS: { x: number; w: number; h: number }[] = [
  { x: 42, w: 26, h: 78 },
  { x: 112, w: 18, h: 52 },
  { x: 170, w: 22, h: 108 },
  { x: 238, w: 16, h: 44 },
  { x: 296, w: 30, h: 134 },
  { x: 372, w: 20, h: 70 },
  { x: 438, w: 26, h: 96 },
  { x: 510, w: 18, h: 56 },
  { x: 576, w: 24, h: 122 },
  { x: 650, w: 20, h: 68 },
  { x: 718, w: 28, h: 92 },
  { x: 794, w: 16, h: 48 },
  { x: 854, w: 22, h: 112 },
  { x: 920, w: 26, h: 80 },
  { x: 994, w: 18, h: 60 },
  { x: 1058, w: 30, h: 138 },
  { x: 1136, w: 20, h: 72 },
  { x: 1202, w: 24, h: 100 },
  { x: 1272, w: 18, h: 54 },
  { x: 1334, w: 26, h: 116 },
  { x: 1398, w: 20, h: 66 },
];

// Fristående droppar som svävar i hero-zonen ovanför baslinjen.
const DOTS: { x: number; y: number; r: number }[] = [
  { x: 86, y: 36, r: 5 },
  { x: 214, y: 22, r: 4 },
  { x: 340, y: 44, r: 7 },
  { x: 482, y: 26, r: 5 },
  { x: 624, y: 38, r: 6 },
  { x: 770, y: 20, r: 4 },
  { x: 900, y: 48, r: 7 },
  { x: 1032, y: 28, r: 5 },
  { x: 1172, y: 42, r: 6 },
  { x: 1310, y: 30, r: 5 },
  { x: 1420, y: 50, r: 4 },
];

const BASELINE = 180; // y där tjocka glasyren börjar
const VIEWBOX_H = 280;
const VIEWBOX_W = 1440;

const WaveDivider = memo(({ className = '' }: WaveDividerProps) => {
  return (
    <div
      className={`pointer-events-none relative z-10 -mb-px h-40 w-full overflow-hidden sm:h-52 md:h-60 lg:h-64 ${className}`}
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full"
      >
        <g fill="hsl(var(--landing-light))">
          {/* Tjock baslinje — själva "glasyren" som rinner ut från sektionen nedanför */}
          <rect x="0" y={BASELINE} width={VIEWBOX_W} height={VIEWBOX_H - BASELINE} />

          {/* Rundade droppar som sticker upp i hero-blått, alla smälter samman med baslinjen */}
          {DRIPS.map((d, i) => {
            const top = BASELINE - d.h;
            const radius = d.w / 2;
            // Höjd extra +radius så att rundningen sitter ovanför basen utan att lämna gap nedåt.
            const height = d.h + radius + 2;
            return (
              <rect
                key={`drip-${i}`}
                x={d.x - radius}
                y={top - radius}
                width={d.w}
                height={height}
                rx={radius}
                ry={radius}
              />
            );
          })}

          {/* Fristående droppar — som glasyr som stänkt loss */}
          {DOTS.map((c, i) => (
            <circle key={`dot-${i}`} cx={c.x} cy={c.y} r={c.r} />
          ))}
        </g>
      </svg>
    </div>
  );
});

WaveDivider.displayName = 'WaveDivider';

export default WaveDivider;
