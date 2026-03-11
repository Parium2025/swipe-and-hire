import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from '@/hooks/useAuth';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import pariumLogoRings from '@/assets/parium-logo-rings.png';

/** Logo that acts as sidebar trigger — same visual as job seeker side */
export const EmployerLogoSidebarTrigger = memo(() => {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      onClick={toggleSidebar}
      className="flex items-center hover:opacity-80 active:scale-[0.97] transition-opacity shrink-0 touch-manipulation"
      aria-label="Öppna meny"
    >
      <div
        role="img"
        aria-label="Parium"
        className="h-10 w-40 bg-contain bg-left bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${pariumLogoRings})` }}
      />
    </button>
  );
});

EmployerLogoSidebarTrigger.displayName = 'EmployerLogoSidebarTrigger';

/** Mobile profile avatar for employer */
export const EmployerMobileProfileAvatar = memo(() => {
  const { profile, preloadedAvatarUrl, preloadedCoverUrl } = useAuth();
  const navigate = useNavigate();
  const fallbackUrl = useMediaUrl(
    (!preloadedAvatarUrl && !preloadedCoverUrl) ? ((profile as any)?.company_logo_url || profile?.profile_image_url) : null,
    'profile-image'
  );
  const avatarUrl = preloadedAvatarUrl || preloadedCoverUrl || fallbackUrl || null;
  
  const initials = (() => {
    const f = profile?.first_name || '';
    const l = profile?.last_name || '';
    if (f && l) return (f[0] + l[0]).toUpperCase();
    if (f) return f.substring(0, 2).toUpperCase();
    return 'AG';
  })();

  return (
    <button
      onClick={() => navigate('/employer-profile')}
      className="flex items-center justify-center"
      aria-label="Min profil"
    >
      {avatarUrl ? (
        <Avatar className="h-8 w-8 ring-2 ring-white/20">
          <AvatarImage src={avatarUrl} alt="Profil" />
          <AvatarFallback className="bg-white/20 text-white text-xs font-semibold" delayMs={150}>
            {initials}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold text-white ring-2 ring-white/20">
          {initials}
        </div>
      )}
    </button>
  );
});

EmployerMobileProfileAvatar.displayName = 'EmployerMobileProfileAvatar';
