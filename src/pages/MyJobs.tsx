import { useAuth } from '@/hooks/useAuth';
import EmployerDashboard from '@/components/EmployerDashboard';
import EmployerSidebar from '@/components/EmployerSidebar';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { useState, useEffect } from 'react';

const MyJobs = () => {
  const { user, profile } = useAuth();
  const [uiReady, setUiReady] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setUiReady(true));
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden smooth-scroll touch-pan relative" style={{ WebkitOverflowScrolling: 'touch' }}>
        <AnimatedBackground />
        {uiReady ? <EmployerSidebar /> : null}
        <div className="flex-1 flex flex-col overflow-x-hidden relative z-10">
          <header className="sticky top-0 z-40 h-16 flex items-center justify-between border-b border-white/20 bg-white/10 backdrop-blur-md px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-white hover:bg-white/20" />
              <div>
                <h1 className="text-xl font-bold text-white">Parium</h1>
                <p className="text-sm text-white/70">
                  Arbetsgivare: {profile?.first_name} {profile?.last_name}
                </p>
              </div>
            </div>
          </header>
          
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">
            <EmployerDashboard />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default MyJobs;
