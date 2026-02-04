import { memo, useMemo, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useJobsData } from '@/hooks/useJobsData';
import { useWeather } from '@/hooks/useWeather';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Briefcase, 
  Users, 
  Plus,
  Database,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { isJobExpiredCheck } from '@/lib/date';
import WeatherEffects from '@/components/WeatherEffects';
import { HomeDashboardGrid } from '@/components/HomeDashboardGrid';
import GpsPrompt from '@/components/GpsPrompt';
import { useIsSystemAdmin } from '@/components/SystemHealthPanel';
import { supabase } from '@/integrations/supabase/client';

const getGreeting = (): { text: string; isEvening: boolean; isDaytime: boolean } => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 9) return { text: 'God morgon', isEvening: false, isDaytime: true };
  if (hour >= 9 && hour < 12) return { text: 'God förmiddag', isEvening: false, isDaytime: true };
  if (hour >= 12 && hour < 17) return { text: 'God eftermiddag', isEvening: false, isDaytime: true };
  if (hour >= 17 && hour < 21) return { text: 'God kväll', isEvening: true, isDaytime: false };
  return { text: 'God natt', isEvening: true, isDaytime: false };
};

const formatDateTime = (): { time: string; date: string } => {
  const now = new Date();
  const time = now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('sv-SE', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });
  // Capitalize first letter
  const capitalizedDate = date.charAt(0).toUpperCase() + date.slice(1);
  return { time, date: capitalizedDate };
};


const DateTimeDisplay = memo(() => {
  const [dateTime, setDateTime] = useState(() => formatDateTime());
  
  useEffect(() => {
    // Update every 10 seconds for responsive time display
    const interval = setInterval(() => {
      setDateTime(formatDateTime());
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <p className="text-sm text-white font-medium mt-1">
      {dateTime.date} · {dateTime.time}
    </p>
  );
});

DateTimeDisplay.displayName = 'DateTimeDisplay';

const EmployerHome = memo(() => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { jobs, isLoading } = useJobsData({ scope: 'personal' });
  const isSystemAdmin = useIsSystemAdmin();
  
  const [showContent, setShowContent] = useState(false);
  const [systemHealth, setSystemHealth] = useState<{
    storagePercent: number;
    dbPercent: number;
    bandwidthPercent: number;
    worstMetric: string;
    worstPercent: number;
  } | null>(null);
  
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowContent(true), 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Fetch system health for admin
  const fetchSystemHealth = useCallback(async () => {
    if (!isSystemAdmin) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase.functions.invoke('get-storage-stats', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (data) {
        const LIMITS = { storage: 1000, database: 500, bandwidth: 5000 };
        const storagePercent = (data.storage.totalMB / LIMITS.storage) * 100;
        const dbPercent = (data.database.estimatedMB / LIMITS.database) * 100;
        
        // Estimate bandwidth
        const videosMB = data.storage.byType.videos.mb || 0;
        const videosCount = data.storage.byType.videos.count || 1;
        const bandwidthEstimate = videosCount * 3 * (videosMB / videosCount);
        const bandwidthPercent = (bandwidthEstimate / LIMITS.bandwidth) * 100;

        const metrics = [
          { name: 'Lagring', percent: storagePercent },
          { name: 'Databas', percent: dbPercent },
          { name: 'Bandbredd', percent: bandwidthPercent },
        ];
        const worst = metrics.sort((a, b) => b.percent - a.percent)[0];

        setSystemHealth({
          storagePercent,
          dbPercent,
          bandwidthPercent,
          worstMetric: worst.name,
          worstPercent: worst.percent,
        });
      }
    } catch (err) {
      console.error('Failed to fetch system health:', err);
    }
  }, [isSystemAdmin]);

  useEffect(() => {
    fetchSystemHealth();
  }, [fetchSystemHealth]);

  // Calculate basic stats for context
  const stats = useMemo(() => {
    const activeJobs = jobs.filter(j => j.is_active && !isJobExpiredCheck(j.created_at, j.expires_at));
    const pendingApplications = activeJobs.reduce((sum, job) => sum + (job.applications_count || 0), 0);
    return { activeJobs: activeJobs.length, pendingApplications };
  }, [jobs]);

  const firstName = profile?.first_name || 'du';
  
  // Reactive greeting that updates automatically
  const [greeting, setGreeting] = useState(() => getGreeting());
  
  useEffect(() => {
    // Calculate ms until next minute (sync with clock)
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    
    // First sync to the exact minute change
    const syncTimeout = setTimeout(() => {
      setGreeting(getGreeting());
      
      // Then update every 60 seconds exactly on the minute
      const interval = setInterval(() => {
        setGreeting(getGreeting());
      }, 60000);
      
      // Store interval for cleanup
      (window as any).__greetingInterval = interval;
    }, msUntilNextMinute);
    
    return () => {
      clearTimeout(syncTimeout);
      if ((window as any).__greetingInterval) {
        clearInterval((window as any).__greetingInterval);
      }
    };
  }, []);
  
  const { text: greetingText, isEvening, isDaytime } = greeting;
  
  // Check GPS permission status
  const [gpsGranted, setGpsGranted] = useState<boolean | null>(null);
  
  useEffect(() => {
    const checkGps = async () => {
      try {
        if ('permissions' in navigator) {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          setGpsGranted(result.state === 'granted');
          
          // Listen for changes
          result.addEventListener('change', () => {
            setGpsGranted(result.state === 'granted');
          });
        } else {
          setGpsGranted(false);
        }
      } catch {
        setGpsGranted(false);
      }
    };
    checkGps();
  }, []);
  
  // Only fetch weather if GPS is granted
  const weather = useWeather({
    fallbackCity: gpsGranted ? (profile?.location || profile?.home_location || profile?.address || 'Stockholm') : undefined,
    enabled: gpsGranted === true,
    backgroundLocationEnabled: (profile as any)?.background_location_enabled ?? false,
  });
  
  // 🎯 KRITISKT: Förhindra att gammal cachad vädereffekt visas vid login
  // useWeather kan returnera cachad data med isLoading=false DIREKT vid mount.
  // Vi väntar tills komponenten har varit monterad en kort stund OCH väderdata
  // inte längre laddar - detta ger clearAllAppCaches() tid att köra först.
  const [mountedLongEnough, setMountedLongEnough] = useState(false);
  
  useEffect(() => {
    // Vänta 200ms efter mount innan vi tillåter vädereffekter
    // Detta ger cache-rensningen i signIn tid att exekvera
    const timer = setTimeout(() => setMountedLongEnough(true), 200);
    return () => clearTimeout(timer);
  }, []);
  
  const showWeatherEffects = gpsGranted && mountedLongEnough && !weather.isLoading;
  
  // Emoji logic based on time of day and weather
  const displayEmoji = useMemo(() => {
    // If GPS not granted, use simple time-based icons
    if (!gpsGranted) {
      return isDaytime ? '☀️' : '🌙';
    }
    
    const getEmojiForCode = (code: number) => {
      if (code === 0) return '☀️'; // Clear
      if (code === 1) return '🌤️'; // Mostly clear
      if (code === 2) return '⛅'; // Partly cloudy
      if (code === 3) return '☁️'; // Overcast
      if (code === 45 || code === 48) return '☁️'; // Fog
      if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️'; // Rain
      if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️'; // Snow
      if ([95, 96, 99].includes(code)) return '⛈️'; // Thunderstorm
      return '☀️';
    };
    
    const weatherCode = weather.weatherCode;
    
    if (!isEvening) {
      return getEmojiForCode(weatherCode);
    }
    
    if (weatherCode === 0 || weatherCode === 1) {
      return '🌙';
    }
    if (weatherCode === 2) {
      return '🌙 ☁️';
    }
    return getEmojiForCode(weatherCode);
  }, [weather.weatherCode, isEvening, gpsGranted, isDaytime]);

  if (isLoading || !showContent) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto px-4 md:px-8 py-8 opacity-0">
        {/* Invisible placeholder */}
      </div>
    );
  }

  return (
    <>
      <GpsPrompt />
      {/* Visa vädereffekter endast efter kort mount-delay (ger cache-rensning tid) */}
      {showWeatherEffects && <WeatherEffects weatherCode={weather.weatherCode} isLoading={weather.isLoading} isEvening={isEvening} />}
      <div className="space-y-6 max-w-6xl mx-auto px-3 md:px-12 py-3 animate-fade-in relative z-10">
        {/* System Health badge removed - use nav bar icon instead */}

        {/* Personal greeting */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center md:text-left flex flex-col gap-2"
        >
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
              {greetingText}, {firstName} 👋
            </h1>
          </div>
          <DateTimeDisplay />
          {gpsGranted && !weather.isLoading && !weather.error && weather.description ? (
            <motion.p 
              className="text-white text-base"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {weather.city ? `${weather.city}, ` : ''}{weather.temperature}°
              {weather.feelsLike !== weather.temperature && (
                <span className="text-white"> (känns som {weather.feelsLike}°)</span>
              )}
              {' '}{weather.description} <span className="text-xl">{displayEmoji}</span>
            </motion.p>
          ) : null}
        </motion.div>

        {/* Quick summary */}

        {/* Dashboard Grid - News, Stats, and more */}
        <HomeDashboardGrid />


        {/* Empty state if no jobs */}
        {jobs.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            <Card className="bg-gradient-to-br from-white/[0.08] to-white/[0.04] backdrop-blur-sm border-white/10 border-dashed">
              <CardContent className="p-10 text-center">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 w-fit mx-auto mb-5">
                  <Briefcase className="h-10 w-10 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  Kom igång med rekryteringen!
                </h3>
                <p className="text-white/60 mb-6 max-w-md mx-auto">
                  Du har inga annonser ännu. Skapa din första jobbannons för att börja ta emot ansökningar från kvalificerade kandidater.
                </p>
                <Button
                  onClick={() => navigate('/my-jobs?create=true')}
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg shadow-primary/25"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Skapa din första annons
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </>
  );
});

EmployerHome.displayName = 'EmployerHome';

export default EmployerHome;
