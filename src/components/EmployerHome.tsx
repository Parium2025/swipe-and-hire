import { memo, useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useJobsData } from '@/hooks/useJobsData';
import { useWeather } from '@/hooks/useWeather';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Briefcase, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
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

  const firstName = profile?.first_name || 'du';
  
  // Reactive greeting that updates automatically
  const [greeting, setGreeting] = useState(() => getGreeting());
  const greetingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  useEffect(() => {
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    
    const syncTimeout = setTimeout(() => {
      setGreeting(getGreeting());
      
      greetingIntervalRef.current = setInterval(() => {
        setGreeting(getGreeting());
      }, 60000);
    }, msUntilNextMinute);
    
    return () => {
      clearTimeout(syncTimeout);
      if (greetingIntervalRef.current) {
        clearInterval(greetingIntervalRef.current);
      }
    };
  }, []);
  
  const { text: greetingText, isEvening, isDaytime } = greeting;
  
  // Check GPS permission status
  const [gpsGranted, setGpsGranted] = useState<boolean | null>(null);
  
  useEffect(() => {
    let permissionStatus: PermissionStatus | null = null;
    const onChange = () => {
      if (permissionStatus) setGpsGranted(permissionStatus.state === 'granted');
    };
    const checkGps = async () => {
      try {
        if ('permissions' in navigator) {
          permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          setGpsGranted(permissionStatus.state === 'granted');
          permissionStatus.addEventListener('change', onChange);
        } else {
          setGpsGranted(false);
        }
      } catch {
        setGpsGranted(false);
      }
    };
    checkGps();
    return () => {
      permissionStatus?.removeEventListener('change', onChange);
    };
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
      <div className="space-y-6 responsive-container-wide py-8 opacity-0">
        {/* Invisible placeholder */}
      </div>
    );
  }

  return (
    <>
      <GpsPrompt />
      {/* Visa vädereffekter endast efter kort mount-delay (ger cache-rensning tid) */}
      {showWeatherEffects && <WeatherEffects weatherCode={weather.weatherCode} isLoading={weather.isLoading} isEvening={isEvening} />}
      <div className="space-y-3 sm:space-y-6 responsive-container-wide py-2 sm:py-3 animate-fade-in relative z-10">
        {/* System Health badge removed - use nav bar icon instead */}

        {/* Personal greeting */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center md:text-left flex flex-col gap-1 sm:gap-2"
        >
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight">
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



        {/* Dashboard Grid - News, Stats, and more */}
        <HomeDashboardGrid />


      </div>
    </>
  );
});

EmployerHome.displayName = 'EmployerHome';

export default EmployerHome;
