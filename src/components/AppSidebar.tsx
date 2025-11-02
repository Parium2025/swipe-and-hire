import React, { useEffect, useState, memo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ProfileVideo from "@/components/ProfileVideo";
import { Button } from "@/components/ui/button";
import { 
  User,
  CreditCard,
  MessageCircle,
  LogOut,
  Building,
  Crown,
  Settings,
  Eye
} from "lucide-react";


const mainItems = [
  { title: 'Sök Jobb', url: '/search-jobs', icon: Building },
];

const profileItems = [
  { title: 'Min Profil', url: '/profile', icon: User },
  { title: 'Förhandsgranska Profil', url: '/profile-preview', icon: Eye },
  { title: 'Mitt samtycke', url: '/consent', icon: Settings },
];

const businessItems = [
  { title: 'Abonnemang', url: '/subscription', icon: Crown },
  { title: 'Betalningar', url: '/billing', icon: CreditCard },
];

const AVATAR_CACHE_KEY = 'parium_profile_avatar_base';

export function AppSidebar() {
  const { state, setOpenMobile, isMobile, setOpen } = useSidebar();
  const collapsed = state === 'collapsed';
  const { profile, userRole, signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { checkBeforeNavigation } = useUnsavedChanges();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    const fromProfile = profile?.profile_image_url || profile?.cover_image_url || '';
    const cached = typeof window !== 'undefined' ? sessionStorage.getItem(AVATAR_CACHE_KEY) : null;
    const raw = (typeof fromProfile === 'string' && fromProfile.trim() !== '') ? fromProfile : cached;
    return raw ? raw.split('?')[0] : null;
  });
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  
  const hasVideo = !!profile?.video_url;

  const isAdmin = user?.email === 'fredrikandits@hotmail.com';

  // Support items - add admin for Fredrik
  const supportItems = [
    { title: 'Kundtjänst', url: '/support', icon: MessageCircle },
    ...(isAdmin ? [{ title: 'Admin Panel', url: '/admin', icon: Settings }] : [])
  ];

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

  // Keep last known avatar; don't reset state unless value actually changes
  useEffect(() => {
    const raw = profile?.profile_image_url || profile?.cover_image_url || '';
    if (typeof raw === 'string' && raw.trim() !== '') {
      try {
        const base = raw.split('?')[0];
        setAvatarUrl((prev) => {
          if (prev === base) return prev; // no change → avoid flicker
          setAvatarLoaded(false);
          setAvatarError(false);
          try { sessionStorage.setItem(AVATAR_CACHE_KEY, base); } catch {}
          return base;
        });
      } catch (error) {
        console.error('Failed to parse profile avatar:', error);
      }
    } else if (raw === '' || raw === null) {
      setAvatarUrl(null);
      setAvatarLoaded(false);
      setAvatarError(false);
      try { sessionStorage.removeItem(AVATAR_CACHE_KEY); } catch {}
    }
    // if undefined, keep previous URL while profile is re-fetching
  }, [profile?.profile_image_url, profile?.cover_image_url, profile?.video_url]);

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
    return location.pathname === url || 
           (url === "/" && location.pathname === "/");
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
              {hasVideo && profile?.video_url ? (
                <ProfileVideo
                  videoUrl={profile.video_url}
                  coverImageUrl={profile.cover_image_url || profile.profile_image_url}
                  userInitials={`${profile?.first_name?.[0] || ''}${profile?.last_name?.[0] || ''}`}
                  alt="Profilvideo"
                  className="h-10 w-10 ring-2 ring-white/20 rounded-full"
                />
              ) : (
                <Avatar className="h-10 w-10 ring-2 ring-white/20 transform-gpu" style={{ contain: 'paint' }}>
                  <AvatarImage 
                    src={avatarUrl || undefined} 
                    alt="Profilbild" 
                    onError={() => {
                      setAvatarError(true);
                      setAvatarUrl(null);
                    }}
                    onLoad={() => setAvatarLoaded(true)}
                    loading="eager"
                    decoding="sync"
                    fetchPriority="high"
                    draggable={false}
                  />
                  <AvatarFallback className="bg-white/20 text-white">
                    {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {profile?.first_name} {profile?.last_name}
                </p>
                <p className="text-sm text-white truncate">
                  {userRole?.role === 'employer' ? 'Arbetsgivare' : 'Jobbsökare'}
                </p>
              </div>
            </div>
          </div>
        )}

        <SidebarSeparator className="bg-white/20 mx-4" />

        {/* Navigation Groups */}
        {/* Main Section */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
               {mainItems.map((item) => (
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

        {/* Profile Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-white text-sm uppercase tracking-wide px-4">
            Profil
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
               {profileItems.map((item) => (
                 <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                      asChild
                      data-onboarding={item.title === 'Min Profil' ? 'min-profil' : undefined}
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

        {/* Business Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-white text-sm uppercase tracking-wide px-4">
            Ekonomi
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
               {businessItems.map((item) => (
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
               {supportItems.map((item) => (
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

        {/* Logout Button */}
        <div className="mt-auto p-4">
          <Button
            onClick={signOut}
            data-allow-border="true"
            className={`
              flex items-center gap-2 bg-transparent text-white border border-white/30
              w-full justify-start transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50
              md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white
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

export default memo(AppSidebar);