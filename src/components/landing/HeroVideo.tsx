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
      {/* Dark overlay for text legibility */}
      <div className="absolute inset-0 bg-background/55 sm:bg-background/50" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 to-background/85" />
    </div>
  );
};

export default HeroVideo;
