import React, { memo, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { EmployerNewsCard } from '@/components/dashboard/EmployerNewsCard';
import { EmployerStatsCard } from '@/components/dashboard/EmployerStatsCard';
import { EmployerNotesCard } from '@/components/dashboard/EmployerNotesCard';
import { EmployerInterviewsCard } from '@/components/dashboard/EmployerInterviewsCard';

/** Wraps carousel cards so their pause-state doesn't re-render siblings */
const NewsCardWrapper = memo(() => {
  const [isPaused, setIsPaused] = useState(false);
  return <EmployerNewsCard isPaused={isPaused} setIsPaused={setIsPaused} />;
});
NewsCardWrapper.displayName = 'NewsCardWrapper';

const StatsCardWrapper = memo(() => {
  const [isPaused, setIsPaused] = useState(false);
  return <EmployerStatsCard isPaused={isPaused} setIsPaused={setIsPaused} />;
});
StatsCardWrapper.displayName = 'StatsCardWrapper';

// Main Dashboard Grid
export const HomeDashboardGrid = memo(() => {
  const isMobile = useIsMobile();

  const mobileOrder = (
    <>
      <StatsCardWrapper />
      <EmployerInterviewsCard />
      <NewsCardWrapper />
      <EmployerNotesCard />
    </>
  );

  const desktopOrder = (
    <>
      <NewsCardWrapper />
      <StatsCardWrapper />
      <EmployerNotesCard />
      <EmployerInterviewsCard />
    </>
  );

  return (
    <div className="dashboard-page-stack">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
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

HomeDashboardGrid.displayName = 'HomeDashboardGrid';
