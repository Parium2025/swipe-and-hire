import type { ApplicationSnapshot, ConversationMember } from '@/hooks/useConversations';
import type { ConversationProfileData as ProfileLike } from '@/types/conversation';

/**
 * Shared display logic for conversations.
 * Eliminates duplication between ConversationItem and ChatView in Messages.tsx.
 *
 * DESIGN INVARIANT: These functions must NEVER return 'Okänd användare' or '··'
 * when ANY data source (snapshot, live profile, or cached profile) has a usable name.
 * The priority chain is: snapshot → live profile → fallback.
 */

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

  // Snapshot is immutable per application context.
  // If snapshot exists, never leak updated live profile identity into conversation UI.
  if (snapshot) {
    const snapshotName = buildFullName(snapshot.first_name, snapshot.last_name);
    return snapshotName || 'Okänd användare';
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
 * Avatar priority (STRICT):
 * 1. Snapshot EXISTS (with or without image) → always use snapshot.
 *    This preserves the frozen state from application time. If the candidate
 *    had no photo when applying, we show initials — NOT their current live photo.
 * 2. No snapshot at all → use live profile
 * 3. Nothing available → undefined
 */
export function getConversationAvatarProfile(
  snapshot: ApplicationSnapshot | undefined,
  displayMember: ConversationMember | undefined,
): ProfileLike | undefined {
  // Snapshot takes FULL priority — frozen identity from application time.
  // Even if snapshot has no names/image, do NOT fall back to live profile.
  if (snapshot) {
    return {
      role: 'job_seeker' as const,
      first_name: snapshot.first_name,
      last_name: snapshot.last_name,
      company_name: null,
      profile_image_url: snapshot.profile_image_snapshot_url || null,
      company_logo_url: null,
    };
  }

  // No snapshot — use live profile
  if (displayMember?.profile) return displayMember.profile;

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
