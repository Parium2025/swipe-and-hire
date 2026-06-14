/**
 * SeoBubbles — diskreta, lugna bubbel-prickar à la landningssidan.
 * Pure dekoration, pointer-events: none, ingen layout-påverkan.
 * Använd som första barn inuti hero-sektionen (relative-container).
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
