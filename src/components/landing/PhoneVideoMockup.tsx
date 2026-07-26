import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

interface PhoneVideoMockupProps {
  className?: string;
  style?: CSSProperties;
  /** Behålls för API-kompatibilitet med tidigare 3D-telefon (påverkar inte layout). */
  zoom?: number;
  /** Pausar videon när telefonen inte syns. */
  active?: boolean;
  /** Extra nedskalning av telefonen inom sin container (0–1). */
  scale?: number;
}

const VIDEO_SRC = '/landing-phone-demo.mp4';
const POSTER_SRC = '/landing-phone-demo-poster.jpg';

/** Skärmens proportion – matchar inspelningen (640 × 1386) exakt. */
const SCREEN_ASPECT = 640 / 1386;

/**
 * Telefon-mockup i samma stil som profil-förhandsgranskningen, fast i
 * Apple-kvalitet: titanram, Dynamic Island, sidoknappar och glasreflex.
 *
 * Storleken räknas ut i px från containerns faktiska mått (ResizeObserver),
 * så telefonen skalar korrekt på allt från iPhone SE till 4K-skärmar utan
 * att videon någonsin brevlådas eller sträcks.
 */
export const PhoneVideoMockup = ({
  className,
  style,
  active = true,
  scale = 0.94,
}: PhoneVideoMockupProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('parium:spline-ready'));
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  // Mät containern och räkna ut största telefon som får plats med rätt
  // proportion – både höjd- och breddbegränsad.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const measure = () => {
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const availW = rect.width * scale;
      const availH = rect.height * scale;
      const h = Math.min(availH, availW / SCREEN_ASPECT);
      setBox({ w: Math.round(h * SCREEN_ASPECT), h: Math.round(h) });
    };

    measure();
    const ro = 'ResizeObserver' in window ? new ResizeObserver(measure) : null;
    ro?.observe(host);
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('orientationchange', measure, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [scale]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');

    if (!active) {
      v.pause();
      return;
    }

    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    };
    tryPlay();
    v.addEventListener('canplay', tryPlay);
    v.addEventListener('loadeddata', tryPlay);
    return () => {
      v.removeEventListener('canplay', tryPlay);
      v.removeEventListener('loadeddata', tryPlay);
    };
  }, [active]);

  // Alla detaljer skalas proportionellt mot telefonens bredd → identiskt
  // utseende oavsett om telefonen är 180px eller 520px bred.
  const w = box?.w ?? 0;
  const bezel = Math.max(2, w * 0.026);           // svart ram runt skärmen
  const rim = Math.max(1, w * 0.009);             // titankant ytterst
  const outerRadius = w * 0.163;
  const screenRadius = outerRadius - bezel;
  const islandW = w * 0.3;
  const islandH = islandW * 0.29;
  const islandTop = w * 0.045;
  const buttonW = Math.max(1.5, w * 0.011);

  return (
    <div
      ref={hostRef}
      data-spline-phone
      aria-hidden="true"
      className={`relative flex select-none items-center justify-center overflow-visible ${className ?? ''}`}
      style={style}
    >
      {box && (
        <div className="relative" style={{ width: box.w, height: box.h }}>
          {/* Ambient glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-[14%] rounded-[46%] bg-secondary/20 blur-3xl"
          />

          {/* Titanram (ytterkant) */}
          <div
            className="relative h-full w-full"
            style={{
              borderRadius: outerRadius,
              padding: rim,
              background:
                'linear-gradient(160deg, rgba(255,255,255,0.55) 0%, rgba(160,170,185,0.35) 18%, rgba(30,34,42,0.9) 45%, rgba(120,130,145,0.35) 78%, rgba(255,255,255,0.45) 100%)',
              boxShadow: `0 ${w * 0.16}px ${w * 0.34}px -${w * 0.11}px rgba(0,0,0,0.75), 0 ${w * 0.03}px ${w * 0.08}px -${w * 0.04}px rgba(0,0,0,0.5)`,
            }}
          >
            {/* Sidoknappar */}
            <span
              className="absolute"
              style={{
                left: -buttonW,
                top: '20%',
                width: buttonW,
                height: w * 0.055,
                borderRadius: buttonW,
                background: 'linear-gradient(180deg, rgba(190,196,206,0.9), rgba(70,76,86,0.9))',
              }}
            />
            <span
              className="absolute"
              style={{
                left: -buttonW,
                top: '29%',
                width: buttonW,
                height: w * 0.095,
                borderRadius: buttonW,
                background: 'linear-gradient(180deg, rgba(190,196,206,0.9), rgba(70,76,86,0.9))',
              }}
            />
            <span
              className="absolute"
              style={{
                left: -buttonW,
                top: '42%',
                width: buttonW,
                height: w * 0.095,
                borderRadius: buttonW,
                background: 'linear-gradient(180deg, rgba(190,196,206,0.9), rgba(70,76,86,0.9))',
              }}
            />
            <span
              className="absolute"
              style={{
                right: -buttonW,
                top: '31%',
                width: buttonW,
                height: w * 0.155,
                borderRadius: buttonW,
                background: 'linear-gradient(180deg, rgba(190,196,206,0.9), rgba(70,76,86,0.9))',
              }}
            />

            {/* Svart bezel */}
            <div
              className="relative h-full w-full overflow-hidden bg-black"
              style={{ borderRadius: outerRadius - rim, padding: bezel }}
            >
              {/* Skärm */}
              <div
                className="relative h-full w-full overflow-hidden bg-black"
                style={{ borderRadius: screenRadius }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  poster={POSTER_SRC}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <source src={VIDEO_SRC} type="video/mp4" />

                {/* Dynamic Island */}
                <div
                  className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 bg-black"
                  style={{ top: islandTop, width: islandW, height: islandH, borderRadius: islandH }}
                />

                {/* Glasreflex */}
                <div
                  className="pointer-events-none absolute inset-0 z-10"
                  style={{
                    borderRadius: screenRadius,
                    background:
                      'linear-gradient(122deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 16%, rgba(255,255,255,0) 38%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.06) 100%)',
                  }}
                />

                {/* Inre kant för djup */}
                <div
                  className="pointer-events-none absolute inset-0 z-10"
                  style={{
                    borderRadius: screenRadius,
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.09)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhoneVideoMockup;
