import { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import {
  User,
  CreditCard,
  MessageCircle,
  LogOut,
  ChevronRight,
  Building,
  Crown,
  Settings,
  Eye
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { convertToSignedUrl } from '@/utils/storageUtils';

const profileItems = [
  { title: 'Min Profil', url: '/profile', icon: User },
  { title: 'Förhandsgranska Profil', url: '/profile-preview', icon: Eye },
  { title: 'Mitt samtycke', url: '/consent', icon: Settings },
  { title: 'Sök Jobb', url: '/search-jobs', icon: Building },
];

const businessItems = [
  { title: 'Abonnemang', url: '/subscription', icon: Crown },
  { title: 'Betalningar', url: '/billing', icon: CreditCard },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const { profile, userRole, signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { checkBeforeNavigation } = useUnsavedChanges();
  const currentPath = location.pathname;
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'bg-muted text-primary font-medium' : 'hover:bg-muted/50';

  const isEmployer = userRole?.role === 'employer';
  const isAdmin = user?.email === 'fredrikandits@hotmail.com';

  // Support items - add admin for Fredrik
  const supportItems = [
    { title: 'Kundtjänst', url: '/support', icon: MessageCircle },
    ...(isAdmin ? [{ title: 'Admin Panel', url: '/admin', icon: Settings }] : [])
  ];

  // Close mobile sidebar when user cancels unsaved dialog
  useEffect(() => {
    const closeOnCancel = () => {
      if (isMobile) setOpenMobile(false);
    };
    window.addEventListener('unsaved-cancel', closeOnCancel as EventListener);
    return () => window.removeEventListener('unsaved-cancel', closeOnCancel as EventListener);
}, [isMobile, setOpenMobile]);

  // Ensure avatar uses a fresh signed URL (handles expired links) with debouncing
  useEffect(() => {
    let isCancelled = false;
    
    const loadAvatar = async () => {
      const candidate = profile?.cover_image_url || profile?.profile_image_url || '';
      if (!candidate) { 
        if (!isCancelled) setAvatarUrl(''); 
        return; 
      }
      
      try {
        // Add small delay to prevent rapid updates during login
        await new Promise(resolve => setTimeout(resolve, 50));
        if (isCancelled) return;
        
        const refreshed = await convertToSignedUrl(candidate, 'job-applications', 86400);
        const finalUrl = (refreshed || candidate) + (candidate.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`);
        
        if (!isCancelled) {
          setAvatarUrl(finalUrl);
        }
      } catch {
        if (!isCancelled) {
          setAvatarUrl(candidate);
        }
      }
    };
    
    loadAvatar();
    
    return () => {
      isCancelled = true;
    };
  }, [profile?.cover_image_url, profile?.profile_image_url]);

  // Memoized navigation handler to prevent re-renders
  const handleNavigation = useCallback((url: string, e: React.MouseEvent) => {
    e.preventDefault();
    
    if (checkBeforeNavigation(url)) {
      navigate(url);
      // Close mobile sidebar immediately for better UX
      if (isMobile) {
        setOpenMobile(false);
      }
    }
  }, [checkBeforeNavigation, navigate, isMobile, setOpenMobile]);

  // Memoized active state checker
  const isActiveUrl = useCallback((path: string) => currentPath === path, [currentPath]);

  return (
    <Sidebar
      className={`${collapsed ? 'w-14' : 'w-64'} sticky top-0 h-screen overflow-y-auto transition-all duration-200 ease-in-out`}
      style={{
        background: 'linear-gradient(180deg, hsl(215 80% 18%) 0%, hsl(215 70% 22%) 100%)'
      }}
      collapsible="icon"
    >
      <SidebarContent className="p-4">
        {/* User Profile Section */}
        {!collapsed && (
          <div className="mb-6 animate-fade-in">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent transition-colors duration-150">
                <Avatar className="h-10 w-10">
                  <AvatarImage 
                    src={avatarUrl} 
                    alt="Profilbild" 
                    onError={() => setAvatarUrl('')}
                    className="transition-opacity duration-200"
                    style={{ opacity: avatarUrl ? 1 : 0 }}
                  />
                  <AvatarFallback className="bg-white/20 text-white transition-opacity duration-200">
                    {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile?.first_name} {profile?.last_name}
                </p>
                <p className="text-xs text-sidebar-foreground/70 truncate">
                  {userRole?.role === 'employer' ? 'Arbetsgivare' : 'Jobbsökare'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Groups */}
        <div className="space-y-4">
          {/* Profile Section */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-white">
              {collapsed ? <User className="h-4 w-4" /> : 'Profil'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                 {profileItems.map((item) => (
                   <SidebarMenuItem key={item.title}>
                     <SidebarMenuButton 
                       data-onboarding={item.title === 'Min Profil' ? 'min-profil' : undefined}
                       onClick={(e) => handleNavigation(item.url, e)}
                       className={`transition-colors duration-150 ${isActiveUrl(item.url) ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'hover:bg-sidebar-accent'}`}
                       title={collapsed ? item.title : undefined}
                     >
                       <item.icon className="h-4 w-4" />
                       {!collapsed && <span>{item.title}</span>}
                     </SidebarMenuButton>
                   </SidebarMenuItem>
                 ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Separator />

          {/* Business Section */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-white">
              {collapsed ? <Building className="h-4 w-4" /> : 'Ekonomi'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                 {businessItems.map((item) => (
                   <SidebarMenuItem key={item.title}>
                     <SidebarMenuButton 
                       onClick={(e) => handleNavigation(item.url, e)}
                       className={`transition-colors duration-150 ${isActiveUrl(item.url) ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'hover:bg-sidebar-accent'}`}
                       title={collapsed ? item.title : undefined}
                     >
                       <item.icon className="h-4 w-4" />
                       {!collapsed && <span>{item.title}</span>}
                     </SidebarMenuButton>
                   </SidebarMenuItem>
                 ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Separator />

          {/* Support Section */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-white">
              {collapsed ? <MessageCircle className="h-4 w-4" /> : 'Support'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                 {supportItems.map((item) => (
                   <SidebarMenuItem key={item.title}>
                     <SidebarMenuButton 
                       onClick={(e) => handleNavigation(item.url, e)}
                       className={`transition-colors duration-150 ${isActiveUrl(item.url) ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'hover:bg-sidebar-accent'}`}
                       title={collapsed ? item.title : undefined}
                     >
                       <item.icon className="h-4 w-4" />
                       {!collapsed && <span>{item.title}</span>}
                     </SidebarMenuButton>
                   </SidebarMenuItem>
                 ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

        {/* Sign Out Button */}
        <div className="mt-auto pt-4">
          <Button 
            onClick={signOut}
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150"
            title={collapsed ? 'Logga ut' : undefined}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Logga ut</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}