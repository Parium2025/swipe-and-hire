import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import {
  User,
  CreditCard,
  MessageCircle,
  Settings,
  LogOut,
  ChevronRight,
  Building,
  FileText,
  Crown
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

const profileItems = [
  { title: 'Min Profil', url: '/profile', icon: User },
  { title: 'Sök Jobb', url: '/search-jobs', icon: Building },
  { title: 'Inställningar', url: '/settings', icon: Settings },
];

const businessItems = [
  { title: 'Abonnemang', url: '/subscription', icon: Crown },
  { title: 'Fakturor', url: '/billing', icon: FileText },
  { title: 'Betalning', url: '/payment', icon: CreditCard },
];

const supportItems = [
  { title: 'Kundtjänst', url: '/support', icon: MessageCircle },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const { profile, userRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { checkBeforeNavigation } = useUnsavedChanges();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'bg-muted text-primary font-medium' : 'hover:bg-muted/50';

  const isEmployer = userRole?.role === 'employer';

  // Close mobile sidebar when user cancels unsaved dialog
  useEffect(() => {
    const closeOnCancel = () => {
      if (isMobile) setOpenMobile(false);
    };
    window.addEventListener('unsaved-cancel', closeOnCancel as EventListener);
    return () => window.removeEventListener('unsaved-cancel', closeOnCancel as EventListener);
  }, [isMobile, setOpenMobile]);

  const handleNavigation = (url: string, e: React.MouseEvent) => {
    console.log('handleNavigation called for:', url);
    e.preventDefault();
    if (checkBeforeNavigation(url)) {
      console.log('Navigation allowed, navigating to:', url);
      navigate(url);
      // Close sidebar after successful navigation
      if (isMobile) {
        setOpenMobile(false);
      }
    } else {
      console.log('Navigation blocked, dialog will show');
    }
  };

  return (
    <Sidebar
      className={`${collapsed ? 'w-14' : 'w-64'} sticky top-0 h-screen overflow-y-auto`}
      collapsible="icon"
    >
      <SidebarContent className="p-4">
        {/* User Profile Section */}
        {!collapsed && (
          <div className="mb-6">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.profile_image_url || ''} />
                <AvatarFallback>
                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile?.first_name} {profile?.last_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
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
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider">
              {collapsed ? <User className="h-4 w-4" /> : 'Profil'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {profileItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      onClick={(e) => handleNavigation(item.url, e)}
                      className={isActive(item.url) ? 'bg-muted text-primary font-medium' : 'hover:bg-muted/50'}
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
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider">
              {collapsed ? <Building className="h-4 w-4" /> : 'Företag'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {businessItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      onClick={(e) => handleNavigation(item.url, e)}
                      className={isActive(item.url) ? 'bg-muted text-primary font-medium' : 'hover:bg-muted/50'}
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
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider">
              {collapsed ? <MessageCircle className="h-4 w-4" /> : 'Support'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {supportItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      onClick={(e) => handleNavigation(item.url, e)}
                      className={isActive(item.url) ? 'bg-muted text-primary font-medium' : 'hover:bg-muted/50'}
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
            className="w-full justify-start text-muted-foreground hover:text-foreground"
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