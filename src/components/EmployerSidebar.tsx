import React, { useEffect, useState, memo, useMemo, startTransition } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsOrgAdmin } from "@/hooks/useIsOrgAdmin";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useQueryClient } from '@tanstack/react-query';
import { usePrefetchApplications } from '@/hooks/usePrefetchApplications';
import { useSidebarRoutePrefetch } from '@/hooks/useSidebarRoutePrefetch';
import { preloadImages } from "@/lib/serviceWorkerManager";
import { resolveCompanyLogoUrl } from '@/lib/companyLogoUrl';
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
import { TruncatedText } from "@/components/TruncatedText";
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
  UserCheck,
  Home
} from "lucide-react";


// Navigation items for employer sidebar
const employerNavItems = [
  {
    title: "Hem",
    url: "/home",
    icon: Home,
    group: "huvudmeny"
  },
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
    title: "Statistik",
    url: "/reports",
    icon: BarChart3,
    group: "huvudmeny"
  },
  {
    title: "Chattar",
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
  // On mobile, always show labels (the sidebar slides in full-width)
  const collapsed = isMobile ? false : state === 'collapsed';
  const { profile, signOut, user, preloadedCompanyLogoUrl, preloadedEmployerCandidates, preloadedUnreadMessages, preloadedEmployerMyJobs, preloadedEmployerDashboardJobs, preloadedEmployerTotalViews, preloadedEmployerTotalApplications, preloadedMyCandidates } = useAuth();
  const { isAdmin: isOrgAdmin } = useIsOrgAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const { checkBeforeNavigation } = useUnsavedChanges();
  const queryClient = useQueryClient();
  const prefetchApplications = usePrefetchApplications();
  const prefetchRoute = useSidebarRoutePrefetch();
  const profileCompanyLogoUrl = profile?.company_logo_url ?? null;

  // Behåll hover-prefetch på desktop, men undvik touchstart-prefetch på mobil
  // eftersom det konkurrerar med drawer-stängningen (identiskt med AppSidebar).
  const handlePrefetch = React.useCallback((url: string) => {
    if (isMobile) return;
    prefetchRoute(url);
  }, [isMobile, prefetchRoute]);
  
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
  
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(() => {
    // Prioritera preloaded URL från AuthProvider
    if (preloadedCompanyLogoUrl) return preloadedCompanyLogoUrl;
    
    const fromProfile = profileCompanyLogoUrl;
    // Only use cache if profile hasn't explicitly set logo to empty
    if (fromProfile === '' || fromProfile === null) {
      // Profile explicitly has no logo - don't use cache
      try { sessionStorage.removeItem(LOGO_CACHE_KEY); } catch { /* ignore sessionStorage failures */ }
      return null;
    }
    const cached = typeof window !== 'undefined' ? sessionStorage.getItem(LOGO_CACHE_KEY) : null;
    const raw = (typeof fromProfile === 'string' && fromProfile.trim() !== '') ? fromProfile : cached;
    return resolveCompanyLogoUrl(raw);
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
    
    const raw = profileCompanyLogoUrl;
    if (typeof raw === 'string' && raw.trim() !== '') {
      try {
          const publicUrl = resolveCompanyLogoUrl(raw);
        setCompanyLogoUrl((prev) => {
          if (prev === publicUrl) return prev; // no change → avoid flicker
          setLogoLoaded(false);
          setLogoError(false);
          if (publicUrl) {
            try { sessionStorage.setItem(LOGO_CACHE_KEY, publicUrl); } catch { /* ignore sessionStorage failures */ }
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
      try { sessionStorage.removeItem(LOGO_CACHE_KEY); } catch { /* ignore sessionStorage failures */ }
    }
    // if undefined, keep previous URL while profile is re-fetching
  }, [profileCompanyLogoUrl, preloadedCompanyLogoUrl, companyLogoUrl]);

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

  // Förladda företagslogo via Service Worker — identiskt med jobbsökarens
  // AppSidebar. Detta håller logotypen varm i cache så att den inte "laddas
  // om" varje gång drawern öppnas på mobil (Sheet remountas vid varje öppning).
  const profileImages = useMemo(() => {
    const images: string[] = [];
    if (companyLogoUrl) images.push(companyLogoUrl);
    return images;
  }, [companyLogoUrl]);

  useEffect(() => {
    if (profileImages.length > 0) {
      preloadImages(profileImages);
    }
  }, [profileImages]);

  const handleNavigation = (href: string) => {
    if (!checkBeforeNavigation(href)) return;

    // Mobil: stäng sidobaren FÖRST så att slide-out-animationen hinner starta
    // innan React börjar montera den nya sidan. Identiskt mönster som
    // jobbsökarens AppSidebar — ger märkbart mjukare övergångar.
    if (isMobile) {
      setOpenMobile(false);
      startTransition(() => {
        navigate(href);
      });
    } else {
      navigate(href);
    }
    // Notera: window.scrollTo är borttagen — appens scroll sker i en inre
    // <main>-container, så fönster-scroll gör ingen nytta utan bara onödigt
    // arbete på huvudtråden.
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

  // prefetchApplications is now provided by usePrefetchApplications hook

  return (
    <Sidebar 
      className={`border-r-0 bg-transparent ${collapsed ? 'w-16' : 'w-64'}`}
      collapsible="icon"
    >
      <SidebarContent className="gap-0 overflow-x-hidden">
        {/* User Profile Section — identisk struktur som jobbsökarens AppSidebar:
            blocket är alltid monterat (CompanyAvatar remountas aldrig vid resize),
            och göms via `hidden`-klass när sidobaren är kollapsad. Detta ger en
            mycket mjukare collapse/expand-övergång och förhindrar att logotypen
            "laddas om" när drawern öppnas på mobil. */}
        <div className={`shrink-0 p-4 ${collapsed ? 'hidden' : ''}`}>
          <div className="flex items-center gap-3">
            {!profile ? (
              /* Skeleton while profile loads */
              <>
                <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-3.5 w-24 bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
                </div>
              </>
            ) : (
              <>
                <CompanyAvatar
                  companyLogoUrl={companyLogoUrl}
                  companyName={profile?.company_name || `${profile?.first_name} ${profile?.last_name}`}
                  initials={getCompanyInitials()}
                />
                <div className="flex-1 min-w-0">
                  <TruncatedText
                    text={profile?.company_name || `${profile?.first_name} ${profile?.last_name}`}
                    className="font-medium text-white text-sm truncate block"
                  />
                  <TruncatedText
                    text={profile?.industry || 'Admin'}
                    className="text-sm text-white truncate block"
                  />
                </div>
              </>
            )}
          </div>
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
                      onMouseEnter={() => {
                        handlePrefetch(item.url);
                        if (item.url === '/candidates') prefetchApplications();
                      }}
                      onTouchStart={() => {
                        handlePrefetch(item.url);
                        if (item.url === '/candidates') prefetchApplications();
                      }}
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
                      onMouseEnter={() => handlePrefetch(item.url)}
                      onTouchStart={() => handlePrefetch(item.url)}
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
                      onMouseEnter={() => handlePrefetch(item.url)}
                      onTouchStart={() => handlePrefetch(item.url)}
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
        {isOrgAdmin && (
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
              min-h-[var(--control-height)] w-full justify-start text-[0.95rem] md:min-h-[var(--control-height-compact)] md:text-sm
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