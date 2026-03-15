import type { ApplicationSnapshot, ConversationMember } from '@/hooks/useConversations';

/**
 * Shared display logic for conversations.
 * Eliminates duplication between ConversationItem and ChatView in Messages.tsx.
 *
 * DESIGN INVARIANT: These functions must NEVER return 'Okänd användare' or '··'
 * when ANY data source (snapshot, live profile, or cached profile) has a usable name.
 * The priority chain is: snapshot → live profile → fallback.
 */

interface ProfileLike {
  role?: 'job_seeker' | 'employer';
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  profile_image_url?: string | null;
  company_logo_url?: string | null;
}

/** Strict non-empty text check — rejects null, undefined, and whitespace-only strings. */
function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildFullName(first: string | null | undefined, last: string | null | undefined): string {
  return `${first || ''} ${last || ''}`.trim();
}

/**
 * Get display name for a conversation, preferring frozen application snapshot data.
 */
export function getConversationDisplayName(opts: {
  isGroup: boolean;
  groupName: string | null;
  snapshot: ApplicationSnapshot | undefined;
  displayMember: ConversationMember | undefined;
}): string {
  const { isGroup, groupName, snapshot, displayMember } = opts;

  if (isGroup && groupName) return groupName;

  // Frozen name from application snapshot (strict check)
  if (snapshot && (hasText(snapshot.first_name) || hasText(snapshot.last_name))) {
    return buildFullName(snapshot.first_name, snapshot.last_name);
  }

  if (!displayMember?.profile) return 'Okänd användare';
  const p = displayMember.profile;
  if (p.role === 'employer' && hasText(p.company_name)) return p.company_name!;
  const name = buildFullName(p.first_name, p.last_name);
  return name || 'Okänd användare';
}

/**
 * Build a profile object for ConversationAvatar, preferring snapshot data for candidates.
 *
 * Avatar priority:
 * 1. Snapshot with image → use snapshot (frozen candidate photo)
 * 2. Snapshot with names but no image → use live profile (which may have an image)
 * 3. No snapshot → use live profile
 */
export function getConversationAvatarProfile(
  snapshot: ApplicationSnapshot | undefined,
  displayMember: ConversationMember | undefined,
): ProfileLike | undefined {
  // Only prefer snapshot when it has an actual image to show.
  // This prevents showing empty initials when the live profile has a real photo.
  if (snapshot?.profile_image_snapshot_url) {
    return {
      role: 'job_seeker' as const,
      first_name: snapshot.first_name,
      last_name: snapshot.last_name,
      company_name: null,
      profile_image_url: snapshot.profile_image_snapshot_url,
      company_logo_url: null,
    };
  }

  // If live profile exists, use it (it may have a profile image even if snapshot doesn't)
  if (displayMember?.profile) return displayMember.profile;

  // Last resort: build from snapshot names (no image, but at least correct initials)
  if (snapshot && (hasText(snapshot.first_name) || hasText(snapshot.last_name))) {
    return {
      role: 'job_seeker' as const,
      first_name: snapshot.first_name,
      last_name: snapshot.last_name,
      company_name: null,
      profile_image_url: null,
      company_logo_url: null,
    };
  }

  return undefined;
}

/**
 * Get display name from a message sender profile.
 */
export function getMessageSenderName(profile: ProfileLike | undefined): string {
  if (!profile) return 'Okänd';
  if (profile.role === 'employer' && hasText(profile.company_name)) return profile.company_name!;
  return buildFullName(profile.first_name, profile.last_name) || 'Okänd';
}
