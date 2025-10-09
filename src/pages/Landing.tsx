import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LandingNav from '@/components/LandingNav';
import { Button } from '@/components/ui/button';
import { Zap, Video, Heart } from 'lucide-react';
import phoneImage from '@/assets/phone-landscape-final.jpg';

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
    <div className="min-h-screen w-full bg-gradient-parium text-white overflow-x-hidden">
      <LandingNav onLoginClick={handleLogin} />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center text-center">
            {/* Hero Content */}
            <div className="space-y-8 animate-fade-in max-w-4xl">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
                Rekrytering som matchar på riktigt
              </h1>
              
              <p className="text-lg md:text-xl text-white leading-relaxed">
                Vi förändrar hur människor och företag hittar varandra – Framtiden börjar med ett swipe
              </p>
              
              <div className="pt-4">
                <Button
                  onClick={handleLogin}
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90 text-lg px-8 py-6 h-auto font-semibold shadow-2xl"
                >
                  Logga in
                </Button>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative mt-20 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="relative z-10">
                <img
                  src={phoneImage}
                  alt="Parium mobilapp med logotyp"
                  className="w-full max-w-2xl mx-auto drop-shadow-2xl"
                />
              </div>
              {/* Decorative glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-secondary/20 rounded-full blur-3xl -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 md:px-12 lg:px-24 relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:bg-white/10 transition-all duration-300 animate-fade-in"
                  style={{ animationDelay: `${0.3 + index * 0.1}s` }}
                >
                  <div className="mb-6">
                    <div className="w-14 h-14 rounded-xl bg-secondary/20 flex items-center justify-center">
                      <Icon className="w-7 h-7 text-secondary" />
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-semibold mb-4">
                    {feature.title}
                  </h3>
                  
                  <p className="text-white/70 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
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
