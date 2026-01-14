import { motion } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { User, Users } from 'lucide-react';

type ConversationTab = 'all' | 'candidates' | 'colleagues';

interface MessagesTabsProps {
  activeTab: ConversationTab;
  onTabChange: (tab: ConversationTab) => void;
  totalUnreadCount: number;
  candidateUnread: number;
  colleagueUnread: number;
}

export function MessagesTabs({ 
  activeTab, 
  onTabChange, 
  totalUnreadCount,
  candidateUnread,
  colleagueUnread 
}: MessagesTabsProps) {
  const allRef = useRef<HTMLButtonElement>(null);
  const candidatesRef = useRef<HTMLButtonElement>(null);
  const colleaguesRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 4, width: 0 });

  useEffect(() => {
    const updateIndicator = () => {
      const refs: Record<ConversationTab, React.RefObject<HTMLButtonElement | null>> = {
        all: allRef,
        candidates: candidatesRef,
        colleagues: colleaguesRef,
      };
      
      const button = refs[activeTab]?.current;
      if (button) {
        setIndicatorStyle({
          left: button.offsetLeft,
          width: button.offsetWidth,
        });
      }
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeTab, totalUnreadCount, candidateUnread, colleagueUnread]);

  return (
    <div className="relative flex bg-white/5 backdrop-blur-[2px] rounded-lg p-1 border border-white/10 mb-3 gap-0.5 flex-shrink-0">
      {/* Sliding background */}
      <motion.div
        className="absolute top-1 bottom-1 bg-parium-navy rounded-md"
        initial={false}
        animate={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
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
        ref={allRef}
        type="button"
        onClick={() => onTabChange('all')}
        className="relative z-10 flex-1 py-1.5 px-3 rounded-md text-xs font-medium text-white transition-colors whitespace-nowrap"
      >
        Alla
        {totalUnreadCount > 0 && (
          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-blue-500/30 rounded-full">
            {totalUnreadCount}
          </span>
        )}
      </button>
      <button
        ref={candidatesRef}
        type="button"
        onClick={() => onTabChange('candidates')}
        className="relative z-10 flex-1 py-1.5 px-3 rounded-md text-xs font-medium text-white transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
      >
        <User className="h-3 w-3" />
        Kandidater
        {candidateUnread > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] bg-emerald-500/40 rounded-full">
            {candidateUnread}
          </span>
        )}
      </button>
      <button
        ref={colleaguesRef}
        type="button"
        onClick={() => onTabChange('colleagues')}
        className="relative z-10 flex-1 py-1.5 px-3 rounded-md text-xs font-medium text-white transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
      >
        <Users className="h-3 w-3" />
        Kollegor
        {colleagueUnread > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/40 rounded-full">
            {colleagueUnread}
          </span>
        )}
      </button>
    </div>
  );
}
