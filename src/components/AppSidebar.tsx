import React, { useEffect, memo, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { preloadImages } from "@/lib/serviceWorkerManager";
import { useMediaUrl } from "@/hooks/useMediaUrl";
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
  FileText
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

  // 🔥 SYNKRON CACHE-LÄSNING via useMediaUrl - eliminerar flimmer vid tab-switch
  // Denna hook har inbyggd synkron cache som returnerar URL direkt vid mount
  const resolvedProfileImage = useMediaUrl(profile?.profile_image_url, 'profile-image');
  const resolvedCoverImage = useMediaUrl(profile?.cover_image_url, 'cover-image');
  const resolvedVideoUrl = useMediaUrl(profile?.video_url, 'profile-video');
  
  // Kombinera preloaded URLs med resolved URLs - prioritera resolved (synkron cache)
  const avatarUrl = resolvedProfileImage || preloadedAvatarUrl || resolvedCoverImage || preloadedCoverUrl || null;
  const coverUrl = resolvedCoverImage || preloadedCoverUrl || null;
  const videoUrl = resolvedVideoUrl || preloadedVideoUrl || null;
  
  // hasVideo: true om antingen DB har video_url ELLER vi har en resolved/preloaded video URL
  const hasVideo = !!(profile?.video_url || videoUrl);
  
  // useMediaUrl har redan synkron cache-läsning - ingen manuell synk behövs längre

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
           (url === "/" && location.pathname === "/");
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
                      className="flex items-center gap-3 w-full min-h-[44px] outline-none focus:outline-none active:scale-[0.97] transition-transform"
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
                          ) : (
                            <>
                              {item.title} ({item.count ?? 0})
                            </>
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
                      className="flex items-center gap-3 w-full min-h-[44px] outline-none focus:outline-none active:scale-[0.97] transition-transform"
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
                      className="flex items-center gap-3 w-full min-h-[44px] outline-none focus:outline-none active:scale-[0.97] transition-transform"
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
                      className="flex items-center gap-3 w-full min-h-[44px] outline-none focus:outline-none active:scale-[0.97] transition-transform"
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