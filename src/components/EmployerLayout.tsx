import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import EmployerSidebar from '@/components/EmployerSidebar';
import DeveloperControls from '@/components/DeveloperControls';

interface EmployerLayoutProps {
  children: ReactNode;
  developerView: string;
  onViewChange: (view: string) => void;
}

const EmployerLayout = ({ children, developerView, onViewChange }: EmployerLayoutProps) => {
  const { user, profile } = useAuth();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full overflow-x-hidden smooth-scroll touch-pan relative" style={{ WebkitOverflowScrolling: 'touch' }}>
        <EmployerSidebar />
        <div className="flex-1 flex flex-col overflow-x-hidden relative z-10">
          <header className="sticky top-0 z-40 h-16 flex items-center justify-between border-b border-white/20 bg-white/10 px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-white hover:bg-white/20" />
              <div>
                <h1 className="text-xl font-bold text-white">Parium</h1>
                <p className="text-sm text-white">
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
          
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default EmployerLayout;
