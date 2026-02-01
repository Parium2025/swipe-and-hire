import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LandingNav from '@/components/LandingNav';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { Button } from '@/components/ui/button';
import { Zap, Video, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthNavigation } from '@/hooks/useAuthNavigation';
const HERO_URL = '/assets/hero-woman-left-hand-verified.jpg';

const Landing = () => {
  const navigate = useNavigate();
  const { navigateToAuth } = useAuthNavigation();
  const { user, profile } = useAuth();

  // Redirect authenticated users
  useEffect(() => {
    if (user && profile) {
      const role = (profile as any)?.role;
      if (role) {
        // Alla roller landar på /home efter inloggning
        navigate('/home', { replace: true });
      }
    }
  }, [user, profile, navigate]);

  // SEO Meta tags
  useEffect(() => {
    document.title = 'Parium - Verktyget som matchar på riktigt';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Hitta ditt drömjobb eller nästa stjärnkandidat på 60 sekunder. Parium gör rekrytering snabbt, enkelt och effektivt.');
    }
  }, []);

  const handleLogin = () => {
    navigateToAuth();
  };

  const features = [
    {
      icon: Zap,
      title: 'Snabb matchning',
      description: 'Hitta rätt match på 60 sekunder med vår intelligenta algoritm'
    },
    {
      icon: Video,
      title: 'Video-profiler',
      description: 'Visa vem du verkligen är med personliga video-presentationer'
    },
    {
      icon: Heart,
      title: 'Smart swipe',
      description: 'Enkelt och intuitivt gränssnitt som gör rekrytering till en upplevelse'
    }
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-parium text-white overflow-x-hidden relative">
      <AnimatedBackground />
      <LandingNav onLoginClick={handleLogin} />
      
      {/* Hero Section */}
      <section className="relative pt-24 sm:pt-28 md:pt-32 pb-16 sm:pb-20 px-4 sm:px-6 md:px-12 lg:px-24 min-h-screen flex items-center">
        {/* Background Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover will-change-transform select-none"
          style={{ backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}
        >
          <source src="/assets/hero-video.mp4" type="video/mp4" />
          {/* Fallback image om video inte laddar */}
          <img
            src={HERO_URL}
            alt="Parium hero"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </video>
        {/* Overlay för bättre textläsbarhet */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/80 via-primary/40 to-transparent md:from-primary/70 md:via-primary/20" />
        
        <div className="max-w-7xl mx-auto relative z-10 w-full">
          <div className="flex flex-col items-start text-left max-w-2xl">
            {/* Hero Content */}
            <div className="space-y-4 sm:space-y-6 md:space-y-8 animate-fade-in mb-6 sm:mb-8 md:mb-12">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight tracking-tight text-white">
                Verktyget som matchar på riktigt
              </h1>
              
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white leading-relaxed">
                Vi förändrar hur människor och företag hittar varandra. Framtiden börjar med ett swipe.
              </p>
            </div>

            {/* Two Main CTAs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                onClick={() => navigateToAuth({ mode: 'register', role: 'job_seeker' })}
                className="bg-white/5 backdrop-blur-[2px] border border-white/20 text-white p-4 sm:p-5 rounded-lg cursor-pointer hover:bg-white/15 hover:shadow-2xl transition-all duration-300 hover:scale-105 group min-h-[80px] sm:min-h-[90px]"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base sm:text-lg font-bold text-white">Jag söker jobb</h3>
                  <div className="transform group-hover:translate-x-2 transition-transform text-white">
                    →
                  </div>
                </div>
                <p className="text-white text-sm">
                  Hitta ditt drömjobb snabbt och enkelt. Swipea dig till rätt match.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                onClick={() => navigateToAuth({ mode: 'register', role: 'employer' })}
                className="bg-white/5 backdrop-blur-[2px] border border-white/20 text-white p-4 sm:p-5 rounded-lg cursor-pointer hover:bg-white/15 hover:shadow-2xl transition-all duration-300 hover:scale-105 group min-h-[80px] sm:min-h-[90px]"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base sm:text-lg font-bold text-white">Jag söker personal</h3>
                  <div className="transform group-hover:translate-x-2 transition-transform text-white">
                    →
                  </div>
                </div>
                <p className="text-white text-sm">
                  Hitta rätt kandidater effektivt. Swipea dig till perfekta medarbetare.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 md:px-12 lg:px-24 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-12 sm:mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 tracking-tight text-white">
              Varför välja Parium?
            </h2>
            <p className="text-white text-sm sm:text-base md:text-lg max-w-2xl mx-auto px-4">
              Vi har byggt en plattform som gör rekrytering snabbt, enkelt och roligt
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  whileHover={{ 
                    scale: 1.05,
                    rotateY: 5,
                    transition: { duration: 0.2 }
                  }}
                  className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-white/10 hover:bg-white/10 hover:border-secondary/30 transition-all duration-300 group"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <div className="mb-4 sm:mb-6">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-secondary/20 flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 relative">
                      <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-secondary animate-pulse" />
                      <div className="absolute inset-0 bg-secondary/20 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                    </div>
                  </div>
                  
                  <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 tracking-tight text-white group-hover:text-secondary transition-colors duration-300">
                    {feature.title}
                  </h3>
                  
                  <p className="text-white leading-relaxed text-sm sm:text-base">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 px-4 sm:px-6 md:px-12 lg:px-24 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6">
            <div className="text-white text-sm text-center md:text-left">
              © 2025 Parium. Alla rättigheter reserverade.
            </div>
            
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-8 text-sm">
              <button className="text-white hover:text-white transition-colors min-h-[44px] flex items-center">
                Om oss
              </button>
              <button className="text-white hover:text-white transition-colors min-h-[44px] flex items-center">
                Kontakt
              </button>
              <button className="text-white hover:text-white transition-colors min-h-[44px] flex items-center">
                Support
              </button>
              <button className="text-white hover:text-white transition-colors min-h-[44px] flex items-center">
                Integritetspolicy
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
