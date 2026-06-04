import { memo } from 'react';

/**
 * WaveBackdrop
 * Permanent dekorativ vågbakgrund som lever som ett fast lager — precis
 * som AnimatedBackground/bubblorna. Ligger `fixed` i viewporten bakom allt
 * innehåll, panar inte med scroll, blockerar inga klick.
 *
 * Tre mjuka lager i sekundär/accent med låg opacitet — ger premium djup
 * utan att konkurrera med text. Syns lika mycket på hela sidan.
 */
export const WaveBackdrop = memo(() => {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {/* Lager 1 — bred mjuk våg, övre tredjedel */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-[18%] h-[42vh] w-full opacity-[0.07] sm:opacity-[0.09]"
      >
        <path
          d="M0,200 C240,300 480,80 720,160 C960,240 1200,320 1440,180 L1440,400 L0,400 Z"
          fill="hsl(var(--secondary))"
        />
      </svg>

      {/* Lager 2 — motsatt rytm, mitten */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-[42%] h-[44vh] w-full opacity-[0.06] sm:opacity-[0.08]"
      >
        <path
          d="M0,240 C300,140 540,300 820,200 C1080,108 1280,200 1440,260 L1440,400 L0,400 Z"
          fill="hsl(var(--primary-glow, var(--secondary)))"
        />
      </svg>

      {/* Lager 3 — låg, brett bottenlager för extra djup */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-[38vh] w-full opacity-[0.05] sm:opacity-[0.07]"
      >
        <path
          d="M0,280 C260,200 520,340 760,260 C1020,180 1240,260 1440,220 L1440,400 L0,400 Z"
          fill="hsl(var(--secondary))"
        />
      </svg>
    </div>
  );
});

WaveBackdrop.displayName = 'WaveBackdrop';

export default WaveBackdrop;
