import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Newspaper,
  Sparkles,
  ExternalLink,
  BarChart3,
  Users,
  Briefcase,
  Eye,
  UserPlus,
  Lightbulb,
  Target
} from 'lucide-react';
import { useHrNews, HrNewsItem } from '@/hooks/useHrNews';
import { useJobsData } from '@/hooks/useJobsData';
import { isJobExpiredCheck } from '@/lib/date';

// Gradients for each quadrant
const GRADIENTS = {
  news: 'from-emerald-500/90 via-emerald-600/80 to-teal-700/90',
  stats: 'from-blue-500/90 via-blue-600/80 to-indigo-700/90',
  placeholder1: 'from-violet-500/90 via-purple-600/80 to-purple-700/90',
  placeholder2: 'from-amber-500/90 via-orange-500/80 to-orange-600/90',
};

// News Card (Green - Top Left)
const NewsCard = memo(() => {
  const { data: news, isLoading } = useHrNews();

  if (isLoading) {
    return (
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.news} border-0 shadow-lg h-full`}>
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
        <CardContent className="relative p-5 h-full">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-8 w-8 rounded-lg bg-white/20" />
            <Skeleton className="h-4 w-32 bg-white/20" />
          </div>
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full bg-white/10" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.news} border-0 shadow-lg h-full`}>
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      
      <CardContent className="relative p-5 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-white/10">
              <Newspaper className="h-5 w-5 text-white" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-semibold text-white">Nyheter</h3>
          </div>
          <span className="text-[10px] text-white/50 uppercase tracking-wider">00:00 CET</span>
        </div>
        
        {/* News list */}
        <div className="flex-1 space-y-2 overflow-hidden">
          {news && news.slice(0, 4).map((item, index) => (
            <NewsListItem key={item.id} news={item} index={index} />
          ))}
          {(!news || news.length === 0) && (
            <p className="text-sm text-white/60 text-center py-4">Inga nyheter just nu</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

NewsCard.displayName = 'NewsCard';

const NewsListItem = memo(({ news, index }: { news: HrNewsItem; index: number }) => {
  const handleClick = () => {
    if (news.source_url) {
      window.open(news.source_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 + index * 0.05 }}
      onClick={handleClick}
      className={`p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors ${news.source_url ? 'cursor-pointer group' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white line-clamp-1">{news.title}</p>
          <p className="text-xs text-white/50 mt-0.5">{news.source}</p>
        </div>
        {news.source_url && (
          <ExternalLink className="h-3.5 w-3.5 text-white/30 group-hover:text-white/70 flex-shrink-0 mt-0.5 transition-colors" />
        )}
      </div>
    </motion.div>
  );
});

NewsListItem.displayName = 'NewsListItem';

// Stats Card (Blue - Top Right)
const StatsCard = memo(() => {
  const { jobs, isLoading } = useJobsData({ scope: 'personal' });

  const stats = useMemo(() => {
    if (!jobs) return { activeJobs: 0, newApplications: 0, totalViews: 0, candidates: 0 };
    
    const activeJobs = jobs.filter(j => j.is_active && !isJobExpiredCheck(j.created_at, j.expires_at));
    const newApplications = activeJobs.reduce((sum, job) => sum + (job.applications_count || 0), 0);
    const totalViews = activeJobs.reduce((sum, job) => sum + (job.views_count || 0), 0);
    
    return { 
      activeJobs: activeJobs.length, 
      newApplications,
      totalViews,
      candidates: newApplications // Placeholder - could be separate query
    };
  }, [jobs]);

  if (isLoading) {
    return (
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.stats} border-0 shadow-lg h-full`}>
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
        <CardContent className="relative p-5 h-full">
          <Skeleton className="h-8 w-32 bg-white/20 mb-4" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 bg-white/10 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.stats} border-0 shadow-lg h-full`}>
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      
      <CardContent className="relative p-5 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-white/10">
            <BarChart3 className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-semibold text-white">Statistik</h3>
        </div>
        
        {/* Stats grid */}
        <div className="flex-1 grid grid-cols-2 gap-3">
          <StatItem icon={Briefcase} label="Aktiva annonser" value={stats.activeJobs} />
          <StatItem icon={UserPlus} label="Nya ansökningar" value={stats.newApplications} />
          <StatItem icon={Eye} label="Visningar" value={stats.totalViews} />
          <StatItem icon={Users} label="Kandidater" value={stats.candidates} />
        </div>
      </CardContent>
    </Card>
  );
});

StatsCard.displayName = 'StatsCard';

const StatItem = memo(({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) => (
  <div className="p-3 rounded-lg bg-white/5 flex flex-col justify-center">
    <div className="flex items-center gap-2 mb-1">
      <Icon className="h-4 w-4 text-white/60" strokeWidth={1.5} />
      <span className="text-xs text-white/60">{label}</span>
    </div>
    <span className="text-2xl font-bold text-white">{value}</span>
  </div>
));

StatItem.displayName = 'StatItem';

// Placeholder Cards (Purple & Orange - Bottom)
const PlaceholderCard = memo(({ 
  gradient, 
  icon: Icon, 
  title, 
  description 
}: { 
  gradient: string; 
  icon: React.ElementType; 
  title: string; 
  description: string;
}) => (
  <Card className={`relative overflow-hidden bg-gradient-to-br ${gradient} border-0 shadow-lg h-full`}>
    <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
    
    <CardContent className="relative p-5 h-full flex flex-col items-center justify-center text-center">
      <div className="p-3 rounded-xl bg-white/10 mb-3">
        <Icon className="h-6 w-6 text-white" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-white/60">{description}</p>
    </CardContent>
  </Card>
));

PlaceholderCard.displayName = 'PlaceholderCard';

// Main Dashboard Grid
export const HomeDashboardGrid = memo(() => {
  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-2"
      >
        <Sparkles className="h-5 w-5 text-secondary" />
        <h2 className="text-lg font-semibold text-white">Din översikt</h2>
      </motion.div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
        {/* Top Left - News (Green) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <NewsCard />
        </motion.div>
        
        {/* Top Right - Stats (Blue) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <StatsCard />
        </motion.div>
        
        {/* Bottom Left - Placeholder (Purple) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <PlaceholderCard 
            gradient={GRADIENTS.placeholder1}
            icon={Lightbulb}
            title="Kommer snart"
            description="Fler funktioner på väg"
          />
        </motion.div>
        
        {/* Bottom Right - Placeholder (Orange) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <PlaceholderCard 
            gradient={GRADIENTS.placeholder2}
            icon={Target}
            title="Kommer snart"
            description="Fler funktioner på väg"
          />
        </motion.div>
      </div>
    </div>
  );
});

HomeDashboardGrid.displayName = 'HomeDashboardGrid';
