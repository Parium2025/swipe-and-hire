import { useRef, useState } from 'react';

interface SplinePhoneProps {
  className?: string;
}

const SCENE_URL = 'https://my.spline.design/untitled-R9AE3iFR515l7EKvHCNavLb7/';

/**
 * Renderar Parium-telefonen som en interaktiv 3D-scen från Spline via iframe.
 *
 * Interaktion:
 * - En transparent overlay ligger ovanpå iframen och fångar normalt all input
 *   så sidan kan scrollas (wheel/touch) utan att Spline-scenen "stjäl" gesten.
 * - När användaren håller in/trycker på telefonen kopplas overlayen bort
 *   tillfälligt så att Spline tar emot pointer-events och man kan vrida 3D-modellen.
 * - När pekaren släpps återaktiveras overlayen.
 */
export const SplinePhone = ({ className }: SplinePhoneProps) => {
  const [interactive, setInteractive] = useState(false);
  const releaseTimer = useRef<number | null>(null);

  const enableInteraction = () => {
    if (releaseTimer.current) {
      window.clearTimeout(releaseTimer.current);
      releaseTimer.current = null;
    }
    setInteractive(true);

    const release = () => {
      // Liten fördröjning så Spline hinner ta emot pointerup innan overlayen återkommer
      releaseTimer.current = window.setTimeout(() => setInteractive(false), 150);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };

    window.addEventListener('pointerup', release, { once: true });
    window.addEventListener('pointercancel', release, { once: true });
  };

  return (
    <div className={`relative ${className ?? ''}`}>
      <iframe
        src={SCENE_URL}
        title="Parium 3D-telefon"
        loading="lazy"
        allow="autoplay; fullscreen"
        scrolling="no"
        tabIndex={-1}
        className="h-full w-full border-0 bg-transparent"
        style={{ colorScheme: 'normal' }}
      />
      {/*
        Transparent overlay – fångar scroll/wheel/touch så sidan kan rullas,
        men släpper igenom interaktionen när användaren aktivt trycker ner pekaren
        för att vrida 3D-modellen.
      */}
      <div
        aria-hidden="true"
        onPointerDown={enableInteraction}
        className="absolute inset-0"
        style={{
          pointerEvents: interactive ? 'none' : 'auto',
          touchAction: 'pan-y',
          background: 'transparent',
          cursor: 'grab',
        }}
      />
    </div>
  );
};

export default SplinePhone;
