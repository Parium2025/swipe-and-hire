import React, { memo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useSavedSearches } from "@/hooks/useSavedSearches";
import { useMediaUrl } from "@/hooks/useMediaUrl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ProfileVideo from "@/components/ProfileVideo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Building, 
  Heart,
  FileText,
  MessageCircle,
  User,
  Eye,
  Settings,
  Crown,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronDown,
  Briefcase,
  Bell
} from "lucide-react";
import { PariumLogoButton } from "@/components/PariumLogoButton";

// Jobb dropdown items
const jobItems = [
  { title: "Sök Jobb", url: "/search-jobs", icon: Building },
  { title: "Sparade Jobb", url: "/saved-jobs", icon: Heart },
  { title: "Mina Ansökningar", url: "/my-applications", icon: FileText },
];

// Profil dropdown items
const profileItems = [
  { title: "Min Profil", url: "/profile", icon: User },
  { title: "Förhandsgranska Profil", url: "/profile-preview", icon: Eye },
  { title: "Mitt samtycke", url: "/consent", icon: Settings },
];

// Ekonomi dropdown items
const economyItems = [
  { title: "Abonnemang", url: "/subscription", icon: Crown },
  { title: "Betalningar", url: "/billing", icon: CreditCard },
];

// Support dropdown items
const supportItems = [
  { title: "Kundtjänst", url: "/support", icon: HelpCircle },
];

// Dropdown styling matching employer side
const dropdownContentClass = "min-w-[180px] bg-slate-900/95 backdrop-blur-xl border border-white/20 shadow-xl z-[10000] rounded-lg p-1";
const dropdownItemClass = "flex items-center gap-2 cursor-pointer text-white hover:bg-white/20 focus:bg-white/20 rounded-md px-2.5 py-2 text-sm font-medium transition-colors";
const dropdownItemActiveClass = "bg-white/15 text-white";

function JobSeekerTopNav() {
  const { 
    profile, 
    signOut, 
    user, 
    preloadedAvatarUrl, 
    preloadedCoverUrl, 
    preloadedVideoUrl,
    preloadedTotalJobs,
    preloadedSavedJobs,
    preloadedMyApplications,
    preloadedJobSeekerUnreadMessages
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { checkBeforeNavigation } = useUnsavedChanges();
  const { totalNewMatches } = useSavedSearches();
  
  const [jobsOpen, setJobsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [economyOpen, setEconomyOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  // Avatar/Video state - fallback uses useMediaUrl for safety
  const fallbackProfileImageUrl = useMediaUrl(
    (!preloadedAvatarUrl && !preloadedCoverUrl) ? profile?.profile_image_url : null, 
    'profile-image'
  );
  const avatarUrl = preloadedAvatarUrl || preloadedCoverUrl || fallbackProfileImageUrl || null;
  const videoUrl = preloadedVideoUrl ?? null;
  const coverUrl = preloadedCoverUrl || null;
  const hasVideo = !!(profile?.video_url || preloadedVideoUrl || videoUrl);

  const isAdmin = user?.email === 'fredrikandits@hotmail.com';

  const handleNavigation = (href: string) => {
    if (checkBeforeNavigation(href)) {
      navigate(href);
    }
  };

  const isActiveUrl = (url: string) => {
    return location.pathname === url;
  };

  const isDropdownActive = (items: typeof jobItems) => {
    return items.some(item => location.pathname === item.url);
  };

  const getUserInitials = () => {
    const firstName = profile?.first_name || '';
    const lastName = profile?.last_name || '';
    if (firstName && lastName) {
      return (firstName[0] + lastName[0]).toUpperCase();
    }
    if (firstName) return firstName.substring(0, 2).toUpperCase();
    return 'JS';
  };

  const getUserDisplayName = () => {
    const firstName = profile?.first_name || '';
    const lastName = profile?.last_name || '';
    if (firstName && lastName) return `${firstName} ${lastName}`;
    if (firstName) return firstName;
    return 'Jobbsökare';
  };

  const getJobCount = (url: string) => {
    switch (url) {
      case '/search-jobs': return preloadedTotalJobs ?? 0;
      case '/saved-jobs': return preloadedSavedJobs ?? 0;
      case '/my-applications': return preloadedMyApplications ?? 0;
      default: return null;
    }
  };

  const getTotalJobsCount = () => {
    const total = (preloadedTotalJobs || 0) + (preloadedSavedJobs || 0) + (preloadedMyApplications || 0);
    return total > 0 ? total : null;
  };

  return (
    <nav className="h-14 flex items-center border-b border-white/20 bg-transparent">
      <div className="w-full max-w-4xl mx-auto px-3 md:px-8 flex items-center justify-between">
      {/* Left side: Logo + Main Nav */}
      <div className="flex items-center gap-1">
        {/* Parium Logo - Home Button */}
        <PariumLogoButton
          onClick={() => handleNavigation('/home')}
          ariaLabel="Gå till startsidan"
        />

        {/* Main Navigation Dropdowns */}
        <div className="relative z-10 flex items-center gap-1">
          {/* Jobb Dropdown */}
          <DropdownMenu open={jobsOpen} onOpenChange={setJobsOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white group"
              >
                <span 
                  className={`absolute inset-0 rounded-lg bg-white transition-opacity duration-150 ${
                    isDropdownActive(jobItems) ? 'opacity-20' : 'opacity-0 group-hover:opacity-10'
                  }`} 
                />
                <Briefcase className="h-4 w-4 relative z-10" />
                <span className="relative z-10">Jobb</span>
                {getTotalJobsCount() && (
                  <span className="text-white text-xs relative z-10">({getTotalJobsCount()})</span>
                )}
                <ChevronDown className="h-3 w-3 text-white relative z-10" />
                {/* Stilren badge för nya jobb-matchningar */}
                {totalNewMatches > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-[16px] rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white text-[9px] font-semibold flex items-center justify-center shadow-lg shadow-red-500/30 z-20">
                    {totalNewMatches > 9 ? '9+' : totalNewMatches}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className={dropdownContentClass}>
              {jobItems.map((item) => {
                const count = getJobCount(item.url);
                const isActive = isActiveUrl(item.url);
                // Show notification badge on Sök Jobb item
                const showNewMatchBadge = item.url === '/search-jobs' && totalNewMatches > 0;
                return (
                  <DropdownMenuItem
                    key={item.url}
                    onClick={() => { handleNavigation(item.url); setJobsOpen(false); }}
                    className={`${dropdownItemClass} ${isActive ? dropdownItemActiveClass : ''}`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.title}</span>
                    {showNewMatchBadge ? (
                      <span className="flex items-center gap-1.5">
                        {count !== null && <span className="text-white/60 text-xs">({count})</span>}
                        <span className="min-w-[16px] h-[16px] rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white text-[9px] font-semibold flex items-center justify-center shadow-sm">
                          {totalNewMatches > 9 ? '9+' : totalNewMatches}
                        </span>
                      </span>
                    ) : (
                      count !== null && <span className="text-white text-xs">({count})</span>
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
            {preloadedJobSeekerUnreadMessages > 0 && (
              <span className="absolute -top-1 -right-1.5 min-w-[16px] h-[16px] rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white text-[9px] font-semibold flex items-center justify-center shadow-lg shadow-red-500/30 z-20">
                {preloadedJobSeekerUnreadMessages > 9 ? '9+' : preloadedJobSeekerUnreadMessages}
              </span>
            )}
          </button>

          {/* Ekonomi Dropdown */}
          <DropdownMenu open={economyOpen} onOpenChange={setEconomyOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white group"
              >
                <span 
                  className={`absolute inset-0 rounded-lg bg-white transition-opacity duration-150 ${
                    isDropdownActive(economyItems) ? 'opacity-20' : 'opacity-0 group-hover:opacity-10'
                  }`} 
                />
                <CreditCard className="h-4 w-4 relative z-10" />
                <span className="relative z-10">Ekonomi</span>
                <ChevronDown className="h-3 w-3 text-white relative z-10" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className={dropdownContentClass}>
              {economyItems.map((item) => {
                const isActive = isActiveUrl(item.url);
                return (
                  <DropdownMenuItem
                    key={item.url}
                    onClick={() => { handleNavigation(item.url); setEconomyOpen(false); }}
                    className={`${dropdownItemClass} ${isActive ? dropdownItemActiveClass : ''}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Support Dropdown */}
          <DropdownMenu open={supportOpen} onOpenChange={setSupportOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white group"
              >
                <span 
                  className={`absolute inset-0 rounded-lg bg-white transition-opacity duration-150 ${
                    isDropdownActive(supportItems) || (isAdmin && isActiveUrl('/admin')) ? 'opacity-20' : 'opacity-0 group-hover:opacity-10'
                  }`} 
                />
                <HelpCircle className="h-4 w-4 relative z-10" />
                <span className="relative z-10">Support</span>
                <ChevronDown className="h-3 w-3 text-white relative z-10" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className={dropdownContentClass}>
              {supportItems.map((item) => {
                const isActive = isActiveUrl(item.url);
                return (
                  <DropdownMenuItem
                    key={item.url}
                    onClick={() => { handleNavigation(item.url); setSupportOpen(false); }}
                    className={`${dropdownItemClass} ${isActive ? dropdownItemActiveClass : ''}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </DropdownMenuItem>
                );
              })}
              {isAdmin && (
                <>
                  <DropdownMenuSeparator className="bg-white/20" />
                  <DropdownMenuItem
                    onClick={() => { handleNavigation('/admin'); setSupportOpen(false); }}
                    className={`${dropdownItemClass} ${isActiveUrl('/admin') ? dropdownItemActiveClass : ''}`}
                  >
                    <Settings className="h-4 w-4" />
                    Admin Panel
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profil Dropdown - after Support, with avatar/video */}
          <DropdownMenu open={profileOpen} onOpenChange={setProfileOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white group"
              >
                <span 
                  className={`absolute inset-0 rounded-lg bg-white transition-opacity duration-150 ${
                    isDropdownActive(profileItems) ? 'opacity-20' : 'opacity-0 group-hover:opacity-10'
                  }`} 
                />
                {/* Trigger always shows cover image (no play icon) - video playback is only in dropdown */}
                {(hasVideo && (coverUrl || avatarUrl)) || avatarUrl ? (
                  <Avatar className="h-7 w-7 ring-2 ring-white/20 relative z-10">
                    <AvatarImage src={coverUrl || avatarUrl || ''} alt={getUserDisplayName()} />
                    <AvatarFallback className="bg-white/20 text-white text-xs font-semibold" delayMs={150}>
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold text-white ring-2 ring-white/20 relative z-10">
                    {getUserInitials()}
                  </div>
                )}
                <ChevronDown className="h-3 w-3 text-white relative z-10" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className={dropdownContentClass + " min-w-[220px]"}>
              {/* User info header */}
              <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/10">
                {hasVideo && videoUrl ? (
                  <ProfileVideo
                    videoUrl={videoUrl}
                    coverImageUrl={coverUrl || avatarUrl || undefined}
                    userInitials={getUserInitials()}
                    alt="Profilvideo"
                    className="h-10 w-10 ring-2 ring-white/20 rounded-full"
                    showCountdown={false}
                    showProgressBar={false}
                  />
                ) : avatarUrl ? (
                  <Avatar className="h-10 w-10 ring-2 ring-white/20">
                    <AvatarImage src={avatarUrl || ''} alt={getUserDisplayName()} />
                    <AvatarFallback className="bg-white/20 text-white text-sm font-semibold" delayMs={150}>
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold text-white ring-2 ring-white/20">
                    {getUserInitials()}
                  </div>
                )}
              <div>
                <p className="text-sm font-medium text-white">{getUserDisplayName()}</p>
                <p className="text-xs text-white">{user?.email}</p>
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
              
              <DropdownMenuSeparator className="bg-white/20" />
              
              <DropdownMenuItem
                onClick={() => { signOut(); setProfileOpen(false); }}
                className={`${dropdownItemClass} text-red-400 hover:text-red-300 hover:bg-red-500/10`}
              >
                <LogOut className="h-4 w-4" />
                Logga ut
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      </div>
    </nav>
  );
}

export default memo(JobSeekerTopNav);
