import { ReactNode, useState, useEffect, memo, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import EmployerSidebar from '@/components/EmployerSidebar';
import EmployerTopNav from '@/components/EmployerTopNav';
import DeveloperControls from '@/components/DeveloperControls';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import CreateJobSimpleDialog from '@/components/CreateJobSimpleDialog';
import { useJobsData } from '@/hooks/useJobsData';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { KanbanLayoutProvider, useKanbanLayout } from '@/hooks/useKanbanLayout';
import { useDevice } from '@/hooks/use-device';
import { useEmployerDocumentTitle } from '@/hooks/useDocumentTitle';
import { useCandidateBackgroundSync } from '@/hooks/useCandidateBackgroundSync';
import { useEagerRatingsPreload } from '@/hooks/useEagerRatingsPreload';
import { useEmployerBackgroundSync } from '@/hooks/useEmployerBackgroundSync';
import { DevOfflineToggle } from '@/components/DevOfflineToggle';

interface EmployerLayoutProps {
  children: ReactNode;
  developerView: string;
  onViewChange: (view: string) => void;
}

// Inner component that uses the KanbanLayout context
const EmployerLayoutInner = memo(({ children, developerView, onViewChange }: EmployerLayoutProps) => {
  const { user, profile } = useAuth();
  const { invalidateJobs } = useJobsData();
  const queryClient = useQueryClient();
  const createJobButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const { shouldCollapseSidebar, stageCount } = useKanbanLayout();
  const device = useDevice();
  
  // Desktop uses top nav, mobile/tablet uses sidebar
  const isDesktop = device === 'desktop';
  
  // 🔥 Background sync för att hålla all arbetsgivardata färsk
  useEmployerBackgroundSync();
  
  // Auto-collapse sidebar on pages that need more horizontal space (Kanban views)
  const isKanbanPage = location.pathname.startsWith('/job-details/') || location.pathname === '/my-candidates';
  
  // Sidebar state: collapse based on stage count when on Kanban pages
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (!isKanbanPage) return true;
    return !shouldCollapseSidebar;
  });
  
  // Update sidebar state when route changes or stage count changes
  useEffect(() => {
    if (isKanbanPage) {
      setSidebarOpen(!shouldCollapseSidebar);
    } else {
      setSidebarOpen(true);
    }
  }, [isKanbanPage, shouldCollapseSidebar]);
  
  // Track user activity for "last seen" feature
  useActivityTracker();
  
  // Update browser tab title with unread message count
  useEmployerDocumentTitle();
  
  // EAGER: Förladda ratings vid FÖRSTA aktivitet (tab-focus, musrörelse)
  // Detta körs INNAN useCandidateBackgroundSync så ratings är redo direkt
  useEagerRatingsPreload();
  
  // Kontinuerlig bakgrundssynk av kandidatdata (30s intervall)
  // Gör att /candidates och /my-candidates alltid har färsk data utan laddningstid
  useCandidateBackgroundSync();

  // Keyboard shortcut: Cmd+N / Ctrl+N to open "Create New Job" dialog
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check for Cmd+N (Mac) or Ctrl+N (Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      // Trigger click on the create job button
      createJobButtonRef.current?.click();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Prefetch applications + kandidat-media på mount för instant /candidates (utan refresh)
  useEffect(() => {
    if (!user) return;

    const userId = user.id;
    const queryKey = ['applications', userId, ''] as const;

    // Om vi har gammal cache utan media-fält → rensa så vi inte fastnar med "initialer" tills refresh
    const existing: any = queryClient.getQueryData(queryKey);
    const first = existing?.pages?.[0]?.items?.[0];
    const hasMediaFields =
      !first ||
      ('profile_image_url' in first && 'video_url' in first && 'is_profile_video' in first);

    if (!hasMediaFields) {
      queryClient.removeQueries({ queryKey });
    }

    queryClient.prefetchInfiniteQuery({
      queryKey,
      initialPageParam: 0,
      queryFn: async ({ pageParam = 0 }) => {
        const from = (pageParam as number) * 25;
        const to = from + 25 - 1;

        const { data: baseData, error: baseError } = await supabase
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
            cv_url,
            age,
            employment_status,
            work_schedule,
            availability,
            custom_answers,
            status,
            applied_at,
            updated_at,
            job_postings!inner(title)
          `)
          .order('applied_at', { ascending: false })
          .range(from, to);

        if (baseError) throw baseError;
        if (!baseData) return { items: [], hasMore: false };

        // Hämta kandidat-media via säkert BATCH RPC (skalar till miljoner)
        const applicantIds = [...new Set(baseData.map((item: any) => item.applicant_id))];
        const profileMediaMap: Record<
          string,
          { profile_image_url: string | null; video_url: string | null; is_profile_video: boolean | null }
        > = {};

        // Single batch RPC call instead of N individual calls
        const { data: batchMediaData } = await supabase.rpc('get_applicant_profile_media_batch', {
          p_applicant_ids: applicantIds,
          p_employer_id: userId,
        });

        if (batchMediaData && Array.isArray(batchMediaData)) {
          batchMediaData.forEach((row: any) => {
            profileMediaMap[row.applicant_id] = {
              profile_image_url: row.profile_image_url,
              video_url: row.video_url,
              is_profile_video: row.is_profile_video,
            };
          });
        }

        // Fill in nulls for any applicants not returned
        applicantIds.forEach((id) => {
          if (!profileMediaMap[id]) {
            profileMediaMap[id] = {
              profile_image_url: null,
              video_url: null,
              is_profile_video: null,
            };
          }
        });

        const items = baseData.map((item: any) => {
          const media = profileMediaMap[item.applicant_id] || {
            profile_image_url: null,
            video_url: null,
            is_profile_video: null,
          };

          return {
            ...item,
            job_title: item.job_postings?.title || 'Okänt jobb',
            profile_image_url: media.profile_image_url,
            video_url: media.video_url,
            is_profile_video: media.is_profile_video,
            job_postings: undefined,
          };
        });

        const hasMore = items.length === 25;

        // Snapshot för omedelbar first paint (matchar useApplicationsData schema)
        if (from === 0) {
          try {
            const snapshot = {
              items: items.slice(0, 50),
              timestamp: Date.now(),
            };
            localStorage.setItem(`applications_snapshot_${userId}`, JSON.stringify(snapshot));
          } catch (cacheError) {
            console.warn('Failed to cache applications snapshot:', cacheError);
          }
        }

        // Prime:a cache i bakgrunden (bild + video-signed URL) så det känns "bam"
        setTimeout(() => {
          const imagePaths = (items as any[])
            .map((i) => i.profile_image_url)
            .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
            .slice(0, 25);

          const videoPaths = (items as any[])
            .filter((i) => !!i.is_profile_video)
            .map((i) => i.video_url)
            .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
            .slice(0, 10);

          if (imagePaths.length === 0 && videoPaths.length === 0) return;

          Promise.all([
            ...imagePaths.map((p) => prefetchMediaUrl(p, 'profile-image').catch(() => {})),
            ...videoPaths.map((p) => prefetchMediaUrl(p, 'profile-video').catch(() => {})),
          ]).catch(() => {});
        }, 0);

        return { items, hasMore };
      },
      staleTime: Infinity,
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

  // Prefetch company profile for instant /reviews load
  useEffect(() => {
    if (!user) return;

    queryClient.prefetchQuery({
      queryKey: ['company-profile', user.id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        return data;
      },
    });
  }, [user, queryClient]);

  // Prefetch company reviews for instant /reviews load
  useEffect(() => {
    if (!user) return;

    queryClient.prefetchQuery({
      queryKey: ['company-reviews', user.id],
      queryFn: async () => {
        // Fetch reviews first
        const { data: reviews, error } = await supabase
          .from('company_reviews')
          .select('*')
          .eq('company_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!reviews || reviews.length === 0) return [];

        // Fetch profiles for non-anonymous reviews
        const userIds = reviews
          .filter(r => !r.is_anonymous)
          .map(r => r.user_id);

        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name')
            .in('user_id', userIds);

          if (profiles) {
            const profileMap = new Map(profiles.map(p => [p.user_id, p]));
            return reviews.map(r => ({
              ...r,
              profiles: profileMap.get(r.user_id) || undefined,
            }));
          }
        }

        return reviews;
      },
    });
  }, [user, queryClient]);

  // Prefetch conversations for instant /messages load
  useEffect(() => {
    if (!user) return;

    queryClient.prefetchQuery({
      queryKey: ['conversations', user.id],
      queryFn: async () => {
        // Get all conversation IDs where user is a member
        const { data: memberships, error: memberError } = await supabase
          .from('conversation_members')
          .select('conversation_id, last_read_at')
          .eq('user_id', user.id);

        if (memberError) throw memberError;
        if (!memberships || memberships.length === 0) return [];

        const conversationIds = memberships.map(m => m.conversation_id);
        const lastReadMap = new Map(memberships.map(m => [m.conversation_id, m.last_read_at]));

        // Fetch conversations with job info
        const { data: conversations, error: convError } = await supabase
          .from('conversations')
          .select(`
            *,
            job:job_id (title)
          `)
          .in('id', conversationIds)
          .order('last_message_at', { ascending: false, nullsFirst: false });

        if (convError) throw convError;
        if (!conversations) return [];

        // Fetch all members for these conversations
        const { data: allMembers, error: membersError } = await supabase
          .from('conversation_members')
          .select('conversation_id, user_id, is_admin, last_read_at')
          .in('conversation_id', conversationIds);

        if (membersError) throw membersError;

        // Get unique user IDs to fetch profiles
        const allUserIds = [...new Set(allMembers?.map(m => m.user_id) || [])];
        
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, company_name, profile_image_url, company_logo_url, role')
          .in('user_id', allUserIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        // Fetch ALL messages for these conversations in ONE query
        const { data: allMessages } = await supabase
          .from('conversation_messages')
          .select('*')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false });

        // Group last messages by conversation and calculate unread counts in memory
        const lastMessageMap = new Map<string, any>();
        const unreadCounts = new Map<string, number>();
        
        // Initialize unread counts
        conversationIds.forEach(id => unreadCounts.set(id, 0));
        
        // Process all messages in memory (much faster than N database calls)
        allMessages?.forEach(msg => {
          // Track last message per conversation
          if (!lastMessageMap.has(msg.conversation_id)) {
            lastMessageMap.set(msg.conversation_id, {
              ...msg,
              sender_profile: profileMap.get(msg.sender_id) || undefined,
            });
          }
          
          // Count unread messages (not from current user, after last_read)
          if (msg.sender_id !== user.id) {
            const lastRead = lastReadMap.get(msg.conversation_id);
            if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
              unreadCounts.set(
                msg.conversation_id, 
                (unreadCounts.get(msg.conversation_id) || 0) + 1
              );
            }
          }
        });

        // Build final conversation objects
        return conversations.map(conv => {
          const members = (allMembers || [])
            .filter(m => m.conversation_id === conv.id)
            .map(m => ({
              ...m,
              profile: profileMap.get(m.user_id),
            }));

          return {
            ...conv,
            members,
            last_message: lastMessageMap.get(conv.id),
            unread_count: unreadCounts.get(conv.id) || 0,
          };
        });
      },
    });
  }, [user, queryClient]);

  // Desktop layout with top navigation
  if (isDesktop) {
    return (
      <>
        {/* Fixed gradient background */}
        <div className="fixed inset-0 bg-parium-gradient pointer-events-none z-0" />
        
         <div className="h-screen flex flex-col w-full overflow-hidden relative">
          <AnimatedBackground showBubbles={false} />
          
          {/* Top Navigation for Desktop */}
          <header className="sticky top-0 z-40">
            <EmployerTopNav />
            {/* Developer controls and Create Job button */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
              {(user?.email === 'fredrik.andits@icloud.com' || user?.email === 'fredrikandits@hotmail.com' || user?.email === 'pariumab2025@hotmail.com') && (
                <DeveloperControls 
                  onViewChange={onViewChange}
                  currentView={developerView}
                />
              )}
              <CreateJobSimpleDialog
                onJobCreated={() => {
                  invalidateJobs();
                }}
                triggerRef={createJobButtonRef}
              />
            </div>
          </header>
          
          {/* Bubbles - positioned below header */}
          <div className="fixed left-0 right-0 top-14 pointer-events-none z-20" style={{ height: 'calc(100vh - 3.5rem)', willChange: 'transform' }}>
            <div className="absolute top-12 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-soft-bounce" style={{ animationDuration: '2s', animationDelay: '-0.3s' }}></div>
            <div className="absolute top-24 left-16 w-2 h-2 bg-accent/40 rounded-full animate-soft-bounce" style={{ animationDuration: '2.5s', animationDelay: '-1.2s' }}></div>
            <div className="absolute top-16 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-soft-bounce" style={{ animationDuration: '3s', animationDelay: '-0.7s' }}></div>
            <div className="absolute bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-soft-bounce" style={{ animationDuration: '2.2s', animationDelay: '-0.8s' }}></div>
            <div className="absolute bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-soft-bounce" style={{ animationDuration: '2.8s', animationDelay: '-1.5s' }}></div>
            <div className="absolute bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-soft-bounce" style={{ animationDuration: '2.3s', animationDelay: '-0.5s' }}></div>
            <div className="absolute top-4 left-8 w-3 h-3 bg-accent/40 rounded-full animate-pulse" style={{ animationDuration: '1.8s', animationDelay: '-0.6s', willChange: 'opacity' }}></div>
            <div className="absolute top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse" style={{ animationDuration: '1.5s', animationDelay: '-0.4s', willChange: 'opacity' }}></div>
            <div className="absolute top-16 right-20 w-2 h-2 bg-accent/30 rounded-full animate-pulse" style={{ animationDuration: '2s', animationDelay: '-1.0s', willChange: 'opacity' }}></div>
          </div>
          
           <main className="flex-1 min-h-0 overflow-y-auto p-3 relative z-10" style={{ willChange: 'scroll-position', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {children}
          </main>
          
          {/* Floating dev offline toggle */}
          <DevOfflineToggle />
        </div>
      </>
    );
  }

  // Mobile/Tablet layout with sidebar
  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
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
              <CreateJobSimpleDialog
                onJobCreated={() => {
                  invalidateJobs();
                }}
                triggerRef={createJobButtonRef}
              />
            </div>
          </header>
          
          {/* Bubbles positioned below header */}
          <div className="absolute left-0 right-0 top-14 pointer-events-none z-20" style={{ height: 'calc(100vh - 3.5rem)', willChange: 'transform' }}>
            <div className="absolute top-12 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-soft-bounce" style={{ animationDuration: '2s', animationDelay: '-0.3s', animationFillMode: 'backwards' }}></div>
            <div className="absolute top-24 left-16 w-2 h-2 bg-accent/40 rounded-full animate-soft-bounce" style={{ animationDuration: '2.5s', animationDelay: '-1.2s', animationFillMode: 'backwards' }}></div>
            <div className="absolute top-16 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-soft-bounce" style={{ animationDuration: '3s', animationDelay: '-0.7s', animationFillMode: 'backwards' }}></div>
            <div className="absolute bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-soft-bounce" style={{ animationDuration: '2.2s', animationDelay: '-0.8s', animationFillMode: 'backwards' }}></div>
            <div className="absolute bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-soft-bounce" style={{ animationDuration: '2.8s', animationDelay: '-1.5s', animationFillMode: 'backwards' }}></div>
            <div className="absolute bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-soft-bounce" style={{ animationDuration: '2.3s', animationDelay: '-0.5s', animationFillMode: 'backwards' }}></div>
            <div className="absolute top-4 left-8 w-3 h-3 bg-accent/40 rounded-full animate-pulse" style={{ animationDuration: '1.8s', animationDelay: '-0.6s', animationFillMode: 'backwards', willChange: 'opacity' }}></div>
            <div className="absolute top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse" style={{ animationDuration: '1.5s', animationDelay: '-0.4s', animationFillMode: 'backwards', willChange: 'opacity' }}></div>
            <div className="absolute top-16 right-20 w-2 h-2 bg-accent/30 rounded-full animate-pulse" style={{ animationDuration: '2s', animationDelay: '-1.0s', animationFillMode: 'backwards', willChange: 'opacity' }}></div>
            <div className="absolute top-32 left-1/4 w-1 h-1 bg-accent/60 rounded-full animate-pulse" style={{ animationDuration: '3s', animationDelay: '-0.9s', animationFillMode: 'backwards', willChange: 'opacity' }}></div>
            <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-secondary/60 rounded-full animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '-1.3s', animationFillMode: 'backwards', willChange: 'opacity' }}></div>
          </div>
          
          <main className="flex-1 overflow-hidden p-3">
            {children}
          </main>
          
          {/* Floating dev offline toggle */}
          <DevOfflineToggle />
        </div>
      </div>
    </SidebarProvider>
  );
});

EmployerLayoutInner.displayName = 'EmployerLayoutInner';

// Wrapper component that provides the KanbanLayout context
const EmployerLayout = memo(({ children, developerView, onViewChange }: EmployerLayoutProps) => {
  return (
    <KanbanLayoutProvider>
      <EmployerLayoutInner developerView={developerView} onViewChange={onViewChange}>
        {children}
      </EmployerLayoutInner>
    </KanbanLayoutProvider>
  );
});

EmployerLayout.displayName = 'EmployerLayout';

export default EmployerLayout;
