import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database, Users, HardDrive, Mail, TrendingUp, X, ChevronDown, ChevronUp, Briefcase, FileText, RefreshCw, Video, FileUp, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const ADMIN_EMAIL = 'pariumab@hotmail.com';

// Free tier limits (Supabase)
const LIMITS = {
  database: 500, // MB
  storage: 1000, // MB (1GB)
  emailsPerMonth: 3000,
  bandwidth: 5000, // MB per month
};

// Average file sizes for estimation
const AVG_SIZES = {
  profileVideo: 15, // MB per video
  cv: 0.5, // MB per CV
  profileImage: 0.3, // MB per image
  companyLogo: 0.2, // MB per logo
  jobImage: 0.5, // MB per job image
};

interface RealUsageStats {
  // Actual counts of what takes up space
  profilesWithVideo: number;
  profilesWithCv: number;
  profilesWithImage: number;
  companiesWithLogo: number;
  jobsWithImage: number;
  
  // Calculated real storage
  estimatedVideoStorage: number;
  estimatedCvStorage: number;
  estimatedImageStorage: number;
  totalStorageUsed: number;
  
  // Database activity
  totalApplications: number;
  totalMessages: number;
  totalNotes: number;
  estimatedDbSize: number;
  
  // Email estimates (based on activity)
  emailsThisMonth: number;
  
  // Activity indicators
  activeJobsCount: number;
  applicationsThisWeek: number;
  
  timestamp: string;
}

const HISTORY_KEY = 'parium_system_health_v2';

const getStoredHistory = (): RealUsageStats[] => {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const storeHistory = (stats: RealUsageStats) => {
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
  const [stats, setStats] = useState<RealUsageStats | null>(null);
  const [history, setHistory] = useState<RealUsageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isAdmin = useIsSystemAdmin();

  const fetchStats = useCallback(async () => {
    if (!isAdmin) return;
    
    try {
      // Get real counts of what actually uses storage
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const [
        profilesWithVideoRes,
        profilesWithCvRes,
        profilesWithImageRes,
        companiesWithLogoRes,
        jobsWithImageRes,
        activeJobsRes,
        applicationsRes,
        applicationsWeekRes,
        messagesRes,
        notesRes,
      ] = await Promise.all([
        // Profiles with video uploaded
        supabase.from('profiles').select('id', { count: 'exact', head: true })
          .not('video_url', 'is', null),
        // Profiles with CV uploaded
        supabase.from('profiles').select('id', { count: 'exact', head: true })
          .not('cv_url', 'is', null),
        // Profiles with profile image
        supabase.from('profiles').select('id', { count: 'exact', head: true })
          .not('profile_image_url', 'is', null),
        // Companies with logo
        supabase.from('profiles').select('id', { count: 'exact', head: true })
          .eq('role', 'employer')
          .not('company_logo_url', 'is', null),
        // Jobs with images
        supabase.from('job_postings').select('id', { count: 'exact', head: true })
          .not('job_image_url', 'is', null),
        // Active jobs
        supabase.from('job_postings').select('id', { count: 'exact', head: true })
          .eq('is_active', true),
        // Total applications (database size indicator)
        supabase.from('job_applications').select('id', { count: 'exact', head: true }),
        // Applications this week (activity indicator)
        supabase.from('job_applications').select('id', { count: 'exact', head: true })
          .gte('created_at', oneWeekAgo.toISOString()),
        // Messages (database usage)
        supabase.from('messages').select('id', { count: 'exact', head: true }),
        // Notes (database usage)
        supabase.from('candidate_notes').select('id', { count: 'exact', head: true }),
      ]);

      const profilesWithVideo = profilesWithVideoRes.count || 0;
      const profilesWithCv = profilesWithCvRes.count || 0;
      const profilesWithImage = profilesWithImageRes.count || 0;
      const companiesWithLogo = companiesWithLogoRes.count || 0;
      const jobsWithImage = jobsWithImageRes.count || 0;
      const activeJobsCount = activeJobsRes.count || 0;
      const totalApplications = applicationsRes.count || 0;
      const applicationsThisWeek = applicationsWeekRes.count || 0;
      const totalMessages = messagesRes.count || 0;
      const totalNotes = notesRes.count || 0;

      // Calculate REAL storage estimates based on actual uploads
      const estimatedVideoStorage = profilesWithVideo * AVG_SIZES.profileVideo;
      const estimatedCvStorage = profilesWithCv * AVG_SIZES.cv;
      const estimatedImageStorage = 
        (profilesWithImage * AVG_SIZES.profileImage) +
        (companiesWithLogo * AVG_SIZES.companyLogo) +
        (jobsWithImage * AVG_SIZES.jobImage);
      
      const totalStorageUsed = estimatedVideoStorage + estimatedCvStorage + estimatedImageStorage;

      // Database size estimation based on actual data
      const estimatedDbSize = 
        (totalApplications * 0.02) + // Applications with answers
        (totalMessages * 0.002) + // Messages
        (totalNotes * 0.001) + // Notes
        5; // Base overhead

      // Email estimation: welcome emails + notifications
      const emailsThisMonth = 
        (applicationsThisWeek * 4 * 2) + // ~2 emails per application, extrapolated
        (activeJobsCount * 5); // Various job notifications

      const newStats: RealUsageStats = {
        profilesWithVideo,
        profilesWithCv,
        profilesWithImage,
        companiesWithLogo,
        jobsWithImage,
        estimatedVideoStorage,
        estimatedCvStorage,
        estimatedImageStorage,
        totalStorageUsed,
        totalApplications,
        totalMessages,
        totalNotes,
        estimatedDbSize,
        emailsThisMonth,
        activeJobsCount,
        applicationsThisWeek,
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

  // Calculate which limit will be hit first
  const criticalPath = useMemo(() => {
    if (!stats) return null;
    
    const storagePercentage = (stats.totalStorageUsed / LIMITS.storage) * 100;
    const dbPercentage = (stats.estimatedDbSize / LIMITS.database) * 100;
    const emailPercentage = (stats.emailsThisMonth / LIMITS.emailsPerMonth) * 100;
    
    const limits = [
      { name: 'Lagring', percentage: storagePercentage, current: stats.totalStorageUsed, max: LIMITS.storage, unit: 'MB' },
      { name: 'Databas', percentage: dbPercentage, current: stats.estimatedDbSize, max: LIMITS.database, unit: 'MB' },
      { name: 'Email', percentage: emailPercentage, current: stats.emailsThisMonth, max: LIMITS.emailsPerMonth, unit: '' },
    ];
    
    const sorted = limits.sort((a, b) => b.percentage - a.percentage);
    return sorted[0];
  }, [stats]);

  const chartData = useMemo(() => {
    return history.map(h => ({
      date: new Date(h.timestamp).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' }),
      storage: h.totalStorageUsed,
      db: h.estimatedDbSize,
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

  const storagePercentage = stats ? Math.min((stats.totalStorageUsed / LIMITS.storage) * 100, 100) : 0;
  const dbPercentage = stats ? Math.min((stats.estimatedDbSize / LIMITS.database) * 100, 100) : 0;
  const emailPercentage = stats ? Math.min((stats.emailsThisMonth / LIMITS.emailsPerMonth) * 100, 100) : 0;
  
  const overallHealth = Math.max(storagePercentage, dbPercentage, emailPercentage);
  const needsAttention = overallHealth > 70;
  const critical = overallHealth > 90;

  return (
    <div className="fixed top-16 right-4 z-[9999] w-96 max-h-[80vh] overflow-y-auto">
      <div className={`bg-slate-900 border ${critical ? 'border-red-500' : needsAttention ? 'border-orange-500' : 'border-slate-700'} rounded-xl shadow-2xl`}>
        {/* Header with overall status */}
        <div className={`p-4 border-b ${critical ? 'border-red-500/50 bg-red-500/10' : needsAttention ? 'border-orange-500/50 bg-orange-500/10' : 'border-slate-700'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {critical ? (
                <AlertTriangle className="h-4 w-4 text-red-400 animate-pulse" />
              ) : needsAttention ? (
                <AlertTriangle className="h-4 w-4 text-orange-400" />
              ) : (
                <Database className="h-4 w-4 text-emerald-400" />
              )}
              <span className="text-sm font-semibold text-white">
                {critical ? 'KRITISKT' : needsAttention ? 'Behöver uppmärksamhet' : 'System OK'}
              </span>
              {loading && <RefreshCw className="h-3 w-3 text-slate-400 animate-spin" />}
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* Critical path indicator */}
          {criticalPath && criticalPath.percentage > 30 && (
            <div className="mt-2 text-xs">
              <span className="text-slate-400">Flaskhals: </span>
              <span className={getHealthColor(criticalPath.percentage)}>
                {criticalPath.name} ({criticalPath.percentage.toFixed(0)}%)
              </span>
            </div>
          )}
          
          <p className="text-xs text-slate-400 mt-1">
            {lastUpdated ? `Uppdaterad ${lastUpdated.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}` : 'Laddar...'}
          </p>
        </div>

        <div className="p-4 space-y-4">
          {/* STORAGE - The main concern */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <HardDrive className="h-3 w-3" />
                Lagring (Kritisk)
              </p>
              <span className={`text-xs font-medium ${getHealthColor(storagePercentage)}`}>
                {stats?.totalStorageUsed.toFixed(0) || 0} / {LIMITS.storage} MB
              </span>
            </div>
            
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${getProgressColor(storagePercentage)}`}
                style={{ width: `${storagePercentage}%` }}
              />
            </div>
            
            {/* Storage breakdown */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-800 p-2 rounded">
                <div className="flex items-center gap-1 text-slate-400 mb-1">
                  <Video className="h-3 w-3" />
                  Video
                </div>
                <p className="text-white font-medium">{stats?.estimatedVideoStorage.toFixed(0) || 0} MB</p>
                <p className="text-slate-500">{stats?.profilesWithVideo || 0} st</p>
              </div>
              <div className="bg-slate-800 p-2 rounded">
                <div className="flex items-center gap-1 text-slate-400 mb-1">
                  <FileUp className="h-3 w-3" />
                  CV:er
                </div>
                <p className="text-white font-medium">{stats?.estimatedCvStorage.toFixed(1) || 0} MB</p>
                <p className="text-slate-500">{stats?.profilesWithCv || 0} st</p>
              </div>
              <div className="bg-slate-800 p-2 rounded">
                <div className="flex items-center gap-1 text-slate-400 mb-1">
                  <Users className="h-3 w-3" />
                  Bilder
                </div>
                <p className="text-white font-medium">{stats?.estimatedImageStorage.toFixed(1) || 0} MB</p>
                <p className="text-slate-500">{(stats?.profilesWithImage || 0) + (stats?.companiesWithLogo || 0)} st</p>
              </div>
            </div>
          </div>

          {/* DATABASE */}
          <div className="pt-3 border-t border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Database className="h-3 w-3" />
                Databas
              </p>
              <span className={`text-xs font-medium ${getHealthColor(dbPercentage)}`}>
                ~{stats?.estimatedDbSize.toFixed(1) || 0} / {LIMITS.database} MB
              </span>
            </div>
            
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${getProgressColor(dbPercentage)}`}
                style={{ width: `${dbPercentage}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs text-slate-400">
              <span>{stats?.totalApplications || 0} ansökningar</span>
              <span>{stats?.totalMessages || 0} meddelanden</span>
            </div>
          </div>

          {/* EMAIL */}
          <div className="pt-3 border-t border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                Email/månad
              </p>
              <span className={`text-xs font-medium ${getHealthColor(emailPercentage)}`}>
                ~{stats?.emailsThisMonth || 0} / {LIMITS.emailsPerMonth}
              </span>
            </div>
            
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${getProgressColor(emailPercentage)}`}
                style={{ width: `${emailPercentage}%` }}
              />
            </div>
          </div>

          {/* ACTIVITY PULSE */}
          <div className="pt-3 border-t border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Briefcase className="h-3 w-3" />
              Aktivitet denna vecka
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800 p-2 rounded">
                <span className="text-slate-400">Ansökningar</span>
                <p className="text-white font-semibold text-lg">{stats?.applicationsThisWeek || 0}</p>
              </div>
              <div className="bg-slate-800 p-2 rounded">
                <span className="text-slate-400">Aktiva jobb</span>
                <p className="text-white font-semibold text-lg">{stats?.activeJobsCount || 0}</p>
              </div>
            </div>
          </div>

          {/* Historical data toggle */}
          <div className="pt-3 border-t border-slate-700">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3" />
                Tillväxt & Prognos
              </span>
              {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            
            {showDetails && (
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
                          width={35}
                          axisLine={{ stroke: '#475569' }}
                          tickLine={{ stroke: '#475569' }}
                          unit=" MB"
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
                          formatter={(value: number) => [`${value.toFixed(1)} MB`]}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="storage" 
                          stroke="#f59e0b" 
                          fill="#f59e0b33" 
                          name="Lagring"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="db" 
                          stroke="#3b82f6" 
                          fill="#3b82f633" 
                          name="Databas"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">
                    Historisk data samlas in dagligen.
                  </p>
                )}
                
                {/* Smart projections */}
                {stats && stats.totalStorageUsed > 10 && (
                  <div className="bg-slate-800 p-3 rounded text-xs space-y-1">
                    <p className="text-white font-medium">📊 Prognos</p>
                    {stats.profilesWithVideo > 0 && (
                      <p className="text-slate-300">
                        Video-lagring: ~{Math.floor((LIMITS.storage - stats.totalStorageUsed) / AVG_SIZES.profileVideo)} fler videos innan gräns
                      </p>
                    )}
                    {stats.profilesWithCv > 0 && (
                      <p className="text-slate-300">
                        CV-kapacitet: ~{Math.floor((LIMITS.storage - stats.totalStorageUsed) / AVG_SIZES.cv)} fler CVs
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Upgrade warning */}
          {critical && (
            <div className="pt-3 border-t border-red-500/50 bg-red-500/5 -mx-4 px-4 pb-4 -mb-4 rounded-b-xl">
              <p className="text-sm text-red-400 font-medium">
                ⚠️ Kritisk nivå - uppgradera nu!
              </p>
              <p className="text-xs text-red-300/70 mt-1">
                Supabase Pro: $25/mån → 8GB lagring, 8GB databas
              </p>
            </div>
          )}
          
          {needsAttention && !critical && (
            <div className="pt-3 border-t border-orange-500/50">
              <p className="text-xs text-orange-400">
                ⚠️ Närmar sig gräns - planera uppgradering
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
