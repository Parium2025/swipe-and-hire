import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database, Users, Building2, HardDrive, Mail, TrendingUp, X, ChevronDown, ChevronUp, Briefcase, FileText, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const ADMIN_EMAIL = 'pariumab@hotmail.com';

// Free tier limits
const LIMITS = {
  database: 500, // MB
  storage: 1000, // MB (1GB)
  emailsPerMonth: 3000,
  candidates: 2000,
  applications: 5000,
};

interface SystemStats {
  totalCandidates: number;
  totalOrganizations: number;
  totalJobs: number;
  totalActiveJobs: number;
  totalApplications: number;
  estimatedDbSize: number;
  estimatedStorageSize: number;
  emailsThisMonth: number;
  timestamp: string;
}

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
    const existingTodayIndex = history.findIndex(h => h.timestamp.startsWith(today));
    if (existingTodayIndex >= 0) {
      history[existingTodayIndex] = stats;
    } else {
      history.push(stats);
    }
    const trimmed = history.slice(-30);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage errors
  }
};

// Hook for checking admin status
export const useIsSystemAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAdmin(session?.user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAdmin(session?.user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  return isAdmin;
};

// Button component for embedding in nav
export const SystemHealthButton = ({ onClick }: { onClick: () => void }) => {
  const isAdmin = useIsSystemAdmin();
  
  if (!isAdmin) return null;
  
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white"
      title="System Health"
    >
      <TrendingUp className="h-5 w-5" />
    </button>
  );
};

// Full panel component  
export const SystemHealthPanelContent = ({ isVisible, onClose }: { isVisible: boolean; onClose: () => void }) => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [history, setHistory] = useState<SystemStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isAdmin = useIsSystemAdmin();

  const fetchStats = useCallback(async () => {
    if (!isAdmin) return;
    
    try {
      const [employersRes, candidatesRes, jobsRes, activeJobsRes, applicationsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'employer'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'job_seeker'),
        supabase.from('job_postings').select('id', { count: 'exact', head: true }),
        supabase.from('job_postings').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('job_applications').select('id', { count: 'exact', head: true }),
      ]);

      const totalCandidates = candidatesRes.count || 0;
      const totalOrganizations = employersRes.count || 0;
      const totalJobs = jobsRes.count || 0;
      const totalActiveJobs = activeJobsRes.count || 0;
      const totalApplications = applicationsRes.count || 0;

      // More accurate DB size estimation based on actual data
      const estimatedDbSize = (
        (totalCandidates * 0.01) + // profiles with CV data
        (totalOrganizations * 0.005) +
        (totalJobs * 0.02) + // job descriptions
        (totalApplications * 0.015) // applications with answers
      );

      // Storage: mainly CVs and profile images
      const estimatedStorageSize = (totalCandidates * 0.8) + (totalOrganizations * 0.2);
      
      // Emails: welcome emails + application notifications
      const emailsThisMonth = Math.floor(totalApplications * 0.5) + totalCandidates + totalOrganizations;

      const newStats: SystemStats = {
        totalCandidates,
        totalOrganizations,
        totalJobs,
        totalActiveJobs,
        totalApplications,
        estimatedDbSize,
        estimatedStorageSize,
        emailsThisMonth,
        timestamp: new Date().toISOString(),
      };

      setStats(newStats);
      setLastUpdated(new Date());
      storeHistory(newStats);
      setHistory(getStoredHistory());
    } catch (error) {
      console.error('Failed to fetch system stats:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !isVisible) {
      setLoading(false);
      return;
    }

    setHistory(getStoredHistory());
    fetchStats();

    // Live updates every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    
    return () => clearInterval(interval);
  }, [isAdmin, isVisible, fetchStats]);

  const projection = useMemo(() => {
    if (history.length < 2) return null;
    
    const oldest = history[0];
    const newest = history[history.length - 1];
    const daysDiff = Math.max(1, (new Date(newest.timestamp).getTime() - new Date(oldest.timestamp).getTime()) / (1000 * 60 * 60 * 24));
    
    const appGrowthPerDay = (newest.totalApplications - oldest.totalApplications) / daysDiff;
    const candidateGrowthPerDay = (newest.totalCandidates - oldest.totalCandidates) / daysDiff;
    
    const daysUntilAppLimit = appGrowthPerDay > 0 
      ? Math.ceil((LIMITS.applications - newest.totalApplications) / appGrowthPerDay)
      : null;
    const daysUntilCandidateLimit = candidateGrowthPerDay > 0
      ? Math.ceil((LIMITS.candidates - newest.totalCandidates) / candidateGrowthPerDay)
      : null;
    
    return {
      appGrowthPerDay: appGrowthPerDay.toFixed(1),
      candidateGrowthPerDay: candidateGrowthPerDay.toFixed(1),
      daysUntilAppLimit,
      daysUntilCandidateLimit,
    };
  }, [history]);

  const chartData = useMemo(() => {
    return history.map(h => ({
      date: new Date(h.timestamp).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' }),
      applications: h.totalApplications,
      candidates: h.totalCandidates,
      jobs: h.totalJobs,
    }));
  }, [history]);

  if (!isVisible || !isAdmin) return null;

  const getHealthColor = (percentage: number) => {
    if (percentage < 50) return 'text-emerald-400';
    if (percentage < 75) return 'text-yellow-400';
    if (percentage < 90) return 'text-orange-400';
    return 'text-red-400';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage < 50) return 'bg-emerald-500';
    if (percentage < 75) return 'bg-yellow-500';
    if (percentage < 90) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const dbPercentage = stats ? Math.min((stats.estimatedDbSize / LIMITS.database) * 100, 100) : 0;
  const storagePercentage = stats ? Math.min((stats.estimatedStorageSize / LIMITS.storage) * 100, 100) : 0;
  const candidatesPercentage = stats ? Math.min((stats.totalCandidates / LIMITS.candidates) * 100, 100) : 0;
  const applicationsPercentage = stats ? Math.min((stats.totalApplications / LIMITS.applications) * 100, 100) : 0;
  const emailPercentage = stats ? Math.min((stats.emailsThisMonth / LIMITS.emailsPerMonth) * 100, 100) : 0;

  return (
    <div className="fixed top-16 right-4 z-[9999] w-96 max-h-[80vh] overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-white" />
              <span className="text-sm font-semibold text-white">System Health</span>
              {loading && <RefreshCw className="h-3 w-3 text-slate-400 animate-spin" />}
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Free Tier • {lastUpdated ? `Uppdaterad ${lastUpdated.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}` : 'Laddar...'}
          </p>
        </div>

        <div className="p-4 space-y-4">
          {/* Key Activity Metrics - What actually matters */}
          <div className="space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Faktisk Aktivitet</p>
            
            {/* Applications - Most important */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5 text-white">
                  <FileText className="h-3 w-3" />
                  Ansökningar
                </span>
                <span className={getHealthColor(applicationsPercentage)}>
                  {stats?.totalApplications || 0} / {LIMITS.applications}
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${getProgressColor(applicationsPercentage)}`}
                  style={{ width: `${applicationsPercentage}%` }}
                />
              </div>
            </div>

            {/* Active Jobs */}
            <div className="space-y-1 mt-3">
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5 text-white">
                  <Briefcase className="h-3 w-3" />
                  Aktiva jobb
                </span>
                <span className="text-emerald-400">
                  {stats?.totalActiveJobs || 0} av {stats?.totalJobs || 0}
                </span>
              </div>
            </div>
          </div>

          {/* User Metrics */}
          <div className="pt-3 border-t border-slate-700 space-y-3">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Användare</p>
            
            {/* Candidates */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5 text-white">
                  <Users className="h-3 w-3" />
                  Kandidater
                </span>
                <span className={getHealthColor(candidatesPercentage)}>
                  {stats?.totalCandidates || 0} / {LIMITS.candidates}
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${getProgressColor(candidatesPercentage)}`}
                  style={{ width: `${candidatesPercentage}%` }}
                />
              </div>
            </div>

            {/* Organizations - just info, not a limit */}
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1.5 text-white">
                <Building2 className="h-3 w-3" />
                Organisationer
              </span>
              <span className="text-slate-300">{stats?.totalOrganizations || 0}</span>
            </div>
          </div>

          {/* Infrastructure */}
          <div className="pt-3 border-t border-slate-700 space-y-3">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Infrastruktur</p>
            
            {/* Database */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5 text-white">
                  <Database className="h-3 w-3" />
                  Databas
                </span>
                <span className={getHealthColor(dbPercentage)}>
                  ~{stats?.estimatedDbSize.toFixed(1) || 0} / {LIMITS.database} MB
                </span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${getProgressColor(dbPercentage)}`}
                  style={{ width: `${dbPercentage}%` }}
                />
              </div>
            </div>

            {/* Storage */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5 text-white">
                  <HardDrive className="h-3 w-3" />
                  Lagring
                </span>
                <span className={getHealthColor(storagePercentage)}>
                  ~{stats?.estimatedStorageSize.toFixed(0) || 0} / {LIMITS.storage} MB
                </span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${getProgressColor(storagePercentage)}`}
                  style={{ width: `${storagePercentage}%` }}
                />
              </div>
            </div>

            {/* Emails */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5 text-white">
                  <Mail className="h-3 w-3" />
                  Emails/mån
                </span>
                <span className={getHealthColor(emailPercentage)}>
                  ~{stats?.emailsThisMonth || 0} / {LIMITS.emailsPerMonth}
                </span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${getProgressColor(emailPercentage)}`}
                  style={{ width: `${emailPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Historical data toggle */}
          <div className="pt-3 border-t border-slate-700">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3" />
                Tillväxtprognos
              </span>
              {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            
            {showHistory && (
              <div className="mt-3 space-y-3">
                {chartData.length > 1 ? (
                  <div className="h-32 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10, fill: '#94a3b8' }} 
                          axisLine={{ stroke: '#475569' }}
                          tickLine={{ stroke: '#475569' }}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: '#94a3b8' }} 
                          width={30}
                          axisLine={{ stroke: '#475569' }}
                          tickLine={{ stroke: '#475569' }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            fontSize: 11, 
                            padding: '8px 12px',
                            backgroundColor: '#1e293b',
                            border: '1px solid #475569',
                            borderRadius: '6px',
                            color: '#fff'
                          }}
                          labelStyle={{ fontSize: 10, color: '#94a3b8' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="applications" 
                          stroke="#10b981" 
                          fill="#10b98133" 
                          name="Ansökningar"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="candidates" 
                          stroke="#3b82f6" 
                          fill="#3b82f633" 
                          name="Kandidater"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">
                    Historisk data samlas in dagligen. Kom tillbaka om några dagar.
                  </p>
                )}
                
                {projection && (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ansökningar/dag:</span>
                      <span className="font-medium text-white">+{projection.appGrowthPerDay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Kandidater/dag:</span>
                      <span className="font-medium text-white">+{projection.candidateGrowthPerDay}</span>
                    </div>
                    {projection.daysUntilAppLimit && projection.daysUntilAppLimit < 365 && (
                      <div className="flex justify-between text-orange-400">
                        <span>Ansökningsgräns nås om:</span>
                        <span className="font-medium">{projection.daysUntilAppLimit} dagar</span>
                      </div>
                    )}
                    {projection.daysUntilCandidateLimit && projection.daysUntilCandidateLimit < 365 && (
                      <div className="flex justify-between text-orange-400">
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
          {(applicationsPercentage > 70 || candidatesPercentage > 70 || dbPercentage > 70) && (
            <div className="pt-3 border-t border-slate-700">
              <p className="text-xs text-orange-400">
                ⚠️ Närmar er gränsen - överväg uppgradering ($25/mån)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Legacy export for App.tsx (does nothing now)
export const SystemHealthPanel = () => null;
