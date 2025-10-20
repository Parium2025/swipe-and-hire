import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import EmployerSidebar from '@/components/EmployerSidebar';
import DeveloperControls from '@/components/DeveloperControls';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { useIsMobile } from '@/hooks/use-mobile';

interface EmployerLayoutProps {
  children: ReactNode;
  developerView: string;
  onViewChange: (view: string) => void;
}

const EmployerLayout = ({ children, developerView, onViewChange }: EmployerLayoutProps) => {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-screen flex w-full overflow-x-hidden smooth-scroll touch-pan relative bg-parium-gradient touch-manipulation" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'manipulation' }}>
        <AnimatedBackground showBubbles={true} />
        <EmployerSidebar />
        <div className="flex-1 flex flex-col overflow-x-hidden relative z-10">
          <header className="sticky top-0 z-40 h-12 sm:h-14 flex items-center justify-between border-b border-white/20 bg-white/10 backdrop-blur-sm px-3">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-white hover:bg-white/20 h-9 w-9 sm:h-8 sm:w-8" />
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white">Parium</h1>
                <p className="text-[10px] sm:text-xs text-white">
                  Admin: {profile?.first_name} {profile?.last_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {(user?.email === 'fredrik.andits@icloud.com' || user?.email === 'fredrikandits@hotmail.com' || user?.email === 'pariumab2025@hotmail.com') && (
                <DeveloperControls 
                  onViewChange={onViewChange}
                  currentView={developerView}
                />
              )}
            </div>
          </header>
          
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-3 touch-manipulation" style={{ WebkitOverflowScrolling: 'touch' }}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default EmployerLayout;
