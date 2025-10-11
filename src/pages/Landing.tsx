import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LandingNav from '@/components/LandingNav';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { Button } from '@/components/ui/button';
import { Zap, Video, Heart, Sparkles } from 'lucide-react';
import { SwipeDemo } from '@/components/SwipeDemo';
import { LiveStats } from '@/components/LiveStats';
import { ScrollTransition } from '@/components/ScrollTransition';
import { motion } from 'framer-motion';
import heroBackground from '@/assets/hero-woman-left-hand-verified.jpg';

const Landing = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

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
    document.title = 'Parium - Matchningen som förändrar rekrytering';
    
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
      <section className="relative pt-32 pb-20 px-6 md:px-12 lg:px-24 min-h-screen flex items-center">
        {/* Background Image */}
        <img
          src={heroBackground}
          alt="Parium hero – kvinna håller telefonen i vänster hand"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: '45% center' }}
          loading="eager"
        />
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/70 via-primary/20 to-transparent" />
        
        <div className="max-w-7xl mx-auto relative z-10 w-full">
          <div className="flex flex-col items-start text-left max-w-2xl">
            {/* Hero Content */}
            <div className="space-y-8 animate-fade-in mb-12">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
                Verktyget som matchar på riktigt
              </h1>
              
              <p className="text-lg md:text-xl text-white leading-relaxed">
                Vi förändrar hur människor och verktyg hittar varandra. Framtiden börjar med ett swipe.
              </p>
            </div>

            {/* Two Main CTAs */}
            <div className="grid md:grid-cols-2 gap-3 w-full max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                onClick={() => navigate('/auth')}
                className="bg-white text-primary p-4 rounded-lg cursor-pointer hover:shadow-2xl transition-all duration-300 hover:scale-105 group"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold">Jag söker jobb</h3>
                  <div className="transform group-hover:translate-x-2 transition-transform">
                    →
                  </div>
                </div>
                <p className="text-primary/70 text-xs">
                  Hitta ditt drömjobb snabbt och enkelt. Swipea dig till rätt match.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                onClick={() => navigate('/auth')}
                className="bg-white text-primary p-4 rounded-lg cursor-pointer hover:shadow-2xl transition-all duration-300 hover:scale-105 group"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold">Jag söker personal</h3>
                  <div className="transform group-hover:translate-x-2 transition-transform">
                    →
                  </div>
                </div>
                <p className="text-primary/70 text-xs">
                  Hitta rätt kandidater effektivt. Swipea dig till perfekta medarbetare.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

    {/* Scroll Transition */}
    <ScrollTransition />

    {/* Experience Parium Section */}
    <section id="experience-section" className="py-32 px-6 md:px-12 lg:px-24 relative">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <motion.div 
            className="text-center mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/20 rounded-full mb-6 border border-secondary/30">
              <Sparkles className="w-4 h-4 text-secondary" />
              <span className="text-secondary font-semibold text-sm">Upplev Parium</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Rekrytering som känns som magi
            </h2>
            <p className="text-xl text-white/70 max-w-2xl mx-auto">
              Testa hur enkelt det är att hitta din perfekta match. Swipea höger för att matcha!
            </p>
          </motion.div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Swipe Demo */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="relative">
                <SwipeDemo />
                
                {/* Decorative elements */}
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
              </div>
            </motion.div>

            {/* Right: Live Stats */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="space-y-8">
                <div>
                  <h3 className="text-3xl font-bold mb-4">
                    Resultat som talar för sig själva
                  </h3>
                  <p className="text-white/70 text-lg leading-relaxed">
                    Tusentals företag och kandidater har redan hittat sin perfekta match genom Parium. 
                    Bli en del av framtidens rekrytering.
                  </p>
                </div>
                
                <LiveStats />

                <div className="pt-8">
                  <Button
                    onClick={() => navigate('/auth')}
                    size="lg"
                    className="bg-secondary text-white hover:bg-secondary/90 text-lg px-8 py-6 h-auto font-semibold shadow-2xl w-full md:w-auto"
                  >
                    Kom igång gratis
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 md:px-12 lg:px-24 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Varför välja Parium?
            </h2>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              Vi har byggt en plattform som gör rekrytering snabbt, enkelt och roligt
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
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
                  className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:bg-white/10 hover:border-secondary/30 transition-all duration-300 group"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <div className="mb-6">
                    <div className="w-14 h-14 rounded-xl bg-secondary/20 flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 relative">
                      <Icon className="w-7 h-7 text-secondary animate-pulse" />
                      <div className="absolute inset-0 bg-secondary/20 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-semibold mb-4 group-hover:text-secondary transition-colors duration-300">
                    {feature.title}
                  </h3>
                  
                  <p className="text-white/70 leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 md:px-12 lg:px-24 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-white/60 text-sm">
              © 2025 Parium. Alla rättigheter reserverade.
            </div>
            
            <div className="flex gap-8 text-sm">
              <button className="text-white/60 hover:text-white transition-colors">
                Om oss
              </button>
              <button className="text-white/60 hover:text-white transition-colors">
                Kontakt
              </button>
              <button className="text-white/60 hover:text-white transition-colors">
                Support
              </button>
              <button className="text-white/60 hover:text-white transition-colors">
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
