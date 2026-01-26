import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, AnimatePresence, PanInfo } from 'framer-motion';
import { Heart, X, MapPin, Clock, Building2, Eye, Users, Bookmark, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { useSavedJobs } from '@/hooks/useSavedJobs';

interface Job {
  id: string;
  title: string;
  company_name: string;
  location: string;
  employment_type?: string;
  job_image_url?: string;
  views_count: number;
  applications_count: number;
}

interface JobSwipeModeProps {
  jobs: Job[];
  appliedJobIds: Set<string>;
  onClose: () => void;
}

export function JobSwipeMode({ jobs, appliedJobIds, onClose }: JobSwipeModeProps) {
  const navigate = useNavigate();
  const { isJobSaved, toggleSaveJob } = useSavedJobs();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipedJobs, setSwipedJobs] = useState<Set<string>>(new Set());
  const [savedCount, setSavedCount] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  // Filter out already swiped jobs
  const availableJobs = useMemo(() => {
    return jobs.filter(job => !swipedJobs.has(job.id));
  }, [jobs, swipedJobs]);

  // Get current stack of cards (show top 3)
  const visibleCards = useMemo(() => {
    return availableJobs.slice(0, 3);
  }, [availableJobs]);

  const handleSwipe = useCallback((jobId: string, direction: 'left' | 'right') => {
    if (direction === 'right') {
      // Save job
      if (!isJobSaved(jobId)) {
        toggleSaveJob(jobId);
      }
      setSavedCount(prev => prev + 1);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 800);
    }

    // Mark as swiped
    setSwipedJobs(prev => new Set([...prev, jobId]));
  }, [isJobSaved, toggleSaveJob]);

  const handleViewJob = useCallback((jobId: string) => {
    navigate(`/job-view/${jobId}`);
  }, [navigate]);

  if (availableJobs.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-lg flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6"
        >
          <div className="w-20 h-20 mx-auto bg-parium-blue/20 rounded-full flex items-center justify-center">
            <Heart className="w-10 h-10 text-parium-blue fill-parium-blue" />
          </div>
          <h2 className="text-2xl font-bold text-white">Slut på jobb!</h2>
          <p className="text-white/70 max-w-xs">
            Du har gått igenom alla tillgängliga jobb. Du sparade {savedCount} jobb.
          </p>
          <Button
            onClick={onClose}
            className="bg-parium-blue hover:bg-parium-blue/90 text-white px-8"
          >
            Tillbaka till sökning
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-white hover:bg-white/10"
        >
          <ChevronLeft className="h-5 w-5 mr-1" />
          Tillbaka
        </Button>
        <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-full border border-white/20">
          <Bookmark className="w-4 h-4 text-parium-blue fill-parium-blue" />
          <span className="text-white font-medium">{savedCount} sparade</span>
        </div>
      </div>

      {/* Swipe Instructions */}
      <div className="flex justify-center gap-8 py-3 text-sm text-white/60">
        <div className="flex items-center gap-2">
          <X className="w-4 h-4 text-red-400" />
          <span>Swipa vänster = Hoppa över</span>
        </div>
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-green-400" />
          <span>Swipa höger = Spara</span>
        </div>
      </div>

      {/* Card Stack */}
      <div className="flex-1 relative flex items-center justify-center p-6">
        <div className="relative w-full max-w-sm h-[500px]">
          <AnimatePresence>
            {visibleCards.map((job, index) => (
              <SwipeCard
                key={job.id}
                job={job}
                index={index}
                isTop={index === 0}
                totalCards={visibleCards.length}
                hasApplied={appliedJobIds.has(job.id)}
                onSwipe={handleSwipe}
                onViewJob={handleViewJob}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="flex justify-center gap-6 p-6 pb-safe">
        <button
          onClick={() => visibleCards[0] && handleSwipe(visibleCards[0].id, 'left')}
          className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center transition-all active:scale-90 hover:bg-red-500/30"
        >
          <X className="w-8 h-8 text-red-400" />
        </button>
        <button
          onClick={() => visibleCards[0] && handleViewJob(visibleCards[0].id)}
          className="w-14 h-14 rounded-full bg-white/10 border border-white/30 flex items-center justify-center transition-all active:scale-90 hover:bg-white/20 self-center"
        >
          <Eye className="w-6 h-6 text-white" />
        </button>
        <button
          onClick={() => visibleCards[0] && handleSwipe(visibleCards[0].id, 'right')}
          className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center transition-all active:scale-90 hover:bg-green-500/30"
        >
          <Heart className="w-8 h-8 text-green-400" />
        </button>
      </div>

      {/* Confetti Effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 rounded-full"
              style={{
                backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#ec4899'][i % 4],
                left: '50%',
                top: '40%',
              }}
              initial={{ scale: 0, x: 0, y: 0 }}
              animate={{
                scale: [0, 1, 0],
                x: (Math.random() - 0.5) * 300,
                y: (Math.random() - 0.5) * 300,
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 0.7,
                delay: i * 0.02,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SwipeCardProps {
  job: Job;
  index: number;
  isTop: boolean;
  totalCards: number;
  hasApplied: boolean;
  onSwipe: (id: string, direction: 'left' | 'right') => void;
  onViewJob: (id: string) => void;
}

function SwipeCard({ job, index, isTop, totalCards, hasApplied, onSwipe, onViewJob }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-20, 20]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  
  // Swipe indicators opacity
  const likeOpacity = useTransform(x, [0, 80], [0, 1]);
  const nopeOpacity = useTransform(x, [-80, 0], [1, 0]);

  const handleDragEnd = useCallback((_: never, info: PanInfo) => {
    const swipeThreshold = 100;
    if (info.offset.x > swipeThreshold) {
      onSwipe(job.id, 'right');
    } else if (info.offset.x < -swipeThreshold) {
      onSwipe(job.id, 'left');
    }
  }, [job.id, onSwipe]);

  return (
    <motion.div
      className="absolute inset-0 touch-none"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        opacity: isTop ? opacity : 1,
        zIndex: totalCards - index,
      }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95 - index * 0.03, y: index * 8 }}
      animate={{ 
        scale: isTop ? 1 : 0.95 - index * 0.03, 
        y: isTop ? 0 : index * 8,
      }}
      exit={{ 
        x: x.get() > 0 ? 300 : -300, 
        opacity: 0,
        transition: { duration: 0.2 }
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <div 
        className="w-full h-full bg-slate-800 rounded-3xl border border-white/20 overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing"
        onDoubleClick={() => onViewJob(job.id)}
      >
        {/* Job Image */}
        <div className="relative h-56 overflow-hidden bg-gradient-to-br from-parium-blue/30 to-slate-800">
          {job.job_image_url ? (
            <img 
              src={job.job_image_url.startsWith('http') ? job.job_image_url : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/job-images/${job.job_image_url}`}
              alt={job.title}
              className="w-full h-full object-cover"
              loading="eager"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 className="w-16 h-16 text-white/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-800 via-transparent to-transparent" />
          
          {/* Swipe Indicators */}
          <motion.div
            className="absolute top-6 right-6 px-4 py-2 bg-green-500 text-white font-bold text-xl rounded-lg rotate-12 border-2 border-white"
            style={{ opacity: likeOpacity }}
          >
            SPARA!
          </motion.div>
          <motion.div
            className="absolute top-6 left-6 px-4 py-2 bg-red-500 text-white font-bold text-xl rounded-lg -rotate-12 border-2 border-white"
            style={{ opacity: nopeOpacity }}
          >
            NÄSTA
          </motion.div>

          {/* Applied Badge */}
          {hasApplied && (
            <div className="absolute top-4 left-4">
              <Badge className="bg-green-500/90 text-white border-green-600">
                Redan sökt
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-xl font-bold text-white line-clamp-2 mb-1">
              {job.title}
            </h3>
            <div className="flex items-center gap-2 text-white/80">
              <Building2 className="w-4 h-4" />
              <span className="font-medium">{job.company_name}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-white/70 text-sm">
              <MapPin className="w-4 h-4" />
              <span>{job.location}</span>
            </div>
            {job.employment_type && (
              <Badge variant="glass" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {getEmploymentTypeLabel(job.employment_type)}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-white/60 pt-2 border-t border-white/10">
            <div className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              <span>{job.views_count || 0} visningar</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{job.applications_count || 0} sökande</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
