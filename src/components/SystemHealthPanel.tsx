import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database, Users, HardDrive, Mail, TrendingUp, X, ChevronDown, ChevronUp, Briefcase, RefreshCw, Video, FileUp, AlertTriangle, CheckCircle, Wifi, Calendar, HeadphonesIcon, FileSearch } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const ADMIN_EMAIL = 'pariumab@hotmail.com';

// Free tier limits (Supabase)
const LIMITS = {
  database: 500, // MB
  storage: 1000, // MB (1GB)
  emailsPerMonth: 3000,
  bandwidth: 5000, // MB per month
};

interface StorageStats {
  totalMB: number;
  byType: {
    videos: { count: number; mb: number };
    cvs: { count: number; mb: number };
    images: { count: number; mb: number };
    other: { count: number; mb: number };
  };
}

interface RealUsageStats {
  // Real storage data from edge function
  storage: StorageStats;
  
  // Database stats
  dbEstimatedMB: number;
  totalProfiles: number;
  totalJobs: number;
  totalApplications: number;
  totalMessages: number;
  
  // Activity indicators
  activeJobsCount: number;
  applicationsThisWeek: number;
  jobViewsThisMonth: number;
  
  // Additional tracking
  interviewsScheduled: number;
  openSupportTickets: number;
  cvAnalysisQueueSize: number;
  
  // Email estimates
  emailsThisMonth: number;
  
  // Bandwidth estimate (MB)
  bandwidthEstimateMB: number;
  
  // Meta
  isRealData: boolean;
  timestamp: string;
}

const HISTORY_KEY = 'parium_system_health_v3';

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
  const [error, setError] = useState<string | null>(null);
  const isAdmin = useIsSystemAdmin();

  const fetchStats = useCallback(async () => {
    if (!isAdmin) return;
    
    try {
      setError(null);
      
      // Get session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Ingen session');
        return;
      }

      // Fetch real storage stats from edge function
      const { data: storageData, error: funcError } = await supabase.functions.invoke('get-storage-stats', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      // Also fetch activity data directly
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const [activeJobsRes, applicationsWeekRes, totalJobViewsRes, interviewsRes, supportTicketsRes, cvQueueRes] = await Promise.all([
        supabase.from('job_postings').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('job_applications').select('id', { count: 'exact', head: true })
          .gte('created_at', oneWeekAgo.toISOString()),
        // Get total job views for bandwidth estimation
        supabase.from('job_postings').select('views_count'),
        // Interviews scheduled this week and upcoming
        supabase.from('interviews').select('id', { count: 'exact', head: true })
          .eq('status', 'scheduled')
          .gte('scheduled_at', new Date().toISOString()),
        // Open support tickets
        supabase.from('support_tickets').select('id', { count: 'exact', head: true })
          .in('status', ['open', 'pending']),
        // CV analysis queue size
        supabase.from('cv_analysis_queue').select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ]);

      const activeJobsCount = activeJobsRes.count || 0;
      const applicationsThisWeek = applicationsWeekRes.count || 0;
      const interviewsScheduled = interviewsRes.count || 0;
      const openSupportTickets = supportTicketsRes.count || 0;
      const cvAnalysisQueueSize = cvQueueRes.count || 0;
      // Sum all job views (estimate monthly views as total / months active, assume ~1 month for now)
      const totalJobViews = (totalJobViewsRes.data || []).reduce((sum, job) => sum + (job.views_count || 0), 0);
      const jobViewsThisMonth = Math.max(totalJobViews, applicationsThisWeek * 5); // At least 5 views per application

      let newStats: RealUsageStats;

      if (funcError || !storageData) {
        console.error('Edge function error:', funcError);
        // Fallback to estimates
        const [profilesWithVideoRes, profilesWithCvRes, profilesWithImageRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).not('video_url', 'is', null),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).not('cv_url', 'is', null),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).not('profile_image_url', 'is', null),
        ]);

        const videoCount = profilesWithVideoRes.count || 0;
        const cvCount = profilesWithCvRes.count || 0;
        const imageCount = profilesWithImageRes.count || 0;

        // Estimate bandwidth: videos are the killer
        // Each video view = ~15MB, CV download = ~0.5MB, image load = ~0.3MB
        const videoViewsBandwidth = videoCount * 3 * 15; // Assume 3 views per video
        const cvDownloadsBandwidth = cvCount * 2 * 0.5; // Assume 2 downloads per CV
        const imageLoadsBandwidth = imageCount * 10 * 0.3; // Assume 10 loads per image
        const apiBandwidth = applicationsThisWeek * 4 * 0.01; // API calls ~10KB each
        const bandwidthEstimateMB = videoViewsBandwidth + cvDownloadsBandwidth + imageLoadsBandwidth + apiBandwidth;

        newStats = {
          storage: {
            totalMB: (videoCount * 15) + (cvCount * 0.5) + (imageCount * 0.3),
            byType: {
              videos: { count: videoCount, mb: videoCount * 15 },
              cvs: { count: cvCount, mb: cvCount * 0.5 },
              images: { count: imageCount, mb: imageCount * 0.3 },
              other: { count: 0, mb: 0 },
            },
          },
          dbEstimatedMB: 5,
          totalProfiles: 0,
          totalJobs: 0,
          totalApplications: 0,
          totalMessages: 0,
          activeJobsCount,
          applicationsThisWeek,
          jobViewsThisMonth,
          interviewsScheduled,
          openSupportTickets,
          cvAnalysisQueueSize,
          emailsThisMonth: applicationsThisWeek * 8,
          bandwidthEstimateMB,
          isRealData: false,
          timestamp: new Date().toISOString(),
        };
      } else {
        // Use real data from edge function
        const videosMB = storageData.storage.byType.videos.mb || 0;
        const cvsMB = storageData.storage.byType.cvs.mb || 0;
        const imagesMB = storageData.storage.byType.images.mb || 0;
        const videosCount = storageData.storage.byType.videos.count || 0;
        const cvsCount = storageData.storage.byType.cvs.count || 0;
        const imagesCount = storageData.storage.byType.images.count || 0;

        // Bandwidth estimate based on real file sizes and activity
        // Videos: assume each video is viewed 3 times per month
        // CVs: assume each CV is downloaded 2 times per month
        // Images: assume each image is loaded 10 times per month
        // Job views generate API traffic (~10KB per view)
        const videoViewsBandwidth = videosCount * 3 * (videosMB / Math.max(videosCount, 1));
        const cvDownloadsBandwidth = cvsCount * 2 * (cvsMB / Math.max(cvsCount, 1));
        const imageLoadsBandwidth = imagesCount * 10 * (imagesMB / Math.max(imagesCount, 1));
        const apiTrafficMB = jobViewsThisMonth * 0.01; // ~10KB per job view
        const bandwidthEstimateMB = videoViewsBandwidth + cvDownloadsBandwidth + imageLoadsBandwidth + apiTrafficMB;

        newStats = {
          storage: {
            totalMB: storageData.storage.totalMB,
            byType: {
              videos: { 
                count: storageData.storage.byType.videos.count, 
                mb: storageData.storage.byType.videos.mb 
              },
              cvs: { 
                count: storageData.storage.byType.cvs.count, 
                mb: storageData.storage.byType.cvs.mb 
              },
              images: { 
                count: storageData.storage.byType.images.count, 
                mb: storageData.storage.byType.images.mb 
              },
              other: { 
                count: storageData.storage.byType.other.count, 
                mb: storageData.storage.byType.other.mb 
              },
            },
          },
          dbEstimatedMB: storageData.database.estimatedMB,
          totalProfiles: storageData.database.profiles,
          totalJobs: storageData.database.jobs,
          totalApplications: storageData.database.applications,
          totalMessages: storageData.database.messages,
          activeJobsCount,
          applicationsThisWeek,
          jobViewsThisMonth,
          interviewsScheduled,
          openSupportTickets,
          cvAnalysisQueueSize,
          emailsThisMonth: (storageData.database.profiles || 0) + (applicationsThisWeek * 4),
          bandwidthEstimateMB,
          isRealData: true,
          timestamp: new Date().toISOString(),
        };
      }

      setStats(newStats);
      setLastUpdated(new Date());
      storeHistory(newStats);
      setHistory(getStoredHistory());
    } catch (err) {
      console.error('Failed to fetch system stats:', err);
      setError('Kunde inte hämta data');
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

    // Live updates every 30 seconds as backup
    const interval = setInterval(fetchStats, 30000);
    
    // Subscribe to realtime changes for instant updates
    const channel = supabase
      .channel('system-health-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_postings' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interviews' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cv_analysis_queue' }, () => {
        fetchStats();
      })
      .subscribe();
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isAdmin, isVisible, fetchStats]);

  // Calculate which limit will be hit first
  const criticalPath = useMemo(() => {
    if (!stats) return null;
    
    const storagePercentage = (stats.storage.totalMB / LIMITS.storage) * 100;
    const dbPercentage = (stats.dbEstimatedMB / LIMITS.database) * 100;
    const emailPercentage = (stats.emailsThisMonth / LIMITS.emailsPerMonth) * 100;
    const bandwidthPercentage = (stats.bandwidthEstimateMB / LIMITS.bandwidth) * 100;
    
    const limits = [
      { name: 'Lagring', percentage: storagePercentage, current: stats.storage.totalMB, max: LIMITS.storage, unit: 'MB' },
      { name: 'Databas', percentage: dbPercentage, current: stats.dbEstimatedMB, max: LIMITS.database, unit: 'MB' },
      { name: 'Email', percentage: emailPercentage, current: stats.emailsThisMonth, max: LIMITS.emailsPerMonth, unit: '' },
      { name: 'Bandbredd', percentage: bandwidthPercentage, current: stats.bandwidthEstimateMB, max: LIMITS.bandwidth, unit: 'MB' },
    ];
    
    const sorted = limits.sort((a, b) => b.percentage - a.percentage);
    return sorted[0];
  }, [stats]);

  const chartData = useMemo(() => {
    return history.map(h => ({
      date: new Date(h.timestamp).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' }),
      storage: h.storage.totalMB,
      db: h.dbEstimatedMB,
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

  const storagePercentage = stats ? Math.min((stats.storage.totalMB / LIMITS.storage) * 100, 100) : 0;
  const dbPercentage = stats ? Math.min((stats.dbEstimatedMB / LIMITS.database) * 100, 100) : 0;
  const emailPercentage = stats ? Math.min((stats.emailsThisMonth / LIMITS.emailsPerMonth) * 100, 100) : 0;
  const bandwidthPercentage = stats ? Math.min((stats.bandwidthEstimateMB / LIMITS.bandwidth) * 100, 100) : 0;
  
  const overallHealth = Math.max(storagePercentage, dbPercentage, emailPercentage, bandwidthPercentage);
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
            <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-full text-white bg-white/10 md:bg-transparent md:hover:bg-white/20 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* Data source indicator */}
          <div className="flex items-center gap-2 mt-2">
            {stats?.isRealData ? (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Riktig data
              </span>
            ) : (
              <span className="text-xs text-yellow-400">
                ⚠️ Uppskattningar
              </span>
            )}
            {criticalPath && criticalPath.percentage > 30 && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400">
                  Flaskhals: <span className={getHealthColor(criticalPath.percentage)}>{criticalPath.name}</span>
                </span>
              </>
            )}
          </div>
          
          <p className="text-xs text-slate-500 mt-1">
            {lastUpdated ? `Uppdaterad ${lastUpdated.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}` : 'Laddar...'}
          </p>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* STORAGE - The main concern */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white uppercase tracking-wide flex items-center gap-1.5">
                <HardDrive className="h-3 w-3" />
                Lagring
              </p>
              <span className={`text-xs font-medium ${getHealthColor(storagePercentage)}`}>
                {stats?.storage.totalMB.toFixed(1) || 0} / {LIMITS.storage} MB
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
                <div className="flex items-center gap-1 text-white mb-1">
                  <Video className="h-3 w-3" />
                  Video
                </div>
                <p className="text-white font-medium">{stats?.storage.byType.videos.mb.toFixed(1) || 0} MB</p>
                <p className="text-white/60">{stats?.storage.byType.videos.count || 0} filer</p>
              </div>
              <div className="bg-slate-800 p-2 rounded">
                <div className="flex items-center gap-1 text-white mb-1">
                  <FileUp className="h-3 w-3" />
                  CV:er
                </div>
                <p className="text-white font-medium">{stats?.storage.byType.cvs.mb.toFixed(1) || 0} MB</p>
                <p className="text-white/60">{stats?.storage.byType.cvs.count || 0} filer</p>
              </div>
              <div className="bg-slate-800 p-2 rounded">
                <div className="flex items-center gap-1 text-white mb-1">
                  <Users className="h-3 w-3" />
                  Bilder
                </div>
                <p className="text-white font-medium">{stats?.storage.byType.images.mb.toFixed(1) || 0} MB</p>
                <p className="text-white/60">{stats?.storage.byType.images.count || 0} filer</p>
              </div>
            </div>
          </div>

          {/* DATABASE */}
          <div className="pt-3 border-t border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white uppercase tracking-wide flex items-center gap-1.5">
                <Database className="h-3 w-3" />
                Databas
              </p>
              <span className={`text-xs font-medium ${getHealthColor(dbPercentage)}`}>
                ~{stats?.dbEstimatedMB.toFixed(1) || 0} / {LIMITS.database} MB
              </span>
            </div>
            
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${getProgressColor(dbPercentage)}`}
                style={{ width: `${dbPercentage}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs text-white/80">
              <span>{stats?.totalApplications || 0} ansökningar</span>
              <span>{stats?.totalMessages || 0} meddelanden</span>
            </div>
          </div>

          {/* EMAIL */}
          <div className="pt-3 border-t border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white uppercase tracking-wide flex items-center gap-1.5">
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

          {/* BANDWIDTH */}
          <div className="pt-3 border-t border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white uppercase tracking-wide flex items-center gap-1.5">
                <Wifi className="h-3 w-3" />
                Bandbredd/månad
              </p>
              <span className={`text-xs font-medium ${getHealthColor(bandwidthPercentage)}`}>
                ~{stats?.bandwidthEstimateMB.toFixed(0) || 0} / {LIMITS.bandwidth} MB
              </span>
            </div>
            
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${getProgressColor(bandwidthPercentage)}`}
                style={{ width: `${bandwidthPercentage}%` }}
              />
            </div>
            
            <p className="text-xs text-white/60">
              Baserat på {stats?.jobViewsThisMonth || 0} jobbvisningar + filnedladdningar
            </p>
          </div>

          {/* ACTIVITY PULSE */}
          <div className="pt-3 border-t border-slate-700">
            <p className="text-xs text-white uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Briefcase className="h-3 w-3" />
              Aktivitet denna vecka
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800 p-2 rounded">
                <span className="text-white/80">Ansökningar</span>
                <p className="text-white font-semibold text-lg">{stats?.applicationsThisWeek || 0}</p>
              </div>
              <div className="bg-slate-800 p-2 rounded">
                <span className="text-white/80">Aktiva jobb</span>
                <p className="text-white font-semibold text-lg">{stats?.activeJobsCount || 0}</p>
              </div>
            </div>
          </div>

          {/* SYSTEM STATUS */}
          <div className="pt-3 border-t border-slate-700">
            <p className="text-xs text-white uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" />
              Systemstatus
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-800 p-2 rounded">
                <div className="flex items-center gap-1 text-white/80 mb-1">
                  <Calendar className="h-3 w-3" />
                  Intervjuer
                </div>
                <p className="text-white font-semibold">{stats?.interviewsScheduled || 0}</p>
                <p className="text-white/50 text-[10px]">planerade</p>
              </div>
              <div className="bg-slate-800 p-2 rounded">
                <div className="flex items-center gap-1 text-white/80 mb-1">
                  <HeadphonesIcon className="h-3 w-3" />
                  Support
                </div>
                <p className={`font-semibold ${(stats?.openSupportTickets || 0) > 0 ? 'text-orange-400' : 'text-white'}`}>
                  {stats?.openSupportTickets || 0}
                </p>
                <p className="text-white/50 text-[10px]">öppna</p>
              </div>
              <div className="bg-slate-800 p-2 rounded">
                <div className="flex items-center gap-1 text-white/80 mb-1">
                  <FileSearch className="h-3 w-3" />
                  CV-kö
                </div>
                <p className={`font-semibold ${(stats?.cvAnalysisQueueSize || 0) > 5 ? 'text-yellow-400' : 'text-white'}`}>
                  {stats?.cvAnalysisQueueSize || 0}
                </p>
                <p className="text-white/50 text-[10px]">väntar</p>
              </div>
            </div>
          </div>

          {/* Historical data toggle */}
          <div className="pt-3 border-t border-slate-700">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center justify-between w-full text-xs text-white/80 hover:text-white transition-colors"
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
                  <p className="text-xs text-white/50 text-center py-4">
                    Historisk data samlas in dagligen.
                  </p>
                )}
                
                {/* Capacity projections */}
                {stats && stats.storage.totalMB > 0 && (
                  <div className="bg-slate-800 p-3 rounded text-xs space-y-1">
                    <p className="text-white font-medium">📊 Kapacitet kvar</p>
                    <p className="text-white/80">
                      Lagring: {(LIMITS.storage - stats.storage.totalMB).toFixed(0)} MB ({((LIMITS.storage - stats.storage.totalMB) / LIMITS.storage * 100).toFixed(0)}%)
                    </p>
                    <p className="text-white/80">
                      Databas: {(LIMITS.database - stats.dbEstimatedMB).toFixed(0)} MB ({((LIMITS.database - stats.dbEstimatedMB) / LIMITS.database * 100).toFixed(0)}%)
                    </p>
                    <p className="text-white/80">
                      Bandbredd: {(LIMITS.bandwidth - (stats.bandwidthEstimateMB || 0)).toFixed(0)} MB ({((LIMITS.bandwidth - (stats.bandwidthEstimateMB || 0)) / LIMITS.bandwidth * 100).toFixed(0)}%)
                    </p>
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
                Lovable Pro: $25/mån → 8GB lagring, 8GB databas
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

export const SystemHealthPanel = () => null;
