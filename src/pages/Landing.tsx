import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LandingNav from '@/components/LandingNav';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { Button } from '@/components/ui/button';
import { Zap, Video, Heart, ArrowRight, Sparkles } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
const HERO_URL = '/assets/hero-woman-left-hand-verified.jpg';

const Landing = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, 150]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);

  // Track mouse position for subtle interactive effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Redirect authenticated users
  useEffect(() => {
    if (user && profile) {
      const role = (profile as any)?.role;
      if (role) {
        const target = role === 'employer' ? '/dashboard' : '/search-jobs';
        navigate(target, { replace: true });
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
    navigate('/auth');
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
      <section className="relative pt-24 sm:pt-28 md:pt-32 pb-16 sm:pb-20 px-4 sm:px-6 md:px-12 lg:px-24 min-h-screen flex items-center overflow-hidden">
        {/* Background Image with Parallax */}
        <motion.img
          src={HERO_URL}
          alt="Parium hero – kvinna håller telefonen i vänster hand"
          className="absolute inset-0 w-full h-full object-cover object-center md:object-[60%_center] lg:object-[45%_center] will-change-transform select-none"
          loading="eager"
          decoding="sync"
          fetchPriority="high"
          style={{ 
            backfaceVisibility: 'hidden', 
            y: heroY,
            scale: 1.1
          }}
        />
        {/* Enhanced Overlay with Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/85 via-primary/45 to-transparent md:from-primary/75 md:via-primary/25" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-primary/20" />
        
        {/* Ambient Light Effect */}
        <motion.div 
          className="absolute w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none hidden md:block"
          style={{
            background: 'radial-gradient(circle, hsl(var(--secondary)) 0%, transparent 70%)',
            left: mousePosition.x - 192,
            top: mousePosition.y - 192,
          }}
        />
        
        <motion.div 
          className="max-w-7xl mx-auto relative z-10 w-full"
          style={{ opacity: heroOpacity }}
        >
          <div className="flex flex-col items-start text-left max-w-2xl">
            {/* Hero Content */}
            <motion.div 
              className="space-y-4 sm:space-y-6 md:space-y-8 mb-6 sm:mb-8 md:mb-12"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 backdrop-blur-sm mb-4">
                <Sparkles className="w-4 h-4 text-secondary animate-pulse" />
                <span className="text-xs sm:text-sm font-medium text-secondary">Framtidens rekryteringsplattform</span>
              </div>
              
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-secondary/90">
                Verktyget som matchar på riktigt
              </h1>
              
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/90 leading-relaxed">
                Vi förändrar hur människor och företag hittar varandra. Framtiden börjar med ett swipe.
              </p>
            </motion.div>

            {/* Two Main CTAs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                onClick={() => navigate('/auth', { state: { mode: 'register', role: 'job_seeker' } })}
                whileHover={{ scale: 1.03, y: -4 }}
                whileTap={{ scale: 0.98 }}
                className="relative bg-white/5 backdrop-blur-md border border-white/20 text-white p-4 sm:p-5 rounded-xl cursor-pointer hover:shadow-2xl transition-all duration-500 group min-h-[80px] sm:min-h-[90px] overflow-hidden"
              >
                {/* Gradient Border Effect */}
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-secondary/20 via-primary-glow/20 to-secondary/20 blur-xl" />
                
                {/* Shimmer Effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      Jag söker jobb
                    </h3>
                    <ArrowRight className="w-5 h-5 transform group-hover:translate-x-2 transition-transform text-secondary" />
                  </div>
                  <p className="text-white/80 text-xs sm:text-sm">
                    Hitta ditt drömjobb snabbt och enkelt. Swipea dig till rätt match.
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                onClick={() => navigate('/auth', { state: { mode: 'register', role: 'employer' } })}
                whileHover={{ scale: 1.03, y: -4 }}
                whileTap={{ scale: 0.98 }}
                className="relative bg-white/5 backdrop-blur-md border border-white/20 text-white p-4 sm:p-5 rounded-xl cursor-pointer hover:shadow-2xl transition-all duration-500 group min-h-[80px] sm:min-h-[90px] overflow-hidden"
              >
                {/* Gradient Border Effect */}
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-secondary/20 via-primary-glow/20 to-secondary/20 blur-xl" />
                
                {/* Shimmer Effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      Jag söker personal
                    </h3>
                    <ArrowRight className="w-5 h-5 transform group-hover:translate-x-2 transition-transform text-secondary" />
                  </div>
                  <p className="text-white/80 text-xs sm:text-sm">
                    Hitta rätt kandidater effektivt. Swipea dig till perfekta medarbetare.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
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
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
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
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ 
                    delay: index * 0.15, 
                    duration: 0.6,
                    ease: "easeOut"
                  }}
                  whileHover={{ 
                    scale: 1.05,
                    rotateY: 5,
                    z: 50,
                    transition: { duration: 0.3 }
                  }}
                  className="relative bg-white/5 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-secondary/40 transition-all duration-500 group overflow-hidden"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {/* Animated Gradient Border */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-secondary/0 via-secondary/30 to-primary-glow/30 blur-xl animate-pulse" />
                  </div>
                  
                  {/* Shine Effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                    <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/10 group-hover:animate-shine" />
                  </div>
                  
                  <div className="relative z-10">
                    <div className="mb-4 sm:mb-6">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-secondary/30 to-primary-glow/20 flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 relative">
                        <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-secondary relative z-10" />
                        <div className="absolute inset-0 bg-secondary/30 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                        <div className="absolute inset-0 bg-secondary/20 rounded-xl blur-2xl opacity-0 group-hover:opacity-100 animate-pulse transition-all duration-300" />
                      </div>
                    </div>
                    
                    <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 group-hover:text-secondary transition-colors duration-300 bg-clip-text">
                      {feature.title}
                    </h3>
                    
                    <p className="text-white/70 group-hover:text-white/90 leading-relaxed text-sm sm:text-base transition-colors duration-300">
                      {feature.description}
                    </p>
                  </div>
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
            <div className="text-white/60 text-xs sm:text-sm text-center md:text-left">
              © 2025 Parium. Alla rättigheter reserverade.
            </div>
            
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-8 text-xs sm:text-sm">
              <button className="text-white/60 hover:text-white transition-colors min-h-[44px] flex items-center">
                Om oss
              </button>
              <button className="text-white/60 hover:text-white transition-colors min-h-[44px] flex items-center">
                Kontakt
              </button>
              <button className="text-white/60 hover:text-white transition-colors min-h-[44px] flex items-center">
                Support
              </button>
              <button className="text-white/60 hover:text-white transition-colors min-h-[44px] flex items-center">
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
