import { memo, useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useJobsData } from '@/hooks/useJobsData';
import { useCountUp } from '@/hooks/useCountUp';
import { useWeather } from '@/hooks/useWeather';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Briefcase, 
  TrendingUp, 
  Users, 
  Eye, 
  Plus,
  ArrowRight,
  Clock,
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

interface StatCardProps {
  icon: React.ElementType;
  title: string;
  value: number;
  subtitle?: string;
  gradient: string;
  glowColor: string;
  delay: number;
}

const AnimatedNumber = memo(({ value, delay }: { value: number; delay: number }) => {
  const count = useCountUp(value, { duration: 1200, delay: delay * 1000 + 200 });
  return <>{count.toLocaleString('sv-SE')}</>;
});

AnimatedNumber.displayName = 'AnimatedNumber';

const StatCard = memo(({ icon: Icon, title, value, subtitle, gradient, glowColor, delay }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    className="group"
  >
    <Card className={`relative overflow-hidden bg-gradient-to-br ${gradient} border-0 shadow-lg transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-xl cursor-default`}>
      {/* Glow effect */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${glowColor} blur-xl`} />
      
      {/* Glass overlay */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
      
      {/* Decorative elements */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
      <div className="absolute -left-4 -bottom-4 w-16 h-16 bg-white/5 rounded-full blur-xl" />
      
      <CardContent className="relative p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-white/80 tracking-wide uppercase">{title}</p>
            <p className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              <AnimatedNumber value={value} delay={delay} />
            </p>
            {subtitle && (
              <p className="text-xs text-white/60 font-medium">{subtitle}</p>
            )}
          </div>
          <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm transition-all duration-300 group-hover:bg-white/20 group-hover:scale-110">
            <Icon className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
));

StatCard.displayName = 'StatCard';

const DateTimeDisplay = memo(() => {
  const [dateTime, setDateTime] = useState(formatDateTime);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDateTime(formatDateTime());
    }, 60000); // Update every minute
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
  const { profile, preloadedEmployerMyJobs, preloadedEmployerActiveJobs, preloadedEmployerTotalViews, preloadedEmployerTotalApplications } = useAuth();
  const { jobs, isLoading } = useJobsData({ scope: 'personal' });
  
  const [showContent, setShowContent] = useState(false);
  
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowContent(true), 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Calculate stats
  const stats = useMemo(() => {
    const activeJobs = jobs.filter(j => j.is_active && !isJobExpiredCheck(j.created_at, j.expires_at));
    const pendingApplications = activeJobs.reduce((sum, job) => sum + (job.applications_count || 0), 0);
    const totalViews = activeJobs.reduce((sum, job) => sum + (job.views_count || 0), 0);

    return {
      activeJobs: isLoading ? preloadedEmployerActiveJobs : activeJobs.length,
      totalJobs: isLoading ? preloadedEmployerMyJobs : jobs.length,
      totalApplications: isLoading ? preloadedEmployerTotalApplications : pendingApplications,
      totalViews: isLoading ? preloadedEmployerTotalViews : totalViews,
    };
  }, [jobs, isLoading, preloadedEmployerActiveJobs, preloadedEmployerMyJobs, preloadedEmployerTotalApplications, preloadedEmployerTotalViews]);

  // Get jobs that need attention (have unviewed applications)
  const jobsNeedingAttention = useMemo(() => {
    return jobs
      .filter(j => j.is_active && !isJobExpiredCheck(j.created_at, j.expires_at) && (j.applications_count || 0) > 0)
      .slice(0, 3);
  }, [jobs]);

  const firstName = profile?.first_name || 'du';
  const [showPreview, setShowPreview] = useState(false);
  const [previewEvening, setPreviewEvening] = useState(false);
  const [previewWeatherCode, setPreviewWeatherCode] = useState<number | null>(null);
  const { text: greetingText, isEvening: realIsEvening } = getGreeting();
  const isEvening = previewEvening || realIsEvening;
  const weather = useWeather({
    fallbackCity: profile?.location || profile?.home_location || profile?.address || 'Stockholm',
  });
  
  // Use preview weather code if set, otherwise use real weather
  const activeWeatherCode = previewWeatherCode !== null ? previewWeatherCode : weather.weatherCode;
  
  // Emoji logic based on time of day and weather
  const displayEmoji = useMemo(() => {
    const getEmojiForCode = (code: number) => {
      if (code === 0) return '☀️'; // Clear
      if (code === 1) return '🌤️'; // Mostly clear
      if (code === 2) return '⛅'; // Partly cloudy
      if (code === 3) return '☁️'; // Overcast
      if (code === 45 || code === 48) return '☁️'; // Fog - uses cloud emoji as agreed
      if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️'; // Rain
      if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️'; // Snow
      if ([95, 96, 99].includes(code)) return '⛈️'; // Thunderstorm
      return '☀️';
    };
    
    if (!isEvening) {
      // DAYTIME - show weather emoji
      return getEmojiForCode(activeWeatherCode);
    }
    
    // EVENING (after 18:00) - show moon when appropriate
    if (activeWeatherCode === 0 || activeWeatherCode === 1) {
      // Clear or mostly clear evening sky - just moon (stars are in background)
      return '🌙';
    }
    if (activeWeatherCode === 2) {
      // Partly cloudy evening - moon with clouds
      return '🌙☁️';
    }
    // Overcast, rain, snow, etc. - just show weather (moon not visible)
    return getEmojiForCode(activeWeatherCode);
  }, [activeWeatherCode, isEvening]);
  
  // Weather preview options
  const weatherOptions = [
    { code: null, label: 'Verkligt väder', emoji: weather.emoji },
    { code: 0, label: 'Klart', emoji: '☀️' },
    { code: 1, label: 'Mestadels klart', emoji: '🌤️' },
    { code: 2, label: 'Delvis molnigt', emoji: '⛅' },
    { code: 3, label: 'Mulet', emoji: '☁️' },
    { code: 45, label: 'Dimma', emoji: '☁️' },
    { code: 61, label: 'Regn', emoji: '🌧️' },
    { code: 71, label: 'Snö', emoji: '❄️' },
    { code: 95, label: 'Åska', emoji: '⛈️' },
  ];

  if (isLoading || !showContent) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto px-4 md:px-8 py-8 opacity-0">
        {/* Invisible placeholder */}
      </div>
    );
  }

  return (
    <>
      <WeatherEffects weatherCode={activeWeatherCode} isLoading={weather.isLoading} isEvening={isEvening} />
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
            Här är en översikt över din rekrytering
          </p>
        )}
        {/* Temporary preview controls - REMOVE AFTER TESTING */}
        <button 
          onClick={() => setShowPreview(!showPreview)}
          className="mt-2 text-xs text-white/50 hover:text-white/80 underline"
        >
          {showPreview ? '✕ Stäng förhandsgranskning' : '🛠️ Förhandsgranska väder'}
        </button>
        
        {showPreview && (
          <div className="mt-3 p-4 bg-black/40 rounded-xl backdrop-blur-md border border-white/20 max-w-lg animate-fade-in">
            <p className="text-sm text-white/90 mb-3 font-medium">Välj väder att förhandsgranska:</p>
            
            {/* Time of day toggle */}
            <div className="flex gap-2 mb-3">
              <button 
                onClick={() => setPreviewEvening(false)}
                className={`flex-1 px-4 py-2 text-sm rounded-lg transition-all ${
                  !previewEvening 
                    ? 'bg-amber-500 text-white shadow-lg' 
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                ☀️ Dag
              </button>
              <button 
                onClick={() => setPreviewEvening(true)}
                className={`flex-1 px-4 py-2 text-sm rounded-lg transition-all ${
                  previewEvening 
                    ? 'bg-indigo-500 text-white shadow-lg' 
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                🌙 Kväll
              </button>
            </div>
            
            {/* Weather options grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {weatherOptions.map((option) => (
                <button
                  key={option.code ?? 'real'}
                  onClick={() => setPreviewWeatherCode(option.code)}
                  className={`px-3 py-2 text-sm rounded-lg transition-all flex flex-col items-center gap-1 ${
                    previewWeatherCode === option.code
                      ? 'bg-blue-500 text-white shadow-lg ring-2 ring-blue-300'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  <span className="text-xl">{option.emoji}</span>
                  <span className="text-xs">{option.label}</span>
                </button>
              ))}
            </div>
            
            {/* Reset button */}
            {(previewWeatherCode !== null || previewEvening) && (
              <button
                onClick={() => {
                  setPreviewWeatherCode(null);
                  setPreviewEvening(false);
                }}
                className="mt-3 w-full px-3 py-2 text-xs rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-all"
              >
                ↩️ Återställ till verkligt väder
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <StatCard
          icon={TrendingUp}
          title="Aktiva annonser"
          value={stats.activeJobs}
          gradient="from-emerald-500/90 via-emerald-600/80 to-teal-700/90"
          glowColor="bg-emerald-500/30"
          delay={0.1}
        />
        <StatCard
          icon={Users}
          title="Nya ansökningar"
          value={stats.totalApplications}
          gradient="from-blue-500/90 via-blue-600/80 to-indigo-700/90"
          glowColor="bg-blue-500/30"
          delay={0.15}
        />
        <StatCard
          icon={Eye}
          title="Totala visningar"
          value={stats.totalViews}
          gradient="from-violet-500/90 via-purple-600/80 to-purple-700/90"
          glowColor="bg-violet-500/30"
          delay={0.2}
        />
        <StatCard
          icon={Clock}
          title="Väntar på feedback"
          value={stats.totalApplications}
          gradient="from-amber-500/90 via-orange-500/80 to-orange-600/90"
          glowColor="bg-amber-500/30"
          delay={0.25}
        />
      </div>

      {/* Jobs needing attention */}
      {jobsNeedingAttention.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Jobb med nya ansökningar</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/my-jobs')}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              Visa alla
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {jobsNeedingAttention.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.55 + index * 0.08 }}
              >
                <Card 
                  className="bg-gradient-to-r from-white/[0.08] to-white/[0.04] backdrop-blur-sm border-white/10 hover:from-white/[0.12] hover:to-white/[0.08] transition-all duration-300 cursor-pointer group hover:scale-[1.01]"
                  onClick={() => navigate(`/job-details/${job.id}`)}
                >
                  <CardContent className="p-4 md:p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/30 to-blue-600/20 group-hover:from-blue-500/40 group-hover:to-blue-600/30 transition-all duration-300">
                        <Briefcase className="h-5 w-5 text-blue-300" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="font-semibold text-white text-base md:text-lg">{job.title}</p>
                        <p className="text-sm text-white/50">{job.location || 'Ingen plats angiven'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-400">{job.applications_count || 0}</p>
                        <p className="text-xs text-white/50">ansökningar</p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-white/30 group-hover:text-white/60 group-hover:translate-x-1 transition-all duration-300" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty state if no jobs */}
      {jobs.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          <Card className="bg-gradient-to-br from-white/[0.08] to-white/[0.04] backdrop-blur-sm border-white/10 border-dashed">
            <CardContent className="p-10 text-center">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 w-fit mx-auto mb-5">
                <Briefcase className="h-10 w-10 text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Välkommen till Parium!
              </h3>
              <p className="text-white/60 mb-6 max-w-md mx-auto">
                Du har inga annonser ännu. Skapa din första jobbannons för att börja ta emot ansökningar.
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
