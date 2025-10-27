import React, { useEffect, useState, memo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  Star
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
    icon: Settings,
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
  const { profile, signOut, user } = useAuth();
  const navigate = useNavigate();
  const { checkBeforeNavigation } = useUnsavedChanges();
  const queryClient = useQueryClient();
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(() => {
    const fromProfile = (profile as any)?.company_logo_url as string | undefined;
    const cached = typeof window !== 'undefined' ? sessionStorage.getItem(LOGO_CACHE_KEY) : null;
    const raw = (typeof fromProfile === 'string' && fromProfile.trim() !== '') ? fromProfile : cached;
    return raw ? raw.split('?')[0] : null;
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
    const raw = (profile as any)?.company_logo_url;
    if (typeof raw === 'string' && raw.trim() !== '') {
      try {
        const base = raw.split('?')[0];
        setCompanyLogoUrl((prev) => {
          if (prev === base) return prev; // no change → avoid flicker
          setLogoLoaded(false);
          setLogoError(false);
          try { sessionStorage.setItem(LOGO_CACHE_KEY, base); } catch {}
          return base;
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
  }, [(profile as any)?.company_logo_url]);

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
    return window.location.pathname === url || 
           (url === "/" && window.location.pathname === "/");
  };

  // Prefetch applications data on hover/focus for instant navigation
  const prefetchApplications = () => {
    if (!user) return;

    queryClient.prefetchQuery({
      queryKey: ['applications', user.id],
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
            status,
            applied_at,
            updated_at,
            job_postings!inner(
              title
            ),
            profiles(
              profile_image_url
            )
          `)
          .order('applied_at', { ascending: false });

        if (error) throw error;
        if (!data) return [];

        return (data || []).map((app: any) => ({
          ...app,
          job_title: app.job_postings?.title,
          profile_image_url: app.profiles?.profile_image_url,
        }));
      },
      staleTime: 2 * 60 * 1000,
    });
  };

  return (
    <Sidebar 
      className={`border-r-0 bg-transparent ${collapsed ? 'w-16' : 'w-64'}`}
      collapsible="icon"
    >
      <SidebarContent className="gap-0">
        {/* User Profile Section - only show when not collapsed */}
        {!collapsed && (
          <div className="p-4">
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
          </div>
        )}

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
                      mx-2 rounded-lg transition-all duration-200
                      ${isActiveUrl(item.url) 
                        ? 'bg-white/20 text-white shadow-lg' 
                        : 'text-white hover:bg-white/10 hover:text-white'
                      }
                    `}
                  >
                    <button
                      onClick={() => handleNavigation(item.url)}
                      onMouseEnter={item.url === '/candidates' ? prefetchApplications : undefined}
                      onFocus={item.url === '/candidates' ? prefetchApplications : undefined}
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
                      mx-2 rounded-lg transition-all duration-200
                      ${isActiveUrl(item.url) 
                        ? 'bg-white/20 text-white shadow-lg' 
                        : 'text-white hover:bg-white/10 hover:text-white'
                      }
                    `}
                  >
                    <button
                      onClick={() => handleNavigation(item.url)}
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
                      mx-2 rounded-lg transition-all duration-200
                      ${isActiveUrl(item.url) 
                        ? 'bg-white/20 text-white shadow-lg' 
                        : 'text-white hover:bg-white/10 hover:text-white'
                      }
                    `}
                  >
                    <button
                      onClick={() => handleNavigation(item.url)}
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
                        mx-2 rounded-lg transition-all duration-200
                        ${isActiveUrl('/admin') 
                          ? 'bg-white/20 text-white shadow-lg' 
                          : 'text-white hover:bg-white/10 hover:text-white'
                        }
                      `}
                    >
                      <button
                        onClick={() => handleNavigation('/admin')}
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
            className={`
              w-full justify-start border border-white/30
              ${collapsed ? 'px-2' : 'px-4'}
            `}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-3">Logga ut</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export default memo(EmployerSidebar);