import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LandingNav from '@/components/LandingNav';
import useLandingSeo from '@/components/landing/useLandingSeo';
import LandingHero from '@/components/landing/LandingHero';
import LandingStats from '@/components/landing/LandingStats';
import LandingFeatures from '@/components/landing/LandingFeatures';
import LandingHowItWorks from '@/components/landing/LandingHowItWorks';
import LandingTestimonials from '@/components/landing/LandingTestimonials';
import LandingCTA from '@/components/landing/LandingCTA';
import LandingFooter from '@/components/landing/LandingFooter';

const Landing = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  useLandingSeo();

  useEffect(() => {
    if (user && profile) {
      const role = (profile as any)?.role;
      if (role) navigate('/home', { replace: true });
    }
  }, [user, profile, navigate]);

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };

  return (
    <div className="fixed inset-0 w-full overflow-x-hidden overflow-y-auto bg-primary text-pure-white" style={{ WebkitOverflowScrolling: 'touch' } as any}>
      <div className="landing-premium-shell fixed inset-0 pointer-events-none" aria-hidden="true" />
      <div className="landing-grid-lines fixed inset-0 pointer-events-none" aria-hidden="true" />
      <div className="landing-noise fixed inset-0 pointer-events-none" aria-hidden="true" />
      <div className="landing-aurora landing-aurora-left fixed inset-y-0 left-[-18%] w-[48rem] pointer-events-none" aria-hidden="true" />
      <div className="landing-aurora landing-aurora-right fixed inset-y-0 right-[-18%] w-[48rem] pointer-events-none" aria-hidden="true" />
      <div className="landing-spotlight fixed inset-x-0 top-0 h-[24rem] pointer-events-none" aria-hidden="true" />

      <div className="relative z-10">
        <LandingNav onLoginClick={handleLogin} />
        <main className="relative overflow-hidden">
          <LandingHero />
          <LandingStats />
          <LandingFeatures />
          <LandingHowItWorks />
          <LandingTestimonials />
          <LandingCTA />
        </main>
        <LandingFooter />
      </div>
    </div>
  );
};

export default Landing;
