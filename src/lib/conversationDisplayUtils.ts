import type { ApplicationSnapshot, ConversationMember } from '@/hooks/useConversations';

/**
 * Shared display logic for conversations.
 * Eliminates duplication between ConversationItem and ChatView in Messages.tsx.
 */

interface ProfileLike {
  role?: 'job_seeker' | 'employer';
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  profile_image_url?: string | null;
  company_logo_url?: string | null;
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

  // Frozen name from application snapshot
  if (snapshot && (snapshot.first_name || snapshot.last_name)) {
    return `${snapshot.first_name || ''} ${snapshot.last_name || ''}`.trim();
  }

  if (!displayMember?.profile) return 'Okänd användare';
  const p = displayMember.profile;
  if (p.role === 'employer' && p.company_name) return p.company_name;
  return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Okänd användare';
}

/**
 * Build a profile object for ConversationAvatar, preferring snapshot data for candidates.
 */
export function getConversationAvatarProfile(
  snapshot: ApplicationSnapshot | undefined,
  displayMember: ConversationMember | undefined,
): ProfileLike | undefined {
  // Always prefer snapshot data (names + image) for candidate conversations.
  // This ensures frozen application data is shown even if live profile is unavailable.
  if (snapshot && (snapshot.first_name || snapshot.last_name || snapshot.profile_image_snapshot_url)) {
    return {
      role: 'job_seeker' as const,
      first_name: snapshot.first_name,
      last_name: snapshot.last_name,
      company_name: null,
      profile_image_url: snapshot.profile_image_snapshot_url,
      company_logo_url: null,
    };
  }
  return displayMember?.profile;
}

/**
 * Get display name from a message sender profile.
 */
export function getMessageSenderName(profile: ProfileLike | undefined): string {
  if (!profile) return 'Okänd';
  if (profile.role === 'employer' && profile.company_name) return profile.company_name;
  return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Okänd';
}
