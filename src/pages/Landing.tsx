import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LandingNav from '@/components/LandingNav';
import LandingHero from '@/components/landing/LandingHero';
import LandingStats from '@/components/landing/LandingStats';
import LandingFeatures from '@/components/landing/LandingFeatures';
import LandingHowItWorks from '@/components/landing/LandingHowItWorks';
import LandingCTA from '@/components/landing/LandingCTA';
import LandingFooter from '@/components/landing/LandingFooter';

const Landing = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // Redirect authenticated users
  useEffect(() => {
    if (user && profile) {
      const role = (profile as any)?.role;
      if (role) navigate('/home', { replace: true });
    }
  }, [user, profile, navigate]);

  // SEO
  useEffect(() => {
    document.title = 'Parium - Rekrytering, reinvented';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', 'Parium matchar kandidater och arbetsgivare på sekunder. Swipea, matcha och anställ med Skandinaviens smartaste rekryteringsplattform.');
    }
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };

  return (
    <div className="min-h-screen w-full bg-primary text-white overflow-x-hidden">
      {/* Deep gradient background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,hsl(210_80%_15%),hsl(var(--primary)))] pointer-events-none" />
      
      <div className="relative z-10">
        <LandingNav onLoginClick={handleLogin} />
        <LandingHero />
        <LandingStats />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingCTA />
        <LandingFooter />
      </div>
    </div>
  );
};

export default Landing;
