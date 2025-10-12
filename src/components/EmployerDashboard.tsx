import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Briefcase, TrendingUp, Users } from 'lucide-react';
import CreateJobSimpleDialog from '@/components/CreateJobSimpleDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

interface JobStats {
  totalJobs: number;
  activeJobs: number;
  totalViews: number;
}

const EmployerDashboard = () => {
  const [stats, setStats] = useState<JobStats>({ totalJobs: 0, activeJobs: 0, totalViews: 0 });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchStats = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('job_postings')
        .select('is_active, views_count')
        .eq('employer_id', user.id);

      if (error) {
        toast({
          title: "Fel vid hämtning av statistik",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      const jobs = data || [];
      setStats({
        totalJobs: jobs.length,
        activeJobs: jobs.filter(j => j.is_active).length,
        totalViews: jobs.reduce((sum, j) => sum + j.views_count, 0)
      });
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte hämta statistik.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);


  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 pb-safe min-h-screen smooth-scroll touch-pan no-overscroll" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-white/90 mt-1 text-sm sm:text-base">
          Översikt av din verksamhet
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/15 transition-colors cursor-pointer" onClick={() => navigate('/jobs')}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-white">Totalt annonser</CardDescription>
              <Briefcase className="h-5 w-5 text-white/60" />
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16 bg-white/20" />
            ) : (
              <CardTitle className="text-3xl text-white">{stats.totalJobs}</CardTitle>
            )}
          </CardHeader>
        </Card>
        
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/15 transition-colors cursor-pointer" onClick={() => navigate('/jobs')}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-white">Aktiva annonser</CardDescription>
              <TrendingUp className="h-5 w-5 text-white/60" />
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16 bg-white/20" />
            ) : (
              <CardTitle className="text-3xl text-white">{stats.activeJobs}</CardTitle>
            )}
          </CardHeader>
        </Card>
        
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-white">Totala visningar</CardDescription>
              <Users className="h-5 w-5 text-white/60" />
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16 bg-white/20" />
            ) : (
              <CardTitle className="text-3xl text-white">{stats.totalViews}</CardTitle>
            )}
          </CardHeader>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-white">Snabbåtgärder</CardTitle>
          <CardDescription className="text-white/70">
            Kom igång snabbt med vanliga uppgifter
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <CreateJobSimpleDialog onJobCreated={fetchStats} />
            <Button 
              variant="outline" 
              onClick={() => navigate('/jobs')}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-150"
            >
              <Briefcase className="mr-2 h-4 w-4" />
              Visa alla annonser
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/candidates')}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-150"
            >
              <Users className="mr-2 h-4 w-4" />
              Se kandidater
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployerDashboard;