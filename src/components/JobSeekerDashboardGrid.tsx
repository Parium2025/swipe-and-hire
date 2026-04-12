import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { CareerTipsCard } from '@/components/dashboard/CareerTipsCard';
import { JobSeekerStatsCard } from '@/components/dashboard/JobSeekerStatsCard';
import { JobSeekerNotesCard } from '@/components/dashboard/JobSeekerNotesCard';
import { JobSeekerInterviewsCard } from '@/components/dashboard/JobSeekerInterviewsCard';

/** Wraps carousel cards so their pause-state doesn't re-render siblings */
const TipsCardWrapper = memo(() => {
  const [isPaused, setIsPaused] = useState(false);
  return <CareerTipsCard isPaused={isPaused} setIsPaused={setIsPaused} />;
});
TipsCardWrapper.displayName = 'TipsCardWrapper';

const StatsCardWrapper = memo(() => {
  const [isPaused, setIsPaused] = useState(false);
  return <JobSeekerStatsCard isPaused={isPaused} setIsPaused={setIsPaused} />;
});
StatsCardWrapper.displayName = 'StatsCardWrapper';


// Main Dashboard Grid for Job Seekers
export const JobSeekerDashboardGrid = memo(() => {
  const isMobile = useIsMobile();

  const mobileOrder = (
    <>
      <div><StatsCardWrapper /></div>
      <div><JobSeekerInterviewsCard /></div>
      <div><TipsCardWrapper /></div>
      <div><JobSeekerNotesCard /></div>
    </>
  );

  const desktopOrder = (
    <>
      <div><TipsCardWrapper /></div>
      <div><StatsCardWrapper /></div>
      <div><JobSeekerNotesCard /></div>
      <div><JobSeekerInterviewsCard /></div>
    </>
  );

  return (
    <div className="dashboard-page-stack">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-2"
      >
        <h2 className="dashboard-section-heading font-semibold text-white">Din översikt</h2>
        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
      </motion.div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
        {isMobile ? mobileOrder : desktopOrder}
      </div>
    </div>
  );
});

JobSeekerDashboardGrid.displayName = 'JobSeekerDashboardGrid';
