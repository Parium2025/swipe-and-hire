import { memo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from '@/hooks/useAuth';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import pariumLogoRings from '@/assets/parium-logo-rings.png';

/** Logo that acts as sidebar trigger — same visual as job seeker side.
 *  Also keeps the company logo decoded in the background so it appears
 *  instantly when the user opens the sidebar drawer (no empty circle
 *  → logo "pop-in" on first open). The mobile sheet only mounts its
 *  content when opened, so without this warm-up the <img> would be
 *  requested for the first time at that moment. */
export const EmployerLogoSidebarTrigger = memo(() => {
  const { toggleSidebar } = useSidebar();
  const { preloadedCompanyLogoUrl, profile } = useAuth();
  const companyLogoUrl =
    preloadedCompanyLogoUrl || ((profile as any)?.company_logo_url ?? null);
  const warmupRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!companyLogoUrl || !warmupRef.current) return;
    const img = warmupRef.current;
    if (typeof img.decode === 'function') {
      img.decode().catch(() => {});
    }
  }, [companyLogoUrl]);

  return (
    <>
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
      {companyLogoUrl ? (
        <img
          ref={warmupRef}
          src={companyLogoUrl}
          alt=""
          aria-hidden="true"
          decoding="async"
          loading="eager"
          width={40}
          height={40}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: 'none',
            top: 0,
            left: 0,
          }}
        />
      ) : null}
    </>
  );
});

EmployerLogoSidebarTrigger.displayName = 'EmployerLogoSidebarTrigger';

/** Mobile profile avatar for employer — mirrors job seeker structure exactly */
export const EmployerMobileProfileAvatar = memo(() => {
  const { profile, preloadedAvatarUrl, preloadedCoverUrl } = useAuth();
  const navigate = useNavigate();
  const fallbackUrl = useMediaUrl(
    (!preloadedAvatarUrl && !preloadedCoverUrl) ? profile?.profile_image_url : null,
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
      ) : profile ? (
        <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold text-white ring-2 ring-white/20">
          {initials}
        </div>
      ) : (
        <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse ring-2 ring-white/20" />
      )}
    </button>
  );
});

EmployerMobileProfileAvatar.displayName = 'EmployerMobileProfileAvatar';
