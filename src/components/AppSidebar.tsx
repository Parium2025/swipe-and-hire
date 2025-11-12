import React, { useEffect, useState, memo, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { preloadImages } from "@/lib/serviceWorkerManager";
import { supabase } from "@/integrations/supabase/client";
import { getMediaUrl } from "@/lib/mediaManager";
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

export function AppSidebar() {
  const { state, setOpenMobile, isMobile, setOpen } = useSidebar();
  const collapsed = state === 'collapsed';
  const { profile, userRole, signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { checkBeforeNavigation } = useUnsavedChanges();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
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

  // Generate signed URLs for all media using mediaManager
  useEffect(() => {
    const loadMedia = async () => {
      // Video URL (private bucket)
      if (profile?.video_url) {
        try {
          const url = await getMediaUrl(profile.video_url, 'profile-video', 86400);
          if (url) setVideoUrl(url);
        } catch (error) {
          console.error('Failed to load video URL:', error);
          setVideoUrl(null);
        }
      } else {
        setVideoUrl(null);
      }

      // Cover image URL (public bucket)
      if (profile?.cover_image_url) {
        try {
          const url = await getMediaUrl(profile.cover_image_url, 'cover-image', 86400);
          if (url) setCoverUrl(url);
        } catch (error) {
          console.error('Failed to load cover URL:', error);
          setCoverUrl(null);
        }
      } else {
        setCoverUrl(null);
      }

      // Profile image URL - ALWAYS prefer profile image for avatar, regardless of video presence
      if (profile?.profile_image_url) {
        try {
          const url = await getMediaUrl(profile.profile_image_url, 'profile-image', 86400);
          if (url) setAvatarUrl(url);
        } catch (error) {
          console.error('Failed to load avatar URL:', error);
          setAvatarUrl(null);
        }
      } else if (profile?.cover_image_url) {
        // Use cover as fallback if no profile image
        try {
          const url = await getMediaUrl(profile.cover_image_url, 'cover-image', 86400);
          if (url) setAvatarUrl(url);
        } catch (error) {
          console.error('Failed to load cover as avatar:', error);
          setAvatarUrl(null);
        }
      } else {
        setAvatarUrl(null);
      }
    };

    loadMedia();
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
                  decoding="async"
                  fetchPriority="high"
                  draggable={false}
                />
                <AvatarFallback className="bg-white/20 text-white font-semibold">
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