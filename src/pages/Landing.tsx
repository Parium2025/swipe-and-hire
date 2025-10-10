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
import phoneMockup from '@/assets/phone-mockup-with-logo.jpg';

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
      <section className="relative pt-32 pb-20 px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Hero Content */}
            <motion.div 
              className="space-y-8 text-center lg:text-left"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
                <span className="text-secondary font-semibold text-sm">🚀 Framtidens rekrytering</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight">
                Rekrytering som <span className="text-secondary">matchar på riktigt</span>
              </h1>
              
              <p className="text-lg md:text-xl text-white/80 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Minska time-to-hire med 73% genom intelligent matchning. 
                Vi förändrar hur människor och företag hittar varandra – 
                framtiden börjar med ett swipe.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button
                  onClick={() => navigate('/auth')}
                  size="lg"
                  className="bg-secondary text-white hover:bg-secondary/90 text-lg px-8 py-6 h-auto font-semibold shadow-2xl"
                >
                  Kom igång gratis
                </Button>
                <Button
                  onClick={() => navigate('/auth')}
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10 text-lg px-8 py-6 h-auto font-semibold"
                >
                  Boka demo
                </Button>
              </div>

              {/* Trust indicators */}
              <div className="flex flex-wrap items-center gap-6 justify-center lg:justify-start pt-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-white/70 text-sm">500+ aktiva företag</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
                  <span className="text-white/70 text-sm">10,000+ kandidater</span>
                </div>
              </div>
            </motion.div>

            {/* Right: Product Mockup */}
            <motion.div
              className="relative lg:block hidden"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="relative">
                {/* Glow effects */}
                <div className="absolute -inset-20 bg-secondary/20 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute -inset-10 bg-primary-glow/30 rounded-full blur-[80px]" />
                
                {/* Phone mockup */}
                <div className="relative z-10">
                  <img 
                    src={phoneMockup} 
                    alt="Parium App Interface" 
                    className="w-full max-w-md mx-auto drop-shadow-2xl"
                  />
                </div>
              </div>
            </motion.div>
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
      <section id="features" className="py-20 px-6 md:px-12 lg:px-24 relative">
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
      <footer className="py-16 px-6 md:px-12 lg:px-24 border-t border-white/10 bg-primary/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            {/* Company Info */}
            <div className="space-y-4">
              <h3 className="text-white font-bold text-lg">Parium</h3>
              <p className="text-white/70 text-sm leading-relaxed">
                Vi revolutionerar rekrytering genom intelligent matchning. 
                Snabbare, enklare och mer träffsäkert.
              </p>
            </div>

            {/* Product */}
            <div className="space-y-4">
              <h4 className="text-white font-semibold">Produkt</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#experience-section" className="text-white/70 hover:text-white transition-colors text-sm">
                    Funktioner
                  </a>
                </li>
                <li>
                  <a href="#priser" className="text-white/70 hover:text-white transition-colors text-sm">
                    Priser
                  </a>
                </li>
                <li>
                  <a href="/auth" className="text-white/70 hover:text-white transition-colors text-sm">
                    Kom igång
                  </a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div className="space-y-4">
              <h4 className="text-white font-semibold">Företag</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#om-oss" className="text-white/70 hover:text-white transition-colors text-sm">
                    Om oss
                  </a>
                </li>
                <li>
                  <a href="#kontakt" className="text-white/70 hover:text-white transition-colors text-sm">
                    Kontakt
                  </a>
                </li>
                <li>
                  <a href="/support" className="text-white/70 hover:text-white transition-colors text-sm">
                    Support
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div className="space-y-4">
              <h4 className="text-white font-semibold">Juridiskt</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#integritet" className="text-white/70 hover:text-white transition-colors text-sm">
                    Integritetspolicy
                  </a>
                </li>
                <li>
                  <a href="#villkor" className="text-white/70 hover:text-white transition-colors text-sm">
                    Användarvillkor
                  </a>
                </li>
                <li>
                  <a href="#cookies" className="text-white/70 hover:text-white transition-colors text-sm">
                    Cookie-policy
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-white/60 text-sm">
              © 2025 Parium AB. Alla rättigheter reserverade.
            </div>
            
            <div className="flex gap-6">
              <a href="#" className="text-white/60 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" className="text-white/60 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="text-white/60 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.51 0 10-4.48 10-10S17.51 2 12 2zm6.605 4.61a8.502 8.502 0 011.93 5.314c-.281-.054-3.101-.629-5.943-.271-.065-.141-.12-.293-.184-.445a25.416 25.416 0 00-.564-1.236c3.145-1.28 4.577-3.124 4.761-3.362zM12 3.475c2.17 0 4.154.813 5.662 2.148-.152.216-1.443 1.941-4.48 3.08-1.399-2.57-2.95-4.675-3.189-5A8.687 8.687 0 0112 3.475zm-3.633.803a53.896 53.896 0 013.167 4.935c-3.992 1.063-7.517 1.04-7.896 1.04a8.581 8.581 0 014.729-5.975zM3.453 12.01v-.26c.37.01 4.512.065 8.775-1.215.25.477.477.965.694 1.453-.109.033-.228.065-.336.098-4.404 1.42-6.747 5.303-6.942 5.629a8.522 8.522 0 01-2.19-5.705zM12 20.547a8.482 8.482 0 01-5.239-1.8c.152-.315 1.888-3.656 6.703-5.337.022-.01.033-.01.054-.022a35.318 35.318 0 011.823 6.475 8.4 8.4 0 01-3.341.684zm4.761-1.465c-.086-.52-.542-3.015-1.659-6.084 2.679-.423 5.022.271 5.314.369a8.468 8.468 0 01-3.655 5.715z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
