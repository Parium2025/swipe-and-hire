import React, { useEffect, useState, memo, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { preloadImages } from "@/lib/serviceWorkerManager";
import { AuthLogoInline } from "@/assets/authLogoInline";

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
  Eye,
  Heart,
  FileText,
  Home
} from "lucide-react";

const profileItems = [
  { title: 'Min Profil', url: '/profile', icon: User },
  { title: 'Förhandsgranska Profil', url: '/profile-preview', icon: Eye },
  { title: 'Mitt samtycke', url: '/consent', icon: Settings },
];

const businessItems = [
  { title: 'Abonnemang', url: '/subscription', icon: Crown },
  { title: 'Betalningar', url: '/billing', icon: CreditCard },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile, setOpen } = useSidebar();
  const collapsed = state === 'collapsed';
  const { profile, userRole, signOut, user, preloadedAvatarUrl, preloadedCoverUrl, preloadedVideoUrl, preloadedTotalJobs, preloadedSavedJobs, preloadedJobSeekerUnreadMessages, preloadedMyApplications } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { checkBeforeNavigation } = useUnsavedChanges();

  // Använd preloadedAvatarUrl som primär källa, fallback till profile.profile_image_url, sedan cover_image_url
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    // Prioritera cache först (identiskt med arbetsgivarsidan)
    return preloadedAvatarUrl || preloadedCoverUrl || profile?.profile_image_url || profile?.cover_image_url || null;
  });
  // Använd preloadedVideoUrl från AuthProvider (sessionStorage-cachad precis som arbetsgivarsidan)
  const [videoUrl, setVideoUrl] = useState<string | null>(() => preloadedVideoUrl ?? null);
  const [coverUrl, setCoverUrl] = useState<string | null>(() => preloadedCoverUrl || profile?.cover_image_url || null);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  
  // hasVideo: true om antingen DB har video_url ELLER vi har en preloaded video URL
  // Detta säkerställer att videon visas även om preloading är asynkron
  const hasVideo = !!(profile?.video_url || preloadedVideoUrl || videoUrl);
  
  // Håll avatar i synk med preloader/profile, med cover som fallback
  useEffect(() => {
    // Prioritera i rätt ordning: preloaded → profile → cover
    const newAvatarUrl = preloadedAvatarUrl || preloadedCoverUrl || profile?.profile_image_url || profile?.cover_image_url || null;
    if (newAvatarUrl && newAvatarUrl !== avatarUrl) {
      setAvatarUrl(newAvatarUrl);
    }
  }, [preloadedAvatarUrl, preloadedCoverUrl, profile?.profile_image_url, profile?.cover_image_url]);

  useEffect(() => {
    const newCoverUrl = preloadedCoverUrl || profile?.cover_image_url || null;
    if (newCoverUrl !== coverUrl) {
      setCoverUrl(newCoverUrl);
    }
  }, [preloadedCoverUrl, profile?.cover_image_url]);
  
  // Synka videoUrl från preloadedVideoUrl (uppdateras asynkront efter login)
  useEffect(() => {
    if (preloadedVideoUrl && preloadedVideoUrl !== videoUrl) {
      setVideoUrl(preloadedVideoUrl);
    }
  }, [preloadedVideoUrl]);

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

  // Video-URL hämtas nu från AuthProvider (sessionStorage-cachad) - ingen egen fetch behövs

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
           (url === "/" && location.pathname === "/") ||
           (url === "/home" && location.pathname === "/home");
  };

  // Förladdda alla profilbilder via Service Worker för persistent cache
  const profileImages = useMemo(() => {
    const images: string[] = [];
    if (avatarUrl) images.push(avatarUrl);
    if (profile?.cover_image_url) images.push(profile.cover_image_url);
    if (profile?.profile_image_url) images.push(profile.profile_image_url);
    return images;
  }, [avatarUrl, profile?.cover_image_url, profile?.profile_image_url]);

  useEffect(() => {
    if (profileImages.length > 0) {
      preloadImages(profileImages);
    }
  }, [profileImages]);

  return (
    <Sidebar 
      className={`border-r-0 bg-transparent ${collapsed ? 'w-16' : 'w-64'}`}
      collapsible="icon"
    >
      <SidebarContent className="gap-0">
        {/* User Profile Section - always mounted to preload, but only visible when not collapsed */}
        <div className={`p-4 ${collapsed ? 'hidden' : ''}`}>
          <div className="flex items-center gap-3">
            {hasVideo && videoUrl ? (
              <ProfileVideo
                videoUrl={videoUrl}
                coverImageUrl={coverUrl || avatarUrl || undefined}
                userInitials={`${profile?.first_name?.[0] || ''}${profile?.last_name?.[0] || ''}`}
                alt="Profilvideo"
                className="h-10 w-10 ring-2 ring-white/20 rounded-full"
                showCountdown={false}
                showProgressBar={false}
              />
            ) : (
              <Avatar className="h-10 w-10 ring-2 ring-white/20 transform-gpu" style={{ contain: 'paint' }}>
                <AvatarImage 
                  src={avatarUrl || ''} 
                  alt="Profilbild" 
                  onError={() => {
                    setAvatarError(true);
                    setAvatarUrl(null);
                  }}
                  onLoad={() => setAvatarLoaded(true)}
                />
                <AvatarFallback className="bg-white/20 text-white font-semibold" delayMs={150}>
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
        
        {/* Hidden preloader - always mounted to keep video/image cached */}
        <div className="hidden">
          {avatarUrl && (
            <img 
              src={avatarUrl} 
              alt="Preload" 
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
          )}
        </div>

        <SidebarSeparator className="bg-white/20 mx-4" />

        {/* Navigation Groups */}
        {/* Main Section */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
               {[
                 { title: 'Hem', url: '/home', icon: Home, count: undefined, showBadge: false },
                 { title: 'Sök Jobb', url: '/search-jobs', icon: Building, count: preloadedTotalJobs, showBadge: false },
                 { title: 'Sparade Jobb', url: '/saved-jobs', icon: Heart, count: preloadedSavedJobs, showBadge: false },
                 { title: 'Mina Ansökningar', url: '/my-applications', icon: FileText, count: preloadedMyApplications, showBadge: false },
                 { title: 'Meddelanden', url: '/messages', icon: MessageCircle, count: preloadedJobSeekerUnreadMessages, showBadge: preloadedJobSeekerUnreadMessages > 0 },
               ].map((item) => (
                 <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                      asChild
                      className={`
                        mx-2 rounded-lg transition-all duration-200 active:!bg-transparent
                        ${isActiveUrl(item.url) 
                          ? 'bg-white/20 text-white [&_svg]:text-white' 
                          : 'text-white md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 [&_svg]:text-white md:hover:[&_svg]:text-white'
                        }
                      `}
                   >
                    <button
                      onClick={(e) => { handleNavigation(item.url); (e.currentTarget as HTMLButtonElement).blur(); }}
                      className="flex items-center gap-3 w-full outline-none focus:outline-none"
                    >
                      <div className="relative">
                        <item.icon className="h-4 w-4" />
                        {item.showBadge && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
                        )}
                      </div>
                      {!collapsed && (
                        <span className="font-medium flex items-center gap-2">
                          {item.title === 'Meddelanden' ? (
                            <>
                              {item.title}
                              {item.count > 0 && (
                                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                  {item.count}
                                </span>
                              )}
                            </>
                          ) : item.count !== undefined ? (
                            <>
                              {item.title} ({item.count ?? 0})
                            </>
                          ) : (
                            item.title
                          )}
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
                          : 'text-white md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 [&_svg]:text-white md:hover:[&_svg]:text-white'
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
                          : 'text-white md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 [&_svg]:text-white md:hover:[&_svg]:text-white'
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
                          : 'text-white md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 [&_svg]:text-white md:hover:[&_svg]:text-white'
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

        {/* Parium branding + Logout — pushed to bottom */}
        <div className="mt-auto flex-1 flex flex-col items-center justify-end p-4">
          {!collapsed && (
            <div className="flex-1 flex items-center justify-center" style={{ maxWidth: 'none' }}>
              <AuthLogoInline className="h-20" style={{ width: '14rem', maxWidth: 'none' }} />
            </div>
          )}
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

export default memo(AppSidebar);