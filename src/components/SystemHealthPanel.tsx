import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Database, Users, Building2, HardDrive, Mail, TrendingUp } from 'lucide-react';

const ADMIN_EMAIL = 'parium.ab@hotmail.com';

// Free tier limits
const LIMITS = {
  database: 500, // MB
  storage: 1000, // MB (1GB)
  emailsPerMonth: 3000,
  organizations: 15,
  candidates: 2000,
};

interface SystemStats {
  totalCandidates: number;
  totalOrganizations: number;
  totalJobs: number;
  totalApplications: number;
  estimatedDbSize: number; // MB
  estimatedStorageSize: number; // MB
  emailsThisMonth: number;
}

export const SystemHealthPanel = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  // Only show for admin email
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        // Fetch counts from database
        const [
          profilesRes,
          jobsRes,
          applicationsRes,
        ] = await Promise.all([
          supabase.from('profiles').select('role', { count: 'exact', head: true }),
          supabase.from('job_postings').select('id', { count: 'exact', head: true }),
          supabase.from('job_applications').select('id', { count: 'exact', head: true }),
        ]);

        // Count employers (organizations) and job seekers (candidates)
        const [employersRes, candidatesRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'employer'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'job_seeker'),
        ]);

        const totalCandidates = candidatesRes.count || 0;
        const totalOrganizations = employersRes.count || 0;
        const totalJobs = jobsRes.count || 0;
        const totalApplications = applicationsRes.count || 0;

        // Estimate database size (rough calculation)
        // ~5KB per profile, ~10KB per job, ~3KB per application
        const estimatedDbSize = (
          (totalCandidates + totalOrganizations) * 0.005 +
          totalJobs * 0.01 +
          totalApplications * 0.003
        );

        // Estimate storage (rough: assume 500KB avg per profile with media)
        const estimatedStorageSize = (totalCandidates + totalOrganizations) * 0.5;

        // Emails this month (we don't have this tracked, so estimate)
        const emailsThisMonth = Math.floor(totalApplications * 0.3); // Rough estimate

        setStats({
          totalCandidates,
          totalOrganizations,
          totalJobs,
          totalApplications,
          estimatedDbSize,
          estimatedStorageSize,
          emailsThisMonth,
        });
      } catch (error) {
        console.error('Failed to fetch system stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isAdmin]);

  if (!isAdmin || loading) return null;

  const getHealthColor = (percentage: number) => {
    if (percentage < 50) return 'text-green-500';
    if (percentage < 75) return 'text-yellow-500';
    if (percentage < 90) return 'text-orange-500';
    return 'text-red-500';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 75) return 'bg-yellow-500';
    if (percentage < 90) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const dbPercentage = stats ? Math.min((stats.estimatedDbSize / LIMITS.database) * 100, 100) : 0;
  const storagePercentage = stats ? Math.min((stats.estimatedStorageSize / LIMITS.storage) * 100, 100) : 0;
  const orgsPercentage = stats ? Math.min((stats.totalOrganizations / LIMITS.organizations) * 100, 100) : 0;
  const candidatesPercentage = stats ? Math.min((stats.totalCandidates / LIMITS.candidates) * 100, 100) : 0;
  const emailPercentage = stats ? Math.min((stats.emailsThisMonth / LIMITS.emailsPerMonth) * 100, 100) : 0;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 z-50 bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:bg-primary/90 transition-all"
        title="System Health"
      >
        <TrendingUp className="h-5 w-5" />
      </button>

      {/* Panel */}
      {isVisible && (
        <div className="fixed bottom-20 right-4 z-50 w-80 max-h-[70vh] overflow-y-auto">
          <Card className="shadow-2xl border-2 border-primary/20 bg-background/95 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4" />
                System Health (Admin)
              </CardTitle>
              <p className="text-xs text-muted-foreground">Free Tier Status</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Organizations */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Organisationer
                  </span>
                  <span className={getHealthColor(orgsPercentage)}>
                    {stats?.totalOrganizations || 0} / {LIMITS.organizations}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${getProgressColor(orgsPercentage)}`}
                    style={{ width: `${orgsPercentage}%` }}
                  />
                </div>
              </div>

              {/* Candidates */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Kandidater
                  </span>
                  <span className={getHealthColor(candidatesPercentage)}>
                    {stats?.totalCandidates || 0} / {LIMITS.candidates}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${getProgressColor(candidatesPercentage)}`}
                    style={{ width: `${candidatesPercentage}%` }}
                  />
                </div>
              </div>

              {/* Database */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    Databas
                  </span>
                  <span className={getHealthColor(dbPercentage)}>
                    ~{stats?.estimatedDbSize.toFixed(1) || 0} / {LIMITS.database} MB
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${getProgressColor(dbPercentage)}`}
                    style={{ width: `${dbPercentage}%` }}
                  />
                </div>
              </div>

              {/* Storage */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <HardDrive className="h-3 w-3" />
                    Lagring
                  </span>
                  <span className={getHealthColor(storagePercentage)}>
                    ~{stats?.estimatedStorageSize.toFixed(0) || 0} / {LIMITS.storage} MB
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${getProgressColor(storagePercentage)}`}
                    style={{ width: `${storagePercentage}%` }}
                  />
                </div>
              </div>

              {/* Emails */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Emails/mån
                  </span>
                  <span className={getHealthColor(emailPercentage)}>
                    ~{stats?.emailsThisMonth || 0} / {LIMITS.emailsPerMonth}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${getProgressColor(emailPercentage)}`}
                    style={{ width: `${emailPercentage}%` }}
                  />
                </div>
              </div>

              {/* Quick stats */}
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Snabbstatistik</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/50 p-2 rounded">
                    <span className="text-muted-foreground">Jobb</span>
                    <p className="font-semibold">{stats?.totalJobs || 0}</p>
                  </div>
                  <div className="bg-muted/50 p-2 rounded">
                    <span className="text-muted-foreground">Ansökningar</span>
                    <p className="font-semibold">{stats?.totalApplications || 0}</p>
                  </div>
                </div>
              </div>

              {/* Upgrade hint */}
              {(orgsPercentage > 70 || candidatesPercentage > 70 || dbPercentage > 70) && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-orange-500">
                    ⚠️ Närmar er gränsen - överväg Supabase Pro ($25/mån)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};
