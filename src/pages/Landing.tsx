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
    <div className="landing-page-surface fixed inset-0 w-full overflow-x-hidden overflow-y-auto text-pure-white" style={{ WebkitOverflowScrolling: 'touch' } as any}>
      <div className="landing-background-shell fixed inset-0 pointer-events-none" aria-hidden="true" />
      <div className="landing-background-grid fixed inset-0 pointer-events-none" aria-hidden="true" />
      <div className="landing-background-noise fixed inset-0 pointer-events-none" aria-hidden="true" />
      <div className="landing-background-beam landing-background-beam-left fixed inset-y-0 left-[-12%] w-[34rem] pointer-events-none" aria-hidden="true" />
      <div className="landing-background-beam landing-background-beam-right fixed inset-y-0 right-[-12%] w-[34rem] pointer-events-none" aria-hidden="true" />
      <div className="landing-background-vignette fixed inset-0 pointer-events-none" aria-hidden="true" />

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
