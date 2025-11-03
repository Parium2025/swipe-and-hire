import { ReactNode, useState, useEffect, memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import EmployerSidebar from '@/components/EmployerSidebar';
import DeveloperControls from '@/components/DeveloperControls';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import CreateJobSimpleDialog from '@/components/CreateJobSimpleDialog';
import { useJobsData } from '@/hooks/useJobsData';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface EmployerLayoutProps {
  children: ReactNode;
  developerView: string;
  onViewChange: (view: string) => void;
}

const EmployerLayout = memo(({ children, developerView, onViewChange }: EmployerLayoutProps) => {
  const { user, profile } = useAuth();
  const { invalidateJobs } = useJobsData();
  const queryClient = useQueryClient();

  // Prefetch applications on mount for instant /candidates load
  useEffect(() => {
    if (!user) return;

    queryClient.prefetchInfiniteQuery({
      queryKey: ['applications', user.id, ''], // Include empty search query to match hook
      initialPageParam: 0,
      queryFn: async () => {
        const { data, error } = await supabase
          .from('job_applications')
          .select(`
            id,
            job_id,
            applicant_id,
            first_name,
            last_name,
            email,
            phone,
            location,
            bio,
            status,
            applied_at,
            updated_at,
            job_postings!inner(title)
          `)
          .order('applied_at', { ascending: false })
          .range(0, 24);

        if (error) throw error;
        if (!data) return { items: [], hasMore: false };

        // Transform data to match useApplicationsData format
        const items = data.map((item: any) => ({
          ...item,
          job_title: item.job_postings?.title || 'Okänt jobb',
          job_postings: undefined,
        }));
        
        const hasMore = items.length === 25;

        // Write to snapshot
        try {
          const snapshot = {
            items: items.slice(0, 50),
            timestamp: Date.now(),
          };
          localStorage.setItem(`applications_snapshot_${user.id}`, JSON.stringify(snapshot));
        } catch {}

        return { items, hasMore };
      },
    });
  }, [user, queryClient]);

  // Prefetch job templates for instant "Skapa ny annons" dialog load
  useEffect(() => {
    if (!user) return;

    const prefetchTemplates = async () => {
      try {
        const { data } = await supabase
          .from('job_templates')
          .select('*')
          .eq('employer_id', user.id)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false });
        
        // Cache in queryClient for instant access
        if (data) {
          queryClient.setQueryData(['job-templates', user.id], data);
        }
      } catch (error) {
        console.error('Failed to prefetch templates:', error);
      }
    };

    prefetchTemplates();
  }, [user, queryClient]);

  return (
    <SidebarProvider defaultOpen={true}>
      {/* Fixed gradient background - covers viewport */}
      <div className="fixed inset-0 bg-parium-gradient pointer-events-none z-0" />
      
      <div className="min-h-screen flex w-full overflow-x-hidden smooth-scroll touch-pan relative" style={{ WebkitOverflowScrolling: 'touch' }}>
        <AnimatedBackground showBubbles={false} />
        <EmployerSidebar />
        <div className="flex-1 flex flex-col overflow-x-hidden relative z-10">
          <header className="sticky top-0 z-40 h-14 flex items-center justify-between border-b border-white/20 bg-transparent px-3">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-white hover:bg-white/20 h-8 w-8" />
              <div>
                <h1 className="text-lg font-bold text-white">Parium</h1>
                <p className="text-sm text-white">
                  Admin: {profile?.first_name} {profile?.last_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {(user?.email === 'fredrik.andits@icloud.com' || user?.email === 'fredrikandits@hotmail.com' || user?.email === 'pariumab2025@hotmail.com') && (
                <div className="hidden md:block">
                  <DeveloperControls 
                    onViewChange={onViewChange}
                    currentView={developerView}
                  />
                </div>
              )}
              <CreateJobSimpleDialog
                onJobCreated={() => {
                  invalidateJobs();
                }}
              />
            </div>
          </header>
          
          {/* Bubbles positioned below header */}
          <div className="absolute left-0 right-0 top-14 pointer-events-none z-20" style={{ height: 'calc(100vh - 3.5rem)' }}>
            {/* Left-side bubbles (top corner) - more spread out like auth page */}
            <div className="absolute top-12 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-soft-bounce" style={{ animationDuration: '2s', animationDelay: '-0.3s', animationFillMode: 'backwards' }}></div>
            <div className="absolute top-24 left-16 w-2 h-2 bg-accent/40 rounded-full animate-soft-bounce" style={{ animationDuration: '2.5s', animationDelay: '-1.2s', animationFillMode: 'backwards' }}></div>
            <div className="absolute top-16 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-soft-bounce" style={{ animationDuration: '3s', animationDelay: '-0.7s', animationFillMode: 'backwards' }}></div>
            
            {/* Right-side bubbles (bottom corner) */}
            <div className="absolute bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-soft-bounce" style={{ animationDuration: '2.2s', animationDelay: '-0.8s', animationFillMode: 'backwards' }}></div>
            <div className="absolute bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-soft-bounce" style={{ animationDuration: '2.8s', animationDelay: '-1.5s', animationFillMode: 'backwards' }}></div>
            <div className="absolute bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-soft-bounce" style={{ animationDuration: '2.3s', animationDelay: '-0.5s', animationFillMode: 'backwards' }}></div>
            
            {/* Pulsing lights (left) - moved higher up for more spacing */}
            <div className="absolute top-4 left-8 w-3 h-3 bg-accent/40 rounded-full animate-pulse" style={{ animationDuration: '1.8s', animationDelay: '-0.6s', animationFillMode: 'backwards' }}></div>
            
            {/* Pulsing lights (right) */}
            <div className="absolute top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse" style={{ animationDuration: '1.5s', animationDelay: '-0.4s', animationFillMode: 'backwards' }}></div>
            <div className="absolute top-16 right-20 w-2 h-2 bg-accent/30 rounded-full animate-pulse" style={{ animationDuration: '2s', animationDelay: '-1.0s', animationFillMode: 'backwards' }}></div>
            
            {/* Small star (left area) */}
            <div className="absolute top-32 left-1/4 w-1 h-1 bg-accent/60 rounded-full animate-pulse" style={{ animationDuration: '3s', animationDelay: '-0.9s', animationFillMode: 'backwards' }}>
              <div className="absolute inset-0 bg-accent/40 rounded-full animate-ping" style={{ animationDuration: '3s', animationDelay: '-0.9s', animationFillMode: 'backwards' }}></div>
            </div>
            
            {/* Small star (right area) */}
            <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-secondary/60 rounded-full animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '-1.3s', animationFillMode: 'backwards' }}>
              <div className="absolute inset-0 bg-secondary/40 rounded-full animate-ping" style={{ animationDuration: '2.5s', animationDelay: '-1.3s', animationFillMode: 'backwards' }}></div>
            </div>
          </div>
          
          <main className="flex-1 overflow-hidden p-3">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
});

EmployerLayout.displayName = 'EmployerLayout';

export default EmployerLayout;
