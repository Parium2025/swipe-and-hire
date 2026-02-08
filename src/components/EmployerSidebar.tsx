import React, { useEffect, useState, memo } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
import { 
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar
} from "@/components/ui/sidebar";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { Button } from "@/components/ui/button";
import { 
  Building, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  Briefcase,
  MessageCircle,
  CreditCard,
  HelpCircle,
  FileText,
  Star,
  UserCircle,
  UserCheck
} from "lucide-react";


// Navigation items for employer sidebar
const employerNavItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: BarChart3,
    group: "huvudmeny"
  },
  {
    title: "Mina Annonser", 
    url: "/my-jobs",
    icon: Briefcase,
    group: "huvudmeny"
  },
  {
    title: "Kandidater",
    url: "/candidates", 
    icon: Users,
    group: "huvudmeny"
  },
  {
    title: "Mina Kandidater",
    url: "/my-candidates", 
    icon: UserCheck,
    group: "huvudmeny"
  },
  {
    title: "Meddelanden",
    url: "/messages",
    icon: MessageCircle,
    group: "huvudmeny"
  }
];

const businessNavItems = [
  {
    title: "Företagsprofil",
    url: "/company-profile",
    icon: Building,
    group: "företag"
  },
  {
    title: "Recensioner",
    url: "/reviews",
    icon: Star,
    group: "företag"
  },
  {
    title: "Fakturering",
    url: "/billing",
    icon: CreditCard, 
    group: "företag"
  },
  {
    title: "Rapporter",
    url: "/reports",
    icon: FileText,
    group: "företag"
  }
];

const supportNavItems = [
  {
    title: "Min Profil",
    url: "/profile", 
    icon: UserCircle,
    group: "support"
  },
  {
    title: "Inställningar",
    url: "/settings", 
    icon: Settings,
    group: "support"
  },
  {
    title: "Hjälp & Support",
    url: "/support",
    icon: HelpCircle,
    group: "support"
  }
];

const LOGO_CACHE_KEY = 'parium_company_logo_url';

export function EmployerSidebar() {
  const { state, setOpenMobile, isMobile, setOpen } = useSidebar();
  const collapsed = state === 'collapsed';
  const { profile, signOut, user, preloadedCompanyLogoUrl, preloadedEmployerCandidates, preloadedUnreadMessages, preloadedEmployerMyJobs, preloadedEmployerDashboardJobs, preloadedEmployerTotalViews, preloadedEmployerTotalApplications, preloadedMyCandidates } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { checkBeforeNavigation } = useUnsavedChanges();
  const queryClient = useQueryClient();
  
  // Track where user came from when viewing job details
  const [jobDetailsSource, setJobDetailsSource] = useState<string | null>(null);
  
  // Detect source when navigating to job-details
  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = sessionStorage.getItem('previousPath');
    
    if (currentPath.startsWith('/job-details/')) {
      // If coming from my-jobs or dashboard, remember the source
      if (previousPath === '/my-jobs' || previousPath?.startsWith('/my-jobs')) {
        setJobDetailsSource('/my-jobs');
        sessionStorage.setItem('jobDetailsSource', '/my-jobs');
      } else if (previousPath === '/dashboard' || previousPath?.startsWith('/dashboard')) {
        setJobDetailsSource('/dashboard');
        sessionStorage.setItem('jobDetailsSource', '/dashboard');
      } else {
        // Check stored source
        const storedSource = sessionStorage.getItem('jobDetailsSource');
        if (storedSource) {
          setJobDetailsSource(storedSource);
        }
      }
    } else {
      // Clear source when leaving job-details
      if (!currentPath.startsWith('/job-details/')) {
        sessionStorage.removeItem('jobDetailsSource');
        setJobDetailsSource(null);
      }
    }
    
    // Store current path as previous for next navigation
    sessionStorage.setItem('previousPath', currentPath);
  }, [location.pathname]);
  
  // Konvertera storage-path till publik URL för company logos
  const getPublicLogoUrl = (url: string | null | undefined): string | null => {
    if (!url || typeof url !== 'string' || url.trim() === '') return null;
    
    // Om redan publik URL (company logos lagras som publika URLs i profiles-tabellen)
    if (url.includes('/storage/v1/object/public/')) {
      return url.split('?')[0]; // Ta bort query params
    }
    
    // Returnera som är - company logos är redan publika URLs
    return url;
  };

  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(() => {
    // Prioritera preloaded URL från AuthProvider
    if (preloadedCompanyLogoUrl) return preloadedCompanyLogoUrl;
    
    const fromProfile = (profile as any)?.company_logo_url as string | undefined;
    // Only use cache if profile hasn't explicitly set logo to empty
    if (fromProfile === '' || fromProfile === null) {
      // Profile explicitly has no logo - don't use cache
      try { sessionStorage.removeItem(LOGO_CACHE_KEY); } catch {}
      return null;
    }
    const cached = typeof window !== 'undefined' ? sessionStorage.getItem(LOGO_CACHE_KEY) : null;
    const raw = (typeof fromProfile === 'string' && fromProfile.trim() !== '') ? fromProfile : cached;
    return getPublicLogoUrl(raw);
  });
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Helper function to get company initials
  const getCompanyInitials = () => {
    if (!profile?.company_name) return 'FA';
    return profile.company_name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Keep last known logo; don't reset state unless value actually changes
  useEffect(() => {
    // Prioritera preloaded URL från AuthProvider
    if (preloadedCompanyLogoUrl && preloadedCompanyLogoUrl !== companyLogoUrl) {
      setCompanyLogoUrl(preloadedCompanyLogoUrl);
      return;
    }
    
    const raw = (profile as any)?.company_logo_url;
    if (typeof raw === 'string' && raw.trim() !== '') {
      try {
        const publicUrl = getPublicLogoUrl(raw);
        setCompanyLogoUrl((prev) => {
          if (prev === publicUrl) return prev; // no change → avoid flicker
          setLogoLoaded(false);
          setLogoError(false);
          if (publicUrl) {
            try { sessionStorage.setItem(LOGO_CACHE_KEY, publicUrl); } catch {}
          }
          return publicUrl;
        });
      } catch (error) {
        console.error('Failed to parse company logo:', error);
      }
    } else if (raw === '' || raw === null) {
      setCompanyLogoUrl(null);
      setLogoLoaded(false);
      setLogoError(false);
      try { sessionStorage.removeItem(LOGO_CACHE_KEY); } catch {}
    }
    // if undefined, keep previous URL while profile is re-fetching
  }, [(profile as any)?.company_logo_url, preloadedCompanyLogoUrl]);

  // Listen for unsaved changes cancel event to close sidebar
  useEffect(() => {
    const handleUnsavedCancel = () => {
      console.log('Unsaved cancel event received - closing sidebar');
      // Endast stäng sidebaren på mobil/tablet (skärmar under 768px)
      if (isMobile || window.innerWidth < 768) {
        if (isMobile) {
          setOpenMobile(false);
        } else {
          setOpen(false);
        }
      }
      // På desktop (768px+) låt sidebaren vara öppen
    };

    window.addEventListener('unsaved-cancel', handleUnsavedCancel);
    return () => window.removeEventListener('unsaved-cancel', handleUnsavedCancel);
  }, [isMobile, setOpenMobile, setOpen]);

  const handleNavigation = (href: string) => {
    if (checkBeforeNavigation(href)) {
      navigate(href);
      // Scrolla till toppen på mobil
      if (isMobile || window.innerWidth < 768) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      // Stäng endast mobilsidebaren efter navigation
      if (isMobile) {
        setOpenMobile(false);
      }
      // På desktop behåller vi sidebarens nuvarande tillstånd
    }
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const isActiveUrl = (url: string) => {
    const currentPath = location.pathname;
    
    // Exact match
    if (currentPath === url || (url === "/" && currentPath === "/")) {
      return true;
    }
    
    // When on job-details page, highlight the source nav item
    if (currentPath.startsWith('/job-details/')) {
      const source = jobDetailsSource || sessionStorage.getItem('jobDetailsSource');
      if (url === '/my-jobs' && source === '/my-jobs') {
        return true;
      }
      if (url === '/dashboard' && source === '/dashboard') {
        return true;
      }
    }
    
    return false;
  };

  // Prefetch applications data on hover/focus for instant navigation
  // IMPORTANT: Use the same secure RPC-based media flow as /candidates.
  // Do NOT join profiles() from job_applications (no FK) - it causes PGRST200.
  const prefetchApplications = () => {
    if (!user) return;

    queryClient.prefetchInfiniteQuery({
      queryKey: ['applications', user.id, ''],
      initialPageParam: 0,
      queryFn: async ({ pageParam = 0 }) => {
        // Prefetch only first page (same page size as candidates)
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

        // Single batch RPC call instead of N individual calls (scales to millions)
        const applicantIds = [...new Set(baseData.map((item: any) => item.applicant_id))];
        const profileMediaMap: Record<
          string,
          { profile_image_url: string | null; video_url: string | null; is_profile_video: boolean | null }
        > = {};

        const { data: batchMediaData } = await supabase.rpc('get_applicant_profile_media_batch', {
          p_applicant_ids: applicantIds,
          p_employer_id: user.id,
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

        // Prefetch avatars i bakgrunden så /candidates känns "bam" direkt
        setTimeout(() => {
          const paths = (items as any[])
            .map((i) => i.profile_image_url)
            .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
            .slice(0, 25);
          if (paths.length === 0) return;
          Promise.all(paths.map((p) => prefetchMediaUrl(p, 'profile-image').catch(() => {}))).catch(() => {});
        }, 0);

        return { items, hasMore: items.length === 25 };
      },
      staleTime: Infinity,
    });
  };

  return (
    <Sidebar 
      className={`border-r-0 bg-transparent ${collapsed ? 'w-16' : 'w-64'}`}
      collapsible="icon"
    >
      <SidebarContent className="gap-0">
        {/* User Profile Section - show avatar only when collapsed, full info when expanded */}
        <div className="p-4">
          {collapsed ? (
            /* Collapsed: Only show avatar centered */
            <div className="flex justify-center">
              <CompanyAvatar
                companyLogoUrl={companyLogoUrl}
                companyName={profile?.company_name || `${profile?.first_name} ${profile?.last_name}`}
                initials={getCompanyInitials()}
              />
            </div>
          ) : (
            /* Expanded: Show full profile info */
            <div className="flex items-center gap-3">
              <CompanyAvatar
                companyLogoUrl={companyLogoUrl}
                companyName={profile?.company_name || `${profile?.first_name} ${profile?.last_name}`}
                initials={getCompanyInitials()}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-sm truncate">
                  {profile?.company_name || `${profile?.first_name} ${profile?.last_name}`}
                </p>
                <p className="text-sm text-white truncate">
                  {profile?.industry || 'Admin'}
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Hidden preloader - always mounted to keep logo cached */}
        <div className="hidden">
          <CompanyAvatar
            companyLogoUrl={companyLogoUrl}
            companyName={profile?.company_name || `${profile?.first_name} ${profile?.last_name}`}
            initials={getCompanyInitials()}
          />
          {companyLogoUrl && (
            <img 
              src={companyLogoUrl} 
              alt="Preload" 
              loading="eager"
              decoding="sync"
              fetchPriority="high"
            />
          )}
        </div>

        <SidebarSeparator className="bg-white/20 mx-4" />

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-white text-sm uppercase tracking-wide px-4">
            Huvudmeny
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {employerNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className={`
                      mx-2 rounded-lg transition-all duration-200 active:!bg-transparent
                      ${isActiveUrl(item.url) 
                        ? 'bg-white/20 text-white [&_svg]:text-white' 
                        : 'text-white md:hover:bg-white/10 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white'
                      }
                    `}
                  >
                    <button
                      onClick={(e) => { handleNavigation(item.url); (e.currentTarget as HTMLButtonElement).blur(); }}
                      onMouseEnter={item.url === '/candidates' ? prefetchApplications : undefined}
                      onFocus={item.url === '/candidates' ? prefetchApplications : undefined}
                      className="flex items-center gap-3 w-full outline-none focus:outline-none"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && (
                        <span className="font-medium flex-1 text-left">
                          {item.title}
                          {item.url === '/dashboard' && preloadedEmployerDashboardJobs > 0 && (
                            <span className="text-white font-normal ml-1">({preloadedEmployerDashboardJobs})</span>
                          )}
                          {item.url === '/my-jobs' && preloadedEmployerMyJobs > 0 && (
                            <span className="text-white font-normal ml-1">({preloadedEmployerMyJobs})</span>
                          )}
                          {item.url === '/candidates' && preloadedEmployerCandidates > 0 && (
                            <span className="text-white font-normal ml-1">({preloadedEmployerCandidates})</span>
                          )}
                          {item.url === '/my-candidates' && preloadedMyCandidates > 0 && (
                            <span className="text-white font-normal ml-1">({preloadedMyCandidates})</span>
                          )}
                        </span>
                      )}
                      {item.url === '/messages' && preloadedUnreadMessages > 0 && !collapsed && (
                        <span className="bg-destructive text-destructive-foreground text-xs font-medium px-2 py-0.5 rounded-full min-w-[20px] text-center">
                          {preloadedUnreadMessages}
                        </span>
                      )}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-white/20 mx-4" />

        {/* Business Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-white text-sm uppercase tracking-wide px-4">
            Företag
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {businessNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className={`
                      mx-2 rounded-lg transition-all duration-200 active:!bg-transparent
                      ${isActiveUrl(item.url) 
                        ? 'bg-white/20 text-white [&_svg]:text-white' 
                        : 'text-white md:hover:bg-white/10 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white'
                      }
                    `}
                  >
                    <button
                      onClick={(e) => { handleNavigation(item.url); (e.currentTarget as HTMLButtonElement).blur(); }}
                      className="flex items-center gap-3 w-full outline-none focus:outline-none"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span className="font-medium">{item.title}</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-white/20 mx-4" />

        {/* Support Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-white text-sm uppercase tracking-wide px-4">
            Support
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {supportNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className={`
                      mx-2 rounded-lg transition-all duration-200 active:!bg-transparent
                      ${isActiveUrl(item.url) 
                        ? 'bg-white/20 text-white [&_svg]:text-white' 
                        : 'text-white md:hover:bg-white/10 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white'
                      }
                    `}
                  >
                    <button
                      onClick={(e) => { handleNavigation(item.url); (e.currentTarget as HTMLButtonElement).blur(); }}
                      className="flex items-center gap-3 w-full outline-none focus:outline-none"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span className="font-medium">{item.title}</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-white/20 mx-4" />

        {/* Admin Panel - Only for specific user */}
        {user?.email === 'fredrikandits@hotmail.com' && (
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild 
                      className={`
                        mx-2 rounded-lg transition-all duration-200 active:!bg-transparent
                        ${isActiveUrl('/admin') 
                          ? 'bg-white/20 text-white [&_svg]:text-white' 
                          : 'text-white md:hover:bg-white/10 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white'
                        }
                      `}
                    >
                      <button
                        onClick={(e) => { handleNavigation('/admin'); (e.currentTarget as HTMLButtonElement).blur(); }}
                        className="flex items-center gap-3 w-full outline-none focus:outline-none"
                      >
                        <Settings className="h-4 w-4" />
                        {!collapsed && <span className="font-medium">Admin Panel</span>}
                      </button>
...
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator className="bg-white/20 mx-4" />
          </>
        )}

        {/* Logout Button */}
        <div className="mt-auto p-4">
          <Button
            onClick={signOut}
            variant="glass"
            data-allow-border="true"
            className={`
              w-full justify-start
              ${collapsed ? 'px-2' : 'px-4'}
            `}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Logga ut</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export default memo(EmployerSidebar);