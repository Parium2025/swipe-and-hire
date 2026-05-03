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
      {/* Darkening overlay */}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60" />
    </div>
  );
};

export default HeroVideo;
