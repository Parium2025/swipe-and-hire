import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import EmployerSidebar from '@/components/EmployerSidebar';
import DeveloperControls from '@/components/DeveloperControls';
import { AnimatedBackground } from '@/components/AnimatedBackground';

interface EmployerLayoutProps {
  children: ReactNode;
  developerView: string;
  onViewChange: (view: string) => void;
}

const EmployerLayout = ({ children, developerView, onViewChange }: EmployerLayoutProps) => {
  const { user, profile } = useAuth();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full overflow-x-hidden smooth-scroll touch-pan relative bg-parium-gradient" style={{ WebkitOverflowScrolling: 'touch' }}>
        <AnimatedBackground showBubbles={false} />
        <EmployerSidebar />
        <div className="flex-1 flex flex-col overflow-x-hidden relative z-10">
          <header className="sticky top-0 z-40 h-14 flex items-center justify-between border-b border-white/20 bg-white/10 px-3">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-white hover:bg-white/20 h-8 w-8" />
              <div>
                <h1 className="text-lg font-bold text-white">Parium</h1>
                <p className="text-xs text-white">
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
          
          {/* Bubbles positioned below header */}
          <div className="absolute left-0 right-0 top-14 pointer-events-none z-20" style={{ height: 'calc(100vh - 3.5rem)' }}>
            {/* Left-side bubbles (top corner) */}
            <div className="absolute top-6 left-6 w-4 h-4 bg-secondary/30 rounded-full animate-soft-bounce" style={{ animationDuration: '2s', animationDelay: '-0.3s', animationFillMode: 'backwards' }}></div>
            <div className="absolute top-16 left-10 w-2 h-2 bg-accent/40 rounded-full animate-soft-bounce" style={{ animationDuration: '2.5s', animationDelay: '-1.2s', animationFillMode: 'backwards' }}></div>
            <div className="absolute top-10 left-14 w-3 h-3 bg-secondary/20 rounded-full animate-soft-bounce" style={{ animationDuration: '3s', animationDelay: '-0.7s', animationFillMode: 'backwards' }}></div>
            
            {/* Pulsing light (left) */}
            <div className="absolute top-4 left-4 w-3 h-3 bg-accent/40 rounded-full animate-pulse" style={{ animationDuration: '1.8s', animationDelay: '-0.6s', animationFillMode: 'backwards' }}></div>
            
            {/* Small star (left area) */}
            <div className="absolute top-20 left-1/4 w-1 h-1 bg-accent/60 rounded-full animate-pulse" style={{ animationDuration: '3s', animationDelay: '-0.9s', animationFillMode: 'backwards' }}>
              <div className="absolute inset-0 bg-accent/40 rounded-full animate-ping" style={{ animationDuration: '3s', animationDelay: '-0.9s', animationFillMode: 'backwards' }}></div>
            </div>
          </div>
          
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default EmployerLayout;
