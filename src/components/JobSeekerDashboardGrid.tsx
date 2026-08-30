import { memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { CareerTipsCard } from '@/components/dashboard/CareerTipsCard';
import { JobSeekerStatsCard } from '@/components/dashboard/JobSeekerStatsCard';
import { JobSeekerNotesCard } from '@/components/dashboard/JobSeekerNotesCard';
import { JobSeekerInterviewsCard } from '@/components/dashboard/JobSeekerInterviewsCard';
import type { DashboardInterview } from '@/components/dashboard/JobSeekerInterviewsCard';
import { useCandidateInterviews } from '@/hooks/useInterviews';
import { useMinuteTick } from '@/hooks/useMinuteTick';
import { isInterviewOver } from '@/lib/interviewTime';

/** Wraps carousel cards so their pause-state doesn't re-render siblings */
const TipsCardWrapper = memo(() => {
  const [isPaused, setIsPaused] = useState(false);
  return <CareerTipsCard isPaused={isPaused} setIsPaused={setIsPaused} />;
});
TipsCardWrapper.displayName = 'TipsCardWrapper';

interface SharedInterviewStatsProps {
  liveInterviewsCount: number;
  interviewsLoaded: boolean;
}

const StatsCardWrapper = memo(({ liveInterviewsCount, interviewsLoaded }: SharedInterviewStatsProps) => {
  const [isPaused, setIsPaused] = useState(false);
  return (
    <JobSeekerStatsCard
      isPaused={isPaused}
      setIsPaused={setIsPaused}
      liveInterviewsCount={liveInterviewsCount}
      interviewsLoaded={interviewsLoaded}
    />
  );
});
StatsCardWrapper.displayName = 'StatsCardWrapper';

// Main Dashboard Grid for Job Seekers
interface JobSeekerDashboardGridProps {
  /** Home är dold (KeepAlive) → pausa visuella klockor. Data lämnas orörd. */
  isActive?: boolean;
}

export const JobSeekerDashboardGrid = memo(({ isActive = true }: JobSeekerDashboardGridProps) => {
  const isMobile = useIsMobile();

  // EN delad datakälla för kandidatens intervjuer — statistikkortet och
  // intervjukortet räknar exakt samma live-lista, så en pågående intervju
  // syns lika i båda.
  const {
    interviews,
    isLoading: interviewsLoading,
    isError: interviewsFailed,
    isSuccess: interviewsQuerySuccess,
    isPlaceholderData: interviewsArePlaceholder,
    refetch: refetchInterviews,
  } = useCandidateInterviews();
  // Placeholder-data ger status success — bara ett verkligt nätverkssvar får
  // auktorisera intervjustatistiken.
  const interviewsSucceeded = Boolean(interviewsQuerySuccess) && !interviewsArePlaceholder;
  const now = useMinuteTick(isActive);
  const liveInterviews = useMemo(
    () => (interviews as DashboardInterview[]).filter((i) => !isInterviewOver(i.scheduled_at, i.duration_minutes, now)),
    [interviews, now],
  );

  const mobileOrder = (
    <>
      <StatsCardWrapper liveInterviewsCount={liveInterviews.length} interviewsLoaded={interviewsSucceeded} />
      <JobSeekerInterviewsCard
        interviews={liveInterviews}
        isLoading={interviewsLoading}
        isError={interviewsFailed}
        onRetry={() => { void refetchInterviews(); }}
        now={now}
      />
      <TipsCardWrapper />
      <JobSeekerNotesCard />
    </>
  );

  const desktopOrder = (
    <>
      <TipsCardWrapper />
      <StatsCardWrapper liveInterviewsCount={liveInterviews.length} interviewsLoaded={interviewsSucceeded} />
      <JobSeekerNotesCard />
      <JobSeekerInterviewsCard
        interviews={liveInterviews}
        isLoading={interviewsLoading}
        isError={interviewsFailed}
        onRetry={() => { void refetchInterviews(); }}
        now={now}
      />
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

JobSeekerDashboardGrid.displayName = 'JobSeekerDashboardGrid';
