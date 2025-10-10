import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export const ScrollTransition = () => {
  const scrollToNext = () => {
    const nextSection = document.getElementById('experience-section');
    nextSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative h-48 flex items-center justify-center">
      {/* Gradient fade */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      {/* Animated floating dots */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-secondary/30 rounded-full blur-sm"
            initial={{ 
              x: `${20 + i * 15}%`,
              y: -20,
              opacity: 0 
            }}
            animate={{ 
              y: 200,
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: "linear",
              delay: i * 0.4
            }}
          />
        ))}
      </div>

      {/* Central scroll indicator */}
      <motion.button
        onClick={scrollToNext}
        className="relative z-10 flex flex-col items-center gap-3 group cursor-pointer"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          className="text-white/60 text-sm font-medium group-hover:text-secondary transition-colors"
          initial={{ opacity: 0.6 }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Upptäck mer
        </motion.div>
        
        <motion.div
          className="relative"
          animate={{ y: [0, 8, 0] }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <div className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center group-hover:bg-white/10 group-hover:border-secondary/30 transition-all">
            <ChevronDown className="w-6 h-6 text-white/70 group-hover:text-secondary transition-colors" />
          </div>
          
          {/* Glow effect */}
          <motion.div
            className="absolute inset-0 rounded-full bg-secondary/20 blur-xl"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>

        {/* Animated line */}
        <motion.div
          className="w-px bg-gradient-to-b from-white/20 via-secondary/40 to-transparent"
          initial={{ height: 0 }}
          animate={{ height: 60 }}
          transition={{ duration: 1, delay: 0.5 }}
        />
      </motion.button>
    </div>
  );
};
