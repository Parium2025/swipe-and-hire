import { memo, useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useJobsData } from '@/hooks/useJobsData';
import { useWeather } from '@/hooks/useWeather';
import { useGreeting } from '@/hooks/useGreeting';
import { useMinuteTick } from '@/hooks/useMinuteTick';

import { hasConfirmedWeather } from '@/lib/weatherApi';
import { formatSwedishDateTime } from '@/lib/swedishTime';
import { motion } from 'framer-motion';
import WeatherEffects from '@/components/WeatherEffects';
import { HomeDashboardGrid } from '@/components/HomeDashboardGrid';
import GpsPrompt from '@/components/GpsPrompt';
import { useIsSystemAdmin } from '@/components/SystemHealthPanel';
import { supabase } from '@/integrations/supabase/client';
import { EmployerHomeSkeleton } from '@/components/employer/EmployerPageSkeleton';



const DateTimeDisplay = memo(() => {
  // Delad minuttick: synkad mot hel minut, pausar när fliken är dold och
  // uppdaterar direkt när man kommer tillbaka (ingen 10s-timer i bakgrunden).
  const tick = useMinuteTick();
  const dateTime = useMemo(() => formatSwedishDateTime(), [tick]);

  return (
    <p className="text-sm text-white font-medium mt-1">
      {dateTime.date} · {dateTime.time}
    </p>
  );
});


DateTimeDisplay.displayName = 'DateTimeDisplay';

// Module-level flag: skeleton-overlay endast vid kall mount (browser refresh / direkt URL),
// hoppa över vid sidebar-navigering — speglar seeker SearchJobs.
let __employerHomeHasMountedOnce = false;

const EmployerHome = memo(() => {
  const { profile } = useAuth();
  const { isLoading } = useJobsData({ scope: 'personal' });
  const isSystemAdmin = useIsSystemAdmin();
  
  // Mirror job seeker pattern: instant render when data is cached, fade-in only on cold load
  const [showContent, setShowContent] = useState(() => !isLoading);
  const dataWasCached = useRef(!isLoading);
  const [systemHealth, setSystemHealth] = useState<{
    storagePercent: number;
    dbPercent: number;
    bandwidthPercent: number;
    worstMetric: string;
    worstPercent: number;
  } | null>(null);
  
  useEffect(() => {
    if (!isLoading && !showContent) {
      if (dataWasCached.current) {
        setShowContent(true);
      } else {
        const timer = setTimeout(() => setShowContent(true), 100);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, showContent]);

  const [initialLoadDone, setInitialLoadDone] = useState(__employerHomeHasMountedOnce);
  useEffect(() => {
    if (!isLoading && !initialLoadDone) {
      const t = setTimeout(() => {
        setInitialLoadDone(true);
        __employerHomeHasMountedOnce = true;
      }, 150);
      return () => clearTimeout(t);
    }
  }, [isLoading, initialLoadDone]);


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
  
  const { text: greetingText, isEvening, isDaytime } = useGreeting();
  
  // Fetch weather independently of GPS permission. If GPS is denied, useWeather
  // still falls back to IP/server/profile city; blocking the hook here makes the
  // whole weather row disappear for users who previously denied location.
  const backgroundLocationEnabled = Boolean(
    (profile as { background_location_enabled?: boolean | null } | null | undefined)?.background_location_enabled
  );

  const weather = useWeather({
    fallbackCity: profile?.location || profile?.home_location || profile?.address || 'Stockholm',
    enabled: true,
    backgroundLocationEnabled,
  });

  const showWeatherEffects = !weather.isLoading && !weather.error;
  
  // Emoji logic based on time of day and weather
  const displayEmoji = useMemo(() => {
    // If weather is blocked/unavailable, use simple time-based icons
    if (weather.error) {
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
  }, [weather.weatherCode, weather.error, isEvening, isDaytime]);

  if (!initialLoadDone) {
    return <EmployerHomeSkeleton />;
  }
  if (isLoading || !showContent) {
    return (
      <div className="space-y-6 responsive-container-wide py-8 opacity-0 [padding-bottom:calc(env(safe-area-inset-bottom,0px)+50px)]">
        {/* Invisible placeholder */}
      </div>
    );
  }

  return (
    <>
      <GpsPrompt weatherAvailable={hasConfirmedWeather(weather)} />
      {/* Visa vädereffekter endast efter kort mount-delay (ger cache-rensning tid) */}
      {showWeatherEffects && <WeatherEffects weatherCode={weather.weatherCode} isLoading={weather.isLoading} isEvening={isEvening} />}
      <div className="space-y-3 sm:space-y-6 responsive-container-wide py-2 sm:py-3 animate-fade-in relative z-10 [padding-bottom:calc(env(safe-area-inset-bottom,0px)+50px)]">
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
          {!weather.isLoading && !weather.error && weather.description ? (
            <motion.p 
              className="text-white text-base"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {hasConfirmedWeather(weather) ? (
                <>
                  {weather.city}, {weather.temperature}°
                  {weather.feelsLike !== weather.temperature && (
                    <span className="text-white"> (känns som {weather.feelsLike}°)</span>
                  )}
                  {' '}
                </>
              ) : null}
              {weather.description} <span className="text-xl">{displayEmoji}</span>
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
