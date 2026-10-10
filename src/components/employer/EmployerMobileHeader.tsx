import { memo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from '@/hooks/useAuth';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { ReadyProfileAvatar } from '@/components/ReadyProfileAvatar';
import pariumLogoRings from '@/assets/parium-logo-rings.png';
import { resolveCompanyLogoUrl } from '@/lib/companyLogoUrl';

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
    preloadedCompanyLogoUrl || resolveCompanyLogoUrl(profile?.company_logo_url ?? null);
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
          className="h-10 w-12 bg-contain bg-left bg-no-repeat pointer-events-none"
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
  const { user, profile, preloadedAvatarUrl, preloadedCoverUrl } = useAuth();
  const navigate = useNavigate();
  const fallbackCoverUrl = useMediaUrl(
    !preloadedCoverUrl ? profile?.cover_image_url : null,
    'cover-image'
  );
  const fallbackUrl = useMediaUrl(
    (!preloadedAvatarUrl && !preloadedCoverUrl) ? profile?.profile_image_url : null,
    'profile-image'
  );
  const avatarUrl = preloadedCoverUrl || fallbackCoverUrl || preloadedAvatarUrl || fallbackUrl || null;

  return (
    <ReadyProfileAvatar
      src={avatarUrl}
      accountId={user?.id}
      profileReady={!!user && profile?.user_id === user.id}
      onClick={() => navigate('/employer-profile')}
    />
  );
});

EmployerMobileProfileAvatar.displayName = 'EmployerMobileProfileAvatar';
