import { memo, useMemo, useEffect, useState } from 'react';
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
  ArrowRight,
  BarChart3,
  FileText,
  Building2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { isJobExpiredCheck } from '@/lib/date';
import WeatherEffects from '@/components/WeatherEffects';

const getGreeting = (): { text: string; isEvening: boolean } => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: 'God morgon', isEvening: false };
  if (hour >= 12 && hour < 18) return { text: 'God eftermiddag', isEvening: false };
  return { text: 'God kväll', isEvening: true };
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

interface QuickActionProps {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
  gradient: string;
  delay: number;
}

const QuickAction = memo(({ icon: Icon, title, description, onClick, gradient, delay }: QuickActionProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    className="group"
  >
    <Card 
      className={`relative overflow-hidden bg-gradient-to-br ${gradient} border-0 shadow-lg transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-xl cursor-pointer h-full`}
      onClick={onClick}
    >
      {/* Glass overlay */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
      
      {/* Decorative elements */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
      
      <CardContent className="relative p-5 flex flex-col h-full">
        <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm w-fit mb-4 transition-all duration-300 group-hover:bg-white/20 group-hover:scale-110">
          <Icon className="h-6 w-6 text-white" strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-white/70 flex-1">{description}</p>
        <div className="flex items-center gap-1 mt-3 text-white/60 group-hover:text-white transition-colors">
          <span className="text-sm font-medium">Gå dit</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </CardContent>
    </Card>
  </motion.div>
));

QuickAction.displayName = 'QuickAction';

const DateTimeDisplay = memo(() => {
  const [dateTime, setDateTime] = useState(() => formatDateTime());
  
  useEffect(() => {
    // Calculate ms until next minute (sync with clock)
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    
    // First sync to the exact minute change
    const syncTimeout = setTimeout(() => {
      setDateTime(formatDateTime());
      
      // Then update every 60 seconds exactly on the minute
      const interval = setInterval(() => {
        setDateTime(formatDateTime());
      }, 60000);
      
      // Store interval for cleanup
      (window as any).__dateTimeInterval = interval;
    }, msUntilNextMinute);
    
    return () => {
      clearTimeout(syncTimeout);
      if ((window as any).__dateTimeInterval) {
        clearInterval((window as any).__dateTimeInterval);
      }
    };
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
  
  const [showContent, setShowContent] = useState(false);
  
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowContent(true), 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

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
  
  const { text: greetingText, isEvening } = greeting;
  
  const weather = useWeather({
    fallbackCity: profile?.location || profile?.home_location || profile?.address || 'Stockholm',
  });
  
  // Emoji logic based on time of day and weather
  const displayEmoji = useMemo(() => {
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
  }, [weather.weatherCode, isEvening]);

  if (isLoading || !showContent) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto px-4 md:px-8 py-8 opacity-0">
        {/* Invisible placeholder */}
      </div>
    );
  }

  return (
    <>
      <WeatherEffects weatherCode={weather.weatherCode} isLoading={weather.isLoading} isEvening={isEvening} />
      <div className="space-y-8 max-w-5xl mx-auto px-4 md:px-8 py-6 animate-fade-in relative z-10">
        {/* Personal greeting */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center md:text-left"
        >
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              {greetingText}, {firstName} {displayEmoji}
            </h1>
          </div>
          <DateTimeDisplay />
          {!weather.isLoading && !weather.error && weather.description ? (
            <p className="text-white mt-2 text-base">
              {weather.city ? `${weather.city}, ` : ''}{weather.temperature}° – {weather.description}
            </p>
          ) : (
            <p className="text-white mt-2 text-base">
              Välkommen till din rekryteringsportal
            </p>
          )}
        </motion.div>

        {/* Quick summary */}
        {(stats.activeJobs > 0 || stats.pendingApplications > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-wrap gap-4 justify-center md:justify-start"
          >
            {stats.activeJobs > 0 && (
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                <Briefcase className="h-4 w-4 text-emerald-400" />
                <span className="text-white text-sm">
                  <span className="font-semibold">{stats.activeJobs}</span> aktiva annonser
                </span>
              </div>
            )}
            {stats.pendingApplications > 0 && (
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                <Users className="h-4 w-4 text-blue-400" />
                <span className="text-white text-sm">
                  <span className="font-semibold">{stats.pendingApplications}</span> nya ansökningar
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          <QuickAction
            icon={Plus}
            title="Skapa annons"
            description="Publicera en ny jobbannons och börja ta emot ansökningar"
            onClick={() => navigate('/my-jobs?create=true')}
            gradient="from-emerald-500/90 via-emerald-600/80 to-teal-700/90"
            delay={0.1}
          />
          <QuickAction
            icon={Users}
            title="Kandidater"
            description="Granska och hantera dina sökande"
            onClick={() => navigate('/candidates')}
            gradient="from-blue-500/90 via-blue-600/80 to-indigo-700/90"
            delay={0.15}
          />
          <QuickAction
            icon={BarChart3}
            title="Statistik"
            description="Se detaljerad statistik och insikter"
            onClick={() => navigate('/dashboard')}
            gradient="from-violet-500/90 via-purple-600/80 to-purple-700/90"
            delay={0.2}
          />
          <QuickAction
            icon={FileText}
            title="Mina annonser"
            description="Hantera och redigera dina jobbannonser"
            onClick={() => navigate('/my-jobs')}
            gradient="from-amber-500/90 via-orange-500/80 to-orange-600/90"
            delay={0.25}
          />
        </div>

        {/* Additional actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <Card 
            className="bg-gradient-to-r from-white/[0.08] to-white/[0.04] backdrop-blur-sm border-white/10 hover:from-white/[0.12] hover:to-white/[0.08] transition-all duration-300 cursor-pointer group"
            onClick={() => navigate('/company-profile')}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/30 to-primary/20 group-hover:from-primary/40 group-hover:to-primary/30 transition-all duration-300">
                <Building2 className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white">Företagsprofil</p>
                <p className="text-sm text-white/50">Uppdatera din företagsinformation</p>
              </div>
              <ArrowRight className="h-5 w-5 text-white/30 group-hover:text-white/60 group-hover:translate-x-1 transition-all duration-300" />
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-to-r from-white/[0.08] to-white/[0.04] backdrop-blur-sm border-white/10 hover:from-white/[0.12] hover:to-white/[0.08] transition-all duration-300 cursor-pointer group"
            onClick={() => navigate('/templates')}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/30 to-cyan-600/20 group-hover:from-cyan-500/40 group-hover:to-cyan-600/30 transition-all duration-300">
                <FileText className="h-5 w-5 text-cyan-300" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white">Jobbmallar</p>
                <p className="text-sm text-white/50">Skapa och hantera återanvändbara mallar</p>
              </div>
              <ArrowRight className="h-5 w-5 text-white/30 group-hover:text-white/60 group-hover:translate-x-1 transition-all duration-300" />
            </CardContent>
          </Card>
        </motion.div>

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
