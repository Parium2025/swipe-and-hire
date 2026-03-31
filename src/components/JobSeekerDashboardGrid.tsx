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
  const [isTipsPaused, setIsTipsPaused] = useState(false);
  const [isStatsPaused, setIsStatsPaused] = useState(false);
  const isMobile = useIsMobile();

  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
  };

  const mobileOrder = (
    <>
      <motion.div variants={cardVariants}><JobSeekerStatsCard isPaused={isStatsPaused} setIsPaused={setIsStatsPaused} /></motion.div>
      <motion.div variants={cardVariants}><JobSeekerInterviewsCard /></motion.div>
      <motion.div variants={cardVariants}><CareerTipsCard isPaused={isTipsPaused} setIsPaused={setIsTipsPaused} /></motion.div>
      <motion.div variants={cardVariants}><JobSeekerNotesCard /></motion.div>
    </>
  );

  const desktopOrder = (
    <>
      <motion.div variants={cardVariants}><CareerTipsCard isPaused={isTipsPaused} setIsPaused={setIsTipsPaused} /></motion.div>
      <motion.div variants={cardVariants}><JobSeekerStatsCard isPaused={isStatsPaused} setIsPaused={setIsStatsPaused} /></motion.div>
      <motion.div variants={cardVariants}><JobSeekerNotesCard /></motion.div>
      <motion.div variants={cardVariants}><JobSeekerInterviewsCard /></motion.div>
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
      
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.08 } },
        }}
      >
        {isMobile ? mobileOrder : desktopOrder}
      </motion.div>
    </div>
  );
});

JobSeekerDashboardGrid.displayName = 'JobSeekerDashboardGrid';
