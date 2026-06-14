/**
 * SeoBubbles — bakgrund identisk med landningssidan (jobbsökare/AudienceLanding).
 * Två mjuka glow-orbs + diskreta vita prickar. Pointer-events: none, helt dekorativt.
 * Placeras som första barn inuti en `relative` hero-sektion.
 */
const dots = [
  { top: '8%', left: '6%', size: 6, opacity: 0.35 },
  { top: '14%', left: '12%', size: 3, opacity: 0.5 },
  { top: '22%', left: '4%', size: 4, opacity: 0.4 },
  { top: '6%', right: '8%', size: 4, opacity: 0.45 },
  { top: '16%', right: '14%', size: 6, opacity: 0.3 },
  { top: '28%', right: '6%', size: 3, opacity: 0.5 },
  { bottom: '14%', left: '8%', size: 4, opacity: 0.35 },
  { bottom: '20%', right: '10%', size: 5, opacity: 0.35 },
  { bottom: '8%', right: '20%', size: 3, opacity: 0.5 },
] as const;

const SeoBubbles = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
    {/* Stor mjuk glow uppe till höger – matchar AudienceLanding hero */}
    <div
      className="absolute -top-40 right-[-25%] h-[640px] w-[640px] rounded-full bg-secondary/[0.10] blur-[180px]"
    />
    {/* Mjuk glow uppe i mitten */}
    <div
      className="absolute -top-24 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-70"
      style={{
        background:
          'radial-gradient(60% 60% at 50% 50%, rgba(70,130,255,0.22) 0%, rgba(70,130,255,0) 70%)',
      }}
    />
    {/* Subtil glow nere till vänster */}
    <div
      className="absolute -bottom-40 left-[-20%] h-[520px] w-[520px] rounded-full bg-secondary/[0.07] blur-[160px]"
    />
    {/* Diskreta vita prickar */}
    {dots.map((d, i) => (
      <span
        key={i}
        className="absolute rounded-full bg-white"
        style={{
          top: (d as any).top,
          bottom: (d as any).bottom,
          left: (d as any).left,
          right: (d as any).right,
          width: d.size,
          height: d.size,
          opacity: d.opacity,
          filter: 'blur(0.5px)',
        }}
      />
    ))}
  </div>
);

export default SeoBubbles;
