import { useNavigate } from 'react-router-dom';
import LandingV2Button from './Button';

const BottomNav = () => {
  const navigate = useNavigate();
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-3 py-2 rounded-full bg-white/95"
      style={{
        boxShadow:
          '0 1px 2px 0 rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.18), 0 24px 60px rgba(0,0,0,0.25), inset 0 2px 8px 0 rgba(255,255,255,0.5)',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <span className="font-pp-mondwest text-2xl font-semibold text-[#051A24] pl-3">
        P
      </span>
      <LandingV2Button
        variant="tertiary"
        className="!bg-[#051A24] !text-white"
        onClick={() => {
          sessionStorage.setItem('parium-skip-splash', '1');
          navigate('/auth');
        }}
      >
        Kom igång
      </LandingV2Button>
    </div>
  );
};

export default BottomNav;
