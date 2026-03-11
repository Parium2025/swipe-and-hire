import React, { memo, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { usePrefetchApplications } from '@/hooks/usePrefetchApplications';
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { SystemHealthButton, SystemHealthPanelContent } from "@/components/SystemHealthPanel";
import { useMediaUrl } from '@/hooks/useMediaUrl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ChevronDown,
  LayoutDashboard
} from "lucide-react";
import { PariumLogoButton } from "@/components/PariumLogoButton";
import NotificationCenter from "@/components/NotificationCenter";

// Dashboard dropdown items
const dashboardItems = [
  { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
  { title: "Mina Annonser", url: "/my-jobs", icon: Briefcase },
];

// Kandidater dropdown items
const candidateItems = [
  { title: "Alla Kandidater", url: "/candidates", icon: Users },
  { title: "Mina Kandidater", url: "/my-candidates", icon: UserCheck },
  { title: "Statistik", url: "/reports", icon: BarChart3 },
];

// Företag dropdown items (inkl inställningar)
const businessItems = [
  { title: "Företagsprofil", url: "/company-profile", icon: Building },
  { title: "Recensioner", url: "/reviews", icon: Star },
  { title: "Fakturering", url: "/billing", icon: CreditCard },
  { title: "Inställningar", url: "/settings", icon: Settings },
];

// Profil dropdown items (ersätter Support)
const profileItems = [
  { title: "Min Profil", url: "/profile", icon: UserCircle },
  { title: "Hjälp & Support", url: "/support", icon: HelpCircle },
];

// Dropdown styling matching the sort dropdown - compact and centered
const dropdownContentClass = "min-w-[160px] glass-panel z-[10000] rounded-lg p-1";
const dropdownItemClass = "flex items-center gap-2 cursor-pointer text-white hover:bg-white/20 focus:bg-white/20 rounded-md px-2.5 py-2 text-sm font-medium transition-colors";
const dropdownItemActiveClass = "bg-white/15 text-white";

function EmployerTopNav({ extraRight }: { extraRight?: React.ReactNode }) {
  const { profile, signOut, user, preloadedEmployerCandidates, preloadedUnreadMessages, preloadedEmployerMyJobs, preloadedEmployerDashboardJobs, preloadedMyCandidates, preloadedCompanyLogoUrl } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { checkBeforeNavigation } = useUnsavedChanges();
  const prefetchApplications = usePrefetchApplications();
  
  // Resolve signed URL for profile image
  const resolvedProfileImageUrl = useMediaUrl(profile?.profile_image_url, 'profile-image');
  
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [candidatesOpen, setCandidatesOpen] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [healthPanelOpen, setHealthPanelOpen] = useState(false);

  const handleNavigation = (href: string) => {
    if (checkBeforeNavigation(href)) {
      navigate(href);
    }
  };

  const isActiveUrl = (url: string) => {
    const currentPath = location.pathname;
    
    if (currentPath === url) return true;
    
    // When on job-details, highlight source
    if (currentPath.startsWith('/job-details/')) {
      const source = sessionStorage.getItem('jobDetailsSource');
      if (url === '/my-jobs' && source === '/my-jobs') return true;
      if (url === '/dashboard' && source === '/dashboard') return true;
    }
    
    return false;
  };

  const isDropdownActive = (items: typeof businessItems) => {
    return items.some(item => location.pathname === item.url);
  };

  // prefetchApplications is now provided by usePrefetchApplications hook

  const getCompanyInitials = () => {
    if (!profile?.company_name) return 'FA';
    return profile.company_name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const getUserInitials = () => {
    const firstName = profile?.first_name || '';
    const lastName = profile?.last_name || '';
    if (firstName && lastName) {
      return (firstName[0] + lastName[0]).toUpperCase();
    }
    if (firstName) return firstName.substring(0, 2).toUpperCase();
    return 'ME';
  };

  const getUserDisplayName = () => {
    const firstName = profile?.first_name || '';
    const lastName = profile?.last_name || '';
    if (firstName && lastName) return `${firstName} ${lastName}`;
    if (firstName) return firstName;
    return 'Min Profil';
  };

  const getCount = (url: string) => {
    switch (url) {
      case '/dashboard': return preloadedEmployerDashboardJobs > 0 ? preloadedEmployerDashboardJobs : null;
      case '/my-jobs': return preloadedEmployerMyJobs > 0 ? preloadedEmployerMyJobs : null;
      case '/candidates': return preloadedEmployerCandidates > 0 ? preloadedEmployerCandidates : null;
      case '/my-candidates': return preloadedMyCandidates > 0 ? preloadedMyCandidates : null;
      default: return null;
    }
  };

  const getDashboardCount = () => {
    const dashboardCount = preloadedEmployerDashboardJobs || 0;
    const jobsCount = preloadedEmployerMyJobs || 0;
    return dashboardCount + jobsCount > 0 ? dashboardCount + jobsCount : null;
  };

  const getCandidatesCount = () => {
    const candidates = preloadedEmployerCandidates || 0;
    const myCandidates = preloadedMyCandidates || 0;
    return candidates + myCandidates > 0 ? candidates + myCandidates : null;
  };

  return (
    <nav className="h-14 flex items-center border-b border-white/20 bg-transparent">
      <div className="w-full responsive-container-wide flex items-center justify-between">
      {/* Left side: Logo + Main Nav */}
      <div className="flex items-center gap-1">
        {/* Parium Logo - Home Button */}
        <PariumLogoButton
          onClick={() => handleNavigation('/home')}
          ariaLabel="Gå till dashboard"
        />

        {/* Main Navigation Dropdowns */}
        <div className="relative z-10 flex items-center gap-1">
          {/* Dashboard Dropdown */}
          <DropdownMenu open={dashboardOpen} onOpenChange={setDashboardOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex items-baseline gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white group"
              >
                <span 
                  className={`absolute inset-0 rounded-lg bg-white transition-opacity duration-150 ${
                    isDropdownActive(dashboardItems) ? 'opacity-20' : 'opacity-0 group-hover:opacity-10'
                  }`} 
                />
                <LayoutDashboard className="h-4 w-4 relative z-10 self-center" />
                <span className="relative z-10">Annonser</span>
                {getDashboardCount() && (
                  <span className="text-white text-xs relative z-10">({getDashboardCount()})</span>
                )}
                <ChevronDown className="h-3 w-3 text-white relative z-10 self-center" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className={dropdownContentClass}>
              {dashboardItems.map((item) => {
                const count = getCount(item.url);
                const isActive = isActiveUrl(item.url);
                return (
                  <DropdownMenuItem
                    key={item.url}
                    onClick={() => { handleNavigation(item.url); setDashboardOpen(false); }}
                    className={`${dropdownItemClass} ${isActive ? dropdownItemActiveClass : ''}`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.title}</span>
                    {count && <span className="text-white text-xs">({count})</span>}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Kandidater Dropdown */}
          <DropdownMenu open={candidatesOpen} onOpenChange={setCandidatesOpen}>
            <DropdownMenuTrigger asChild>
              <button
                onMouseEnter={prefetchApplications}
                className="relative flex items-baseline gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white group"
              >
                <span 
                  className={`absolute inset-0 rounded-lg bg-white transition-opacity duration-150 ${
                    isDropdownActive(candidateItems) ? 'opacity-20' : 'opacity-0 group-hover:opacity-10'
                  }`} 
                />
                <Users className="h-4 w-4 relative z-10 self-center" />
                <span className="relative z-10">Kandidater</span>
                {getCandidatesCount() && (
                  <span className="text-white text-xs relative z-10">({getCandidatesCount()})</span>
                )}
                <ChevronDown className="h-3 w-3 text-white relative z-10 self-center" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className={dropdownContentClass}>
              {candidateItems.map((item) => {
                const count = getCount(item.url);
                const isActive = isActiveUrl(item.url);
                const isMessages = item.url === '/messages';
                return (
                  <DropdownMenuItem
                    key={item.url}
                    onClick={() => { handleNavigation(item.url); setCandidatesOpen(false); }}
                    className={`${dropdownItemClass} ${isActive ? dropdownItemActiveClass : ''}`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.title}</span>
                    {count && <span className="text-white text-xs">({count})</span>}
                    {isMessages && preloadedUnreadMessages > 0 && (
                      <span className="bg-destructive text-destructive-foreground text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {preloadedUnreadMessages}
                      </span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Meddelanden Button */}
          <button
            onClick={() => handleNavigation('/messages')}
            className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white group"
          >
            <span 
              className={`absolute inset-0 rounded-lg bg-white transition-opacity duration-150 ${
                isActiveUrl('/messages') ? 'opacity-20' : 'opacity-0 group-hover:opacity-10'
              }`} 
            />
            <MessageCircle className="h-4 w-4 relative z-10" />
            <span className="relative z-10">Meddelanden</span>
            {preloadedUnreadMessages > 0 && (
              <span className="bg-destructive text-destructive-foreground text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[18px] text-center relative z-10">
                {preloadedUnreadMessages}
              </span>
            )}
          </button>

          {/* Företag Dropdown */}
          <DropdownMenu open={businessOpen} onOpenChange={setBusinessOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white group"
              >
                <span 
                  className={`absolute inset-0 rounded-lg bg-white transition-opacity duration-150 ${
                    isDropdownActive(businessItems) ? 'opacity-20' : 'opacity-0 group-hover:opacity-10'
                  }`} 
                />
                {preloadedCompanyLogoUrl ? (
                  <img 
                    src={preloadedCompanyLogoUrl} 
                    alt="Företagslogo" 
                    className="h-6 w-6 rounded-full object-cover ring-1 ring-white/30 relative z-10"
                  />
                ) : profile?.company_name ? (
                  <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold text-white relative z-10">
                    {profile.company_name.substring(0, 2).toUpperCase()}
                  </div>
                ) : (
                  <Building className="h-4 w-4 relative z-10" />
                )}
                <span className="relative z-10">Företag</span>
                <ChevronDown className="h-3 w-3 text-white relative z-10" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className={dropdownContentClass}>
              {businessItems.map((item) => {
                const isActive = isActiveUrl(item.url);
                return (
                  <DropdownMenuItem
                    key={item.url}
                    onClick={() => { handleNavigation(item.url); setBusinessOpen(false); }}
                    className={`${dropdownItemClass} ${isActive ? dropdownItemActiveClass : ''}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notification Center */}
          <NotificationCenter />

          {/* Profil Dropdown */}
          <DropdownMenu open={profileOpen} onOpenChange={setProfileOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors"
              >
                {resolvedProfileImageUrl ? (
                  <img 
                    src={resolvedProfileImageUrl} 
                    alt={getUserDisplayName()} 
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold text-white">
                    {getUserInitials()}
                  </div>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-white" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className={dropdownContentClass + " min-w-[180px]"}>
              {/* Profilhuvud med namn */}
              <div className="px-2.5 py-2 border-b border-white/10 mb-1">
                <div className="flex items-center gap-2.5">
                  {resolvedProfileImageUrl ? (
                    <img 
                      src={resolvedProfileImageUrl} 
                      alt={getUserDisplayName()} 
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold text-white">
                      {getUserInitials()}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0 flex-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-white font-medium text-sm truncate max-w-[140px] cursor-default">{getUserDisplayName()}</span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-popover text-popover-foreground border-border">
                        {getUserDisplayName()}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-white text-xs truncate max-w-[140px] cursor-default">{user?.email || ''}</span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-popover text-popover-foreground border-border">
                        {user?.email || ''}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
              {profileItems.map((item) => {
                const isActive = isActiveUrl(item.url);
                return (
                  <DropdownMenuItem
                    key={item.url}
                    onClick={() => { handleNavigation(item.url); setProfileOpen(false); }}
                    className={`${dropdownItemClass} ${isActive ? dropdownItemActiveClass : ''}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator className="bg-white/10 my-1.5" />
              <DropdownMenuItem 
                onClick={signOut} 
                className={`${dropdownItemClass} text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-full`}
              >
                <LogOut className="h-4 w-4" />
                Logga ut
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* System Health Button (admin only) - after profile */}
          <SystemHealthButton onClick={() => setHealthPanelOpen(!healthPanelOpen)} />

          {/* Extra right-side content (e.g. Create Job button) */}
          {extraRight}
        </div>
      </div>
      </div>

      {/* System Health Panel */}
      <SystemHealthPanelContent 
        isVisible={healthPanelOpen} 
        onClose={() => setHealthPanelOpen(false)} 
      />
    </nav>
  );
}

export default memo(EmployerTopNav);
