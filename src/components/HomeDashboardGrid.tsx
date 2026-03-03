import { memo, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { EmployerNewsCard } from '@/components/dashboard/EmployerNewsCard';
import { EmployerStatsCard } from '@/components/dashboard/EmployerStatsCard';
import { EmployerNotesCard } from '@/components/dashboard/EmployerNotesCard';
import { EmployerInterviewsCard } from '@/components/dashboard/EmployerInterviewsCard';

// Main Dashboard Grid
export const HomeDashboardGrid = memo(() => {
  const [isCardsPaused, setIsCardsPaused] = useState(false);
  const isMobile = useIsMobile();

  // Mobile: Statistik → Intervjuer → Nyheter → Anteckningar
  // Desktop: behåll 2x2 grid (Nyheter/Stats top, Notes/Interviews bottom)
  const mobileOrder = (
    <>
      <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <EmployerStatsCard isPaused={isCardsPaused} setIsPaused={setIsCardsPaused} />
      </motion.div>
      <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <EmployerInterviewsCard />
      </motion.div>
      <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <EmployerNewsCard isPaused={isCardsPaused} setIsPaused={setIsCardsPaused} />
      </motion.div>
      <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <EmployerNotesCard />
      </motion.div>
    </>
  );

  const desktopOrder = (
    <>
      <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <EmployerNewsCard isPaused={isCardsPaused} setIsPaused={setIsCardsPaused} />
      </motion.div>
      <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <EmployerStatsCard isPaused={isCardsPaused} setIsPaused={setIsCardsPaused} />
      </motion.div>
      <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <EmployerNotesCard />
      </motion.div>
      <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <EmployerInterviewsCard />
      </motion.div>
    </>
  );

  return (
    <div className="space-y-2 sm:space-y-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-2"
      >
        <h2 className="text-base sm:text-lg font-semibold text-white">Din översikt</h2>
        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
      </motion.div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
        {isMobile ? mobileOrder : desktopOrder}
      </div>
    </div>
  );
});

HomeDashboardGrid.displayName = 'HomeDashboardGrid';
