import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Users, Eye, TrendingUp } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    totalViews: 0,
    totalApplications: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;
    
    try {
      const { data: jobs, error } = await supabase
        .from('job_postings')
        .select('is_active, views_count, applications_count')
        .eq('employer_id', user.id);

      if (error) throw error;

      if (jobs) {
        const totalJobs = jobs.length;
        const activeJobs = jobs.filter(job => job.is_active).length;
        const totalViews = jobs.reduce((sum, job) => sum + (job.views_count || 0), 0);
        const totalApplications = jobs.reduce((sum, job) => sum + (job.applications_count || 0), 0);

        setStats({
          totalJobs,
          activeJobs,
          totalViews,
          totalApplications,
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <Button 
          onClick={() => navigate('/my-jobs')}
          className="bg-primary hover:bg-primary/90"
        >
          Hantera annonser
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">
              Totalt annonser
            </CardTitle>
            <Briefcase className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {loading ? '...' : stats.totalJobs}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">
              Aktiva annonser
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {loading ? '...' : stats.activeJobs}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">
              Totala visningar
            </CardTitle>
            <Eye className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {loading ? '...' : stats.totalViews}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">
              Ansökningar
            </CardTitle>
            <Users className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {loading ? '...' : stats.totalApplications}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-white">Snabbåtgärder</CardTitle>
          <CardDescription className="text-white/70">
            Hantera dina annonser och kandidater
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button 
            onClick={() => navigate('/my-jobs')}
            variant="outline"
            className="w-full justify-start border-white/20 text-white hover:bg-white/20"
          >
            <Briefcase className="mr-2 h-4 w-4" />
            Visa alla annonser
          </Button>
          <Button 
            onClick={() => navigate('/candidates')}
            variant="outline"
            className="w-full justify-start border-white/20 text-white hover:bg-white/20"
          >
            <Users className="mr-2 h-4 w-4" />
            Visa kandidater
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
