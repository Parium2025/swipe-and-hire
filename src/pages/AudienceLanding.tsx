import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import LandingNav from '@/components/LandingNav';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { syncBrowserChrome } from '@/lib/browserChrome';
import AudienceHero from '@/components/landing/audience/AudienceHero';
import AudienceStatement from '@/components/landing/audience/AudienceStatement';
import AudienceHowItWorks from '@/components/landing/audience/AudienceHowItWorks';
import AudienceFeatures from '@/components/landing/audience/AudienceFeatures';
import AudienceProof from '@/components/landing/audience/AudienceProof';
import AudienceFinalCTA from '@/components/landing/audience/AudienceFinalCTA';

type AudienceLandingProps = {
  audience: 'job_seeker' | 'employer';
};

const AudienceLanding = ({ audience }: AudienceLandingProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    syncBrowserChrome(window.location.pathname);
    document.title =
      audience === 'job_seeker'
        ? 'Parium – För jobbsökare'
        : 'Parium – För arbetsgivare';
  }, [audience]);

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };

  return (
    <div className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden bg-parium-navy text-primary-foreground">
      <AnimatedBackground />
      <div className="relative z-10 min-h-full">
        <LandingNav onLoginClick={handleLogin} />
        <motion.main
          initial={{ x: audience === 'job_seeker' ? '100vw' : '-100vw', opacity: 0, filter: 'blur(12px)' }}
          animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <AudienceHero role={audience} />
          <AudienceStatement role={audience} />
          <AudienceHowItWorks role={audience} />
          <AudienceFeatures role={audience} />
          <AudienceProof role={audience} />
          <AudienceFinalCTA role={audience} />
        </motion.main>
      </div>
    </div>
  );
};

export default AudienceLanding;
