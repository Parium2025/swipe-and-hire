import { motion } from 'framer-motion';

const HeroVideo = () => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <motion.video
        initial={{ opacity: 0, scale: 1.06 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        src="/hero-video.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Subtle bottom gradient for button legibility (Job&Talent style) */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
    </div>
  );
};

export default HeroVideo;
