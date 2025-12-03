import { motion } from 'framer-motion';

interface SlidingTabsProps {
  isLogin: boolean;
  onTabChange: (value: string) => void;
}

export function SlidingTabs({ isLogin, onTabChange }: SlidingTabsProps) {
  return (
    <div className="relative flex bg-white/10 backdrop-blur-sm rounded-lg p-1 border border-white/20 mb-6">
      {/* Sliding background */}
      <motion.div
        className="absolute top-1 bottom-1 bg-parium-navy rounded-md"
        initial={false}
        animate={{
          left: isLogin ? '4px' : '50%',
          width: 'calc(50% - 4px)',
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
      />
      
      {/* Buttons */}
      <button
        type="button"
        onClick={() => onTabChange('login')}
        className="relative z-10 flex-1 py-2 px-4 rounded-md text-sm font-medium text-white transition-colors"
      >
        Logga in
      </button>
      <button
        type="button"
        onClick={() => onTabChange('signup')}
        className="relative z-10 flex-1 py-2 px-4 rounded-md text-sm font-medium text-white transition-colors"
      >
        Registrera
      </button>
    </div>
  );
}
