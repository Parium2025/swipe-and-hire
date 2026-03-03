import { memo, useMemo, useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWeather } from '@/hooks/useWeather';
import { motion } from 'framer-motion';
import WeatherEffects from '@/components/WeatherEffects';
import { JobSeekerDashboardGrid } from '@/components/JobSeekerDashboardGrid';
import GpsPrompt from '@/components/GpsPrompt';

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
  const capitalizedDate = date.charAt(0).toUpperCase() + date.slice(1);
  return { time, date: capitalizedDate };
};

const DateTimeDisplay = memo(() => {
  const [dateTime, setDateTime] = useState(() => formatDateTime());
  
  useEffect(() => {
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

const JobSeekerHome = memo(() => {
  const { profile } = useAuth();

  const firstName = profile?.first_name || 'du';
  
  // Reactive greeting
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
  
  // Check GPS permission
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
  
  // Fetch weather if GPS granted
  const weather = useWeather({
    fallbackCity: gpsGranted ? (profile?.location || profile?.home_location || profile?.address || 'Stockholm') : undefined,
    enabled: gpsGranted === true,
    backgroundLocationEnabled: (profile as any)?.background_location_enabled ?? false,
  });
  // 🎯 KRITISKT: Förhindra att gammal cachad vädereffekt visas vid login
  const [mountedLongEnough, setMountedLongEnough] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setMountedLongEnough(true), 200);
    return () => clearTimeout(timer);
  }, []);
  
  const showWeatherEffects = gpsGranted && mountedLongEnough && !weather.isLoading;
  
  // Emoji logic
  const displayEmoji = useMemo(() => {
    if (!gpsGranted) {
      return isDaytime ? '☀️' : '🌙';
    }
    
    const getEmojiForCode = (code: number) => {
      if (code === 0) return '☀️';
      if (code === 1) return '🌤️';
      if (code === 2) return '⛅';
      if (code === 3) return '☁️';
      if (code === 45 || code === 48) return '☁️';
      if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
      if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
      if ([95, 96, 99].includes(code)) return '⛈️';
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


  return (
    <>
      <GpsPrompt />
      {showWeatherEffects && <WeatherEffects weatherCode={weather.weatherCode} isLoading={weather.isLoading} isEvening={isEvening} />}
      <div className="space-y-3 sm:space-y-6 responsive-container-wide py-2 sm:py-3 animate-fade-in relative z-10">
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

        {/* Dashboard Grid */}
        <JobSeekerDashboardGrid />

      </div>
    </>
  );
});

JobSeekerHome.displayName = 'JobSeekerHome';

export default JobSeekerHome;
