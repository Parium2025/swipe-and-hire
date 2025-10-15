import React, { useEffect, useState, memo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
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
      if (isMobile) {
        setOpenMobile(false);
      } else {
        setOpen(false);
      }
    };

    window.addEventListener('unsaved-cancel', handleUnsavedCancel);
    return () => window.removeEventListener('unsaved-cancel', handleUnsavedCancel);
  }, [isMobile, setOpenMobile, setOpen]);

  const handleNavigation = (href: string) => {
    if (checkBeforeNavigation(href)) {
      navigate(href);
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

  return (
    <Sidebar 
      className={`border-r-0 ${collapsed ? 'w-16' : 'w-64'}`}
      style={{
        background: 'linear-gradient(180deg, hsl(215 80% 18%) 0%, hsl(215 70% 22%) 100%)'
      }}
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
                <p className="text-xs text-white truncate">
                  {profile?.industry || 'Admin'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-white text-xs uppercase tracking-wide px-4">
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
                      className="flex items-center gap-3 w-full"
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
          <SidebarGroupLabel className="text-white text-xs uppercase tracking-wide px-4">
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
                      className="flex items-center gap-3 w-full"
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
          <SidebarGroupLabel className="text-white text-xs uppercase tracking-wide px-4">
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
                      className="flex items-center gap-3 w-full"
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
                        className="flex items-center gap-3 w-full"
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
            variant="ghost"
            className={`
              w-full justify-start text-white hover:text-white hover:bg-white/10 
              transition-all duration-200 border border-white/20 hover:border-white/40
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