import { useEffect, useRef, type CSSProperties } from 'react';

interface PhoneVideoMockupProps {
  className?: string;
  style?: CSSProperties;
  /** Behålls för API-kompatibilitet med tidigare 3D-telefon (påverkar inte layout). */
  zoom?: number;
  /** Pausar videon när telefonen inte syns. */
  active?: boolean;
  /** Extra nedskalning av telefonen inom sin container. */
  scale?: number;
}

const VIDEO_SRC = '/landing-phone-demo.mp4';
const POSTER_SRC = '/landing-phone-demo-poster.jpg';

/**
 * Telefon-mockup med riktig appinspelning. Ersätter den tidigare
 * Spline-renderade 3D-telefonen — lättare, skarpare och alltid i rätt skala.
 */
export const PhoneVideoMockup = ({
  className,
  style,
  active = true,
  scale = 0.86,
}: PhoneVideoMockupProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('parium:spline-ready'));
    });
    return () => window.cancelAnimationFrame(id);
  }, []);



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

  return (
    <div
      data-spline-phone
      aria-hidden="true"
      className={`relative flex select-none items-center justify-center overflow-visible ${className ?? ''}`}
      style={style}
    >
      <div
        className="relative"
        style={{
          height: `${scale * 100}%`,
          aspectRatio: '9 / 19.5',
          maxWidth: `${scale * 100}%`,
        }}
      >
        {/* Ambient glow bakom telefonen */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-[12%] rounded-[42%] bg-secondary/20 blur-3xl"
        />

        {/* Ram */}
        <div className="relative h-full w-full overflow-hidden rounded-[13%/6.2%] border border-white/15 bg-black/70 p-[2.4%] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.75)]">
          <div className="relative h-full w-full overflow-hidden rounded-[11%/5.4%] bg-black">
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              poster={POSTER_SRC}
              className="h-full w-full object-cover"
            >
              <source src={VIDEO_SRC} type="video/mp4" />
            </video>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneVideoMockup;
