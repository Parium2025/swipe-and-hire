import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';

interface SwipeEndSectionProps {
  sectionHeight: string;
  showEndBounce: boolean;
  endStateVisible: boolean;
}

const ease = [0.22, 1, 0.36, 1] as const;

export const SwipeEndSection = memo(forwardRef<HTMLDivElement, SwipeEndSectionProps>(
  function SwipeEndSection({ sectionHeight, showEndBounce, endStateVisible }, ref) {
    const isVisible = endStateVisible || showEndBounce;

    return (
      <div
        ref={ref}
        aria-hidden="true"
        className="w-full shrink-0 snap-start snap-always flex items-center justify-center px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
        style={{ minHeight: sectionHeight, height: sectionHeight }}
      >
      <motion.div
          initial={false}
          animate={
            isVisible
              ? { opacity: 1, scale: 1 }
              : { opacity: 0, scale: 0.96 }
          }
          transition={{
            opacity: { duration: 0.25, ease },
            scale: { duration: 0.25, ease },
          }}
          className="w-full max-w-[27rem] rounded-[1.75rem] border border-white/25 bg-primary/30 px-8 py-6 shadow-2xl"
        >
          <motion.p
            initial={false}
            animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.24, ease, delay: isVisible ? 0.05 : 0 }}
            className="text-center text-[15px] font-medium text-white sm:text-base"
          >
            Inga fler jobb just nu
          </motion.p>
        </motion.div>
      </div>
    );
  }
));