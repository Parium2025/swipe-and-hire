import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Video-showcase för jobbsökare — visar en riktig telefoninspelning av appen
 * i en snygg mockup-ram. Loopar, muted, autoplay, playsInline. Presenterad
 * som en levande produktdemo direkt under intro-texten.
 *
 * Cross-device:
 *  - Mobil: staplas under intro-texten, full bredd (max 320px), centrerad.
 *  - Tablet/Desktop: sitter till höger om texten via grid i föräldern; här
 *    hanterar vi bara innermockup + video så komponenten funkar i båda layouts.
 */
const JobSeekerVideoShowcase = ({ className = '' }: { className?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.setAttribute('autoplay', '');
    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    };
    tryPlay();
    const onCanPlay = () => tryPlay();
    const onVisible = () => {
      if (document.visibilityState === 'visible') tryPlay();
    };
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('loadeddata', onCanPlay);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', tryPlay);
    return () => {
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('loadeddata', onCanPlay);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', tryPlay);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.94 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 1.1, ease }}
      className={`relative mx-auto w-full max-w-[280px] sm:max-w-[300px] md:max-w-[320px] ${className}`}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-secondary/25 blur-3xl"
      />
      {/* Phone frame */}
      <div className="relative overflow-hidden rounded-[2.4rem] border border-white/15 bg-black/40 p-[6px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <div className="relative overflow-hidden rounded-[2.05rem] bg-black">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster="/showcase-jobseeker-poster.jpg"
            aria-label="Demo av Parium-appen för jobbsökare"
            className="block h-auto w-full"
          >
            <source src="/showcase-jobseeker.hevc.mp4" type='video/mp4; codecs="hvc1"' />
            <source src="/showcase-jobseeker.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </motion.div>
  );
};

export default JobSeekerVideoShowcase;
