import { motion } from 'framer-motion';

interface SlidingTabsProps {
  isLogin: boolean;
  onTabChange: (value: string) => void;
  idPrefix?: string;
}

export function SlidingTabs({ isLogin, onTabChange, idPrefix = 'auth' }: SlidingTabsProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    let nextMode: 'login' | 'signup' | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'End') {
      nextMode = 'signup';
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'Home') {
      nextMode = 'login';
    }

    if (!nextMode) return;
    event.preventDefault();
    onTabChange(nextMode);
    const selector = nextMode === 'login' ? '[data-auth-tab="login"]' : '[data-auth-tab="signup"]';
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(selector)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Autentiseringsläge"
      className="relative flex bg-white/5 backdrop-blur-[2px] rounded-lg p-1 border border-white/20 mb-6"
    >
      {/* Sliding background */}
      <motion.div
        aria-hidden="true"
        className="absolute top-1 bottom-1 bg-parium-navy rounded-md"
        initial={false}
        animate={{
          left: isLogin ? '4px' : '50%',
          width: 'calc(50% - 4px)',
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 35,
          mass: 0.8,
        }}
      />
      
      {/* Buttons */}
      <button
        type="button"
        role="tab"
        id={`${idPrefix}-login-tab`}
        aria-controls={`${idPrefix}-login-panel`}
        data-auth-tab="login"
        aria-selected={isLogin}
        tabIndex={isLogin ? 0 : -1}
        onClick={() => onTabChange('login')}
        onKeyDown={handleKeyDown}
        className="relative z-10 flex-1 py-2 px-4 rounded-md text-sm font-medium text-white transition-colors"
      >
        Logga in
      </button>
      <button
        type="button"
        role="tab"
        id={`${idPrefix}-signup-tab`}
        aria-controls={`${idPrefix}-signup-panel`}
        data-auth-tab="signup"
        aria-selected={!isLogin}
        tabIndex={isLogin ? -1 : 0}
        onClick={() => onTabChange('signup')}
        onKeyDown={handleKeyDown}
        className="relative z-10 flex-1 py-2 px-4 rounded-md text-sm font-medium text-white transition-colors"
      >
        Registrera
      </button>
    </div>
  );
}
