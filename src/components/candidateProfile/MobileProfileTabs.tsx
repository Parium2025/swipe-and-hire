import { memo, useRef, useEffect, useState, useCallback, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { User, Activity, StickyNote } from 'lucide-react';

type MobileTabKey = 'profile' | 'activity' | 'comments';

const TABS: { key: MobileTabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'profile', label: 'Profil', icon: User },
  { key: 'activity', label: 'Aktivitet', icon: Activity },
  { key: 'comments', label: 'Anteckningar', icon: StickyNote },
];

interface MobileProfileTabsProps {
  mobileTab: MobileTabKey;
  setMobileTab: (tab: MobileTabKey) => void;
  closeButton?: ReactNode;
}

export const MobileProfileTabs = memo(function MobileProfileTabs({
  mobileTab,
  setMobileTab,
  closeButton,
}: MobileProfileTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const idx = TABS.findIndex(t => t.key === mobileTab);
    const el = tabRefs.current[idx];
    if (!el) return;
    // Measure the inner content span, not the full button
    const inner = el.querySelector('[data-tab-content]') as HTMLElement | null;
    const target = inner || el;
    const parent = el.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    setIndicator({
      left: targetRect.left - parentRect.left,
      width: targetRect.width,
    });
  }, [mobileTab]);

  useEffect(() => {
    measure();
    // Re-measure on resize
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  return (
    <div className="md:hidden flex shrink-0 items-center border-b border-white/20 relative">
      <motion.div
        className="absolute bottom-0 h-0.5 bg-white"
        initial={false}
        animate={{ left: indicator.left, width: indicator.width }}
        transition={{ type: 'spring', stiffness: 300, damping: 35, mass: 0.8 }}
      />
      {TABS.map((tab, i) => {
        const Icon = tab.icon;
        const isActive = mobileTab === tab.key;
        return (
          <button
            key={tab.key}
            ref={(el) => { tabRefs.current[i] = el; }}
            onClick={() => setMobileTab(tab.key)}
            className={`flex-1 px-1 py-2.5 text-xs font-medium transition-colors min-w-0 ${
              isActive ? 'text-white' : 'text-white/50'
            }`}
          >
            <div data-tab-content className="flex items-center justify-center gap-1 whitespace-nowrap w-fit mx-auto">
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-snug">{tab.label}</span>
            </div>
          </button>
        );
      })}
      {closeButton}
    </div>
  );
});