import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { CareerTipsCard } from '@/components/dashboard/CareerTipsCard';
import { JobSeekerStatsCard } from '@/components/dashboard/JobSeekerStatsCard';
import { JobSeekerNotesCard } from '@/components/dashboard/JobSeekerNotesCard';
import { JobSeekerInterviewsCard } from '@/components/dashboard/JobSeekerInterviewsCard';

// Main Dashboard Grid for Job Seekers
export const JobSeekerDashboardGrid = memo(() => {
  const [isCardsPaused, setIsCardsPaused] = useState(false);
  const isMobile = useIsMobile();

  const mobileOrder = (
    <>
      <JobSeekerStatsCard isPaused={isCardsPaused} setIsPaused={setIsCardsPaused} />
      <JobSeekerInterviewsCard />
      <CareerTipsCard isPaused={isCardsPaused} setIsPaused={setIsCardsPaused} />
      <JobSeekerNotesCard />
    </>
  );

  const desktopOrder = (
    <>
      <CareerTipsCard isPaused={isCardsPaused} setIsPaused={setIsCardsPaused} />
      <JobSeekerStatsCard isPaused={isCardsPaused} setIsPaused={setIsCardsPaused} />
      <JobSeekerNotesCard />
      <JobSeekerInterviewsCard />
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

JobSeekerDashboardGrid.displayName = 'JobSeekerDashboardGrid';
