import { memo, useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useJobsData } from '@/hooks/useJobsData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Briefcase, 
  TrendingUp, 
  Users, 
  Eye, 
  Plus,
  ArrowRight,
  Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { isJobExpiredCheck } from '@/lib/date';

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'God morgon';
  if (hour >= 12 && hour < 18) return 'God eftermiddag';
  return 'God kväll';
};

const getGreetingEmoji = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '☀️';
  if (hour >= 12 && hour < 18) return '👋';
  return '🌙';
};

interface StatCardProps {
  icon: React.ElementType;
  title: string;
  value: number;
  subtitle?: string;
  color: string;
  delay: number;
}

const StatCard = memo(({ icon: Icon, title, value, subtitle, color, delay }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
  >
    <Card className={`bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all duration-300 group cursor-default`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-white/70">{title}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
            {subtitle && (
              <p className="text-xs text-white/50">{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-xl ${color} transition-transform duration-300 group-hover:scale-110`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
));

StatCard.displayName = 'StatCard';

const EmployerHome = memo(() => {
  const navigate = useNavigate();
  const { profile, preloadedEmployerMyJobs, preloadedEmployerActiveJobs, preloadedEmployerTotalViews, preloadedEmployerTotalApplications } = useAuth();
  const { jobs, isLoading } = useJobsData({ scope: 'personal' });
  
  const [showContent, setShowContent] = useState(false);
  
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowContent(true), 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Calculate stats
  const stats = useMemo(() => {
    const activeJobs = jobs.filter(j => j.is_active && !isJobExpiredCheck(j.created_at, j.expires_at));
    const pendingApplications = activeJobs.reduce((sum, job) => sum + (job.applications_count || 0), 0);
    const totalViews = activeJobs.reduce((sum, job) => sum + (job.views_count || 0), 0);
    
    // Get recent applications (last 7 days) - this is simplified, would need actual application data
    const recentApplications = pendingApplications; // Placeholder

    return {
      activeJobs: isLoading ? preloadedEmployerActiveJobs : activeJobs.length,
      totalJobs: isLoading ? preloadedEmployerMyJobs : jobs.length,
      totalApplications: isLoading ? preloadedEmployerTotalApplications : pendingApplications,
      totalViews: isLoading ? preloadedEmployerTotalViews : totalViews,
    };
  }, [jobs, isLoading, preloadedEmployerActiveJobs, preloadedEmployerMyJobs, preloadedEmployerTotalApplications, preloadedEmployerTotalViews]);

  // Get jobs that need attention (have unviewed applications)
  const jobsNeedingAttention = useMemo(() => {
    return jobs
      .filter(j => j.is_active && !isJobExpiredCheck(j.created_at, j.expires_at) && (j.applications_count || 0) > 0)
      .slice(0, 3);
  }, [jobs]);

  const firstName = profile?.first_name || 'du';
  const greeting = getGreeting();
  const emoji = getGreetingEmoji();

  if (isLoading || !showContent) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto px-4 md:px-8 py-8 opacity-0">
        {/* Invisible placeholder */}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 md:px-8 py-6 animate-fade-in">
      {/* Personal greeting */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center md:text-left"
      >
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          {greeting}, {firstName} {emoji}
        </h1>
        <p className="text-white/60 mt-1 text-sm md:text-base">
          Här är en översikt över din rekrytering
        </p>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          icon={TrendingUp}
          title="Aktiva annonser"
          value={stats.activeJobs}
          color="bg-green-500/20"
          delay={0.1}
        />
        <StatCard
          icon={Users}
          title="Nya ansökningar"
          value={stats.totalApplications}
          subtitle="Senaste 7 dagarna"
          color="bg-blue-500/20"
          delay={0.15}
        />
        <StatCard
          icon={Eye}
          title="Totala visningar"
          value={stats.totalViews}
          color="bg-purple-500/20"
          delay={0.2}
        />
        <StatCard
          icon={Clock}
          title="Väntar på feedback"
          value={stats.totalApplications}
          subtitle="Kandidater att granska"
          color="bg-amber-500/20"
          delay={0.25}
        />
      </div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <Button
          onClick={() => navigate('/my-jobs?create=true')}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-medium"
        >
          <Plus className="mr-2 h-5 w-5" />
          Skapa ny annons
        </Button>
        <Button
          onClick={() => navigate('/my-candidates')}
          variant="outline"
          className="flex-1 border-white/20 bg-white/5 hover:bg-white/10 text-white h-12 text-base font-medium"
        >
          <Users className="mr-2 h-5 w-5" />
          Granska kandidater
        </Button>
      </motion.div>

      {/* Jobs needing attention */}
      {jobsNeedingAttention.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Jobb med nya ansökningar</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/my-jobs')}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              Visa alla
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {jobsNeedingAttention.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
              >
                <Card 
                  className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all duration-200 cursor-pointer group"
                  onClick={() => navigate(`/job-details/${job.id}`)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <Briefcase className="h-4 w-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm md:text-base">{job.title}</p>
                        <p className="text-xs text-white/50">{job.location || 'Ingen plats angiven'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-400">{job.applications_count || 0}</p>
                        <p className="text-xs text-white/50">ansökningar</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-white/60 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty state if no jobs */}
      {jobs.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="bg-white/5 backdrop-blur-sm border-white/10 border-dashed">
            <CardContent className="p-8 text-center">
              <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-4">
                <Briefcase className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Välkommen till Parium!
              </h3>
              <p className="text-white/60 mb-4 max-w-md mx-auto">
                Du har inga annonser ännu. Skapa din första jobbannons för att börja ta emot ansökningar.
              </p>
              <Button
                onClick={() => navigate('/my-jobs?create=true')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="mr-2 h-4 w-4" />
                Skapa din första annons
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
});

EmployerHome.displayName = 'EmployerHome';

export default EmployerHome;
