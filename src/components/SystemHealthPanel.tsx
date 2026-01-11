import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Users, Building2, HardDrive, Mail, TrendingUp, X, ChevronDown, ChevronUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const ADMIN_EMAIL = 'parium.ab@hotmail.com';

// Free tier limits
const LIMITS = {
  database: 500, // MB
  storage: 1000, // MB (1GB)
  emailsPerMonth: 3000,
  organizations: 15,
  candidates: 2000,
};

// Pro tier limits (for projection)
const PRO_LIMITS = {
  database: 8000, // MB (8GB)
  storage: 100000, // MB (100GB)
  emailsPerMonth: 50000,
  organizations: 300,
  candidates: 150000,
};

interface SystemStats {
  totalCandidates: number;
  totalOrganizations: number;
  totalJobs: number;
  totalApplications: number;
  estimatedDbSize: number; // MB
  estimatedStorageSize: number; // MB
  emailsThisMonth: number;
  timestamp: string;
}

// Local storage key for historical data
const HISTORY_KEY = 'parium_system_health_history';

const getStoredHistory = (): SystemStats[] => {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const storeHistory = (stats: SystemStats) => {
  try {
    const history = getStoredHistory();
    const today = new Date().toISOString().split('T')[0];
    
    // Only store one entry per day
    const existingTodayIndex = history.findIndex(h => h.timestamp.startsWith(today));
    if (existingTodayIndex >= 0) {
      history[existingTodayIndex] = stats;
    } else {
      history.push(stats);
    }
    
    // Keep only last 30 days
    const trimmed = history.slice(-30);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage errors
  }
};

export const SystemHealthPanel = () => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [history, setHistory] = useState<SystemStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Check auth state
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserEmail(session?.user?.email || null);
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserEmail(session?.user?.email || null);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = userEmail?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    // Load historical data
    setHistory(getStoredHistory());

    const fetchStats = async () => {
      try {
        // Fetch counts from database
        const [employersRes, candidatesRes, jobsRes, applicationsRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'employer'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'job_seeker'),
          supabase.from('job_postings').select('id', { count: 'exact', head: true }),
          supabase.from('job_applications').select('id', { count: 'exact', head: true }),
        ]);

        const totalCandidates = candidatesRes.count || 0;
        const totalOrganizations = employersRes.count || 0;
        const totalJobs = jobsRes.count || 0;
        const totalApplications = applicationsRes.count || 0;

        // Estimate database size (rough calculation)
        const estimatedDbSize = (
          (totalCandidates + totalOrganizations) * 0.005 +
          totalJobs * 0.01 +
          totalApplications * 0.003
        );

        // Estimate storage (rough: assume 500KB avg per profile with media)
        const estimatedStorageSize = (totalCandidates + totalOrganizations) * 0.5;

        // Emails this month (rough estimate based on applications)
        const emailsThisMonth = Math.floor(totalApplications * 0.3);

        const newStats: SystemStats = {
          totalCandidates,
          totalOrganizations,
          totalJobs,
          totalApplications,
          estimatedDbSize,
          estimatedStorageSize,
          emailsThisMonth,
          timestamp: new Date().toISOString(),
        };

        setStats(newStats);
        storeHistory(newStats);
        setHistory(getStoredHistory());
      } catch (error) {
        console.error('Failed to fetch system stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isAdmin]);

  // Calculate growth rate and projection
  const projection = useMemo(() => {
    if (history.length < 2) return null;
    
    const oldest = history[0];
    const newest = history[history.length - 1];
    const daysDiff = Math.max(1, (new Date(newest.timestamp).getTime() - new Date(oldest.timestamp).getTime()) / (1000 * 60 * 60 * 24));
    
    const orgGrowthPerDay = (newest.totalOrganizations - oldest.totalOrganizations) / daysDiff;
    const candidateGrowthPerDay = (newest.totalCandidates - oldest.totalCandidates) / daysDiff;
    
    // Days until hitting free tier limits
    const daysUntilOrgLimit = orgGrowthPerDay > 0 
      ? Math.ceil((LIMITS.organizations - newest.totalOrganizations) / orgGrowthPerDay)
      : null;
    const daysUntilCandidateLimit = candidateGrowthPerDay > 0
      ? Math.ceil((LIMITS.candidates - newest.totalCandidates) / candidateGrowthPerDay)
      : null;
    
    return {
      orgGrowthPerDay: orgGrowthPerDay.toFixed(1),
      candidateGrowthPerDay: candidateGrowthPerDay.toFixed(1),
      daysUntilOrgLimit,
      daysUntilCandidateLimit,
    };
  }, [history]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return history.map(h => ({
      date: new Date(h.timestamp).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' }),
      orgs: h.totalOrganizations,
      candidates: h.totalCandidates,
      jobs: h.totalJobs,
    }));
  }, [history]);

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
      {/* Toggle button - fixed position */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 z-[9999] bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:bg-primary/90 transition-all"
        title="System Health"
        style={{ position: 'fixed' }}
      >
        {isVisible ? <X className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
      </button>

      {/* Panel */}
      {isVisible && (
        <div className="fixed bottom-20 right-4 z-[9999] w-96 max-h-[80vh] overflow-y-auto" style={{ position: 'fixed' }}>
          <Card className="shadow-2xl border-2 border-primary/20 bg-background/98 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4" />
                System Health (Admin Only)
              </CardTitle>
              <p className="text-xs text-muted-foreground">Free Tier Status • {userEmail}</p>
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

              {/* Historical data toggle */}
              <div className="pt-2 border-t">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Tillväxtprognos
                  </span>
                  {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                
                {showHistory && (
                  <div className="mt-3 space-y-3">
                    {/* Growth chart */}
                    {chartData.length > 1 ? (
                      <div className="h-32 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} width={30} />
                            <Tooltip 
                              contentStyle={{ fontSize: 11, padding: '4px 8px' }}
                              labelStyle={{ fontSize: 10 }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="candidates" 
                              stroke="hsl(var(--primary))" 
                              fill="hsl(var(--primary)/0.2)" 
                              name="Kandidater"
                            />
                            <Area 
                              type="monotone" 
                              dataKey="orgs" 
                              stroke="hsl(var(--secondary))" 
                              fill="hsl(var(--secondary)/0.2)" 
                              name="Orgs"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Historisk data samlas in dagligen. Kom tillbaka om några dagar för att se tillväxtkurvan.
                      </p>
                    )}
                    
                    {/* Projection */}
                    {projection && (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Orgs/dag:</span>
                          <span className="font-medium">+{projection.orgGrowthPerDay}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Kandidater/dag:</span>
                          <span className="font-medium">+{projection.candidateGrowthPerDay}</span>
                        </div>
                        {projection.daysUntilOrgLimit && projection.daysUntilOrgLimit < 365 && (
                          <div className="flex justify-between text-orange-500">
                            <span>Org-gräns nås om:</span>
                            <span className="font-medium">{projection.daysUntilOrgLimit} dagar</span>
                          </div>
                        )}
                        {projection.daysUntilCandidateLimit && projection.daysUntilCandidateLimit < 365 && (
                          <div className="flex justify-between text-orange-500">
                            <span>Kandidat-gräns nås om:</span>
                            <span className="font-medium">{projection.daysUntilCandidateLimit} dagar</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Upgrade hint */}
              {(orgsPercentage > 70 || candidatesPercentage > 70 || dbPercentage > 70) && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-orange-500">
                    ⚠️ Närmar er gränsen - överväg Supabase Pro ($25/mån) för 20x kapacitet
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
