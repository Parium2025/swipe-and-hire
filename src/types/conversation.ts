/**
 * Shared profile type used across the messaging system.
 * Single source of truth — avoids duplicated interfaces in
 * conversationDisplayUtils, ConversationAvatar, and useResolvedAvatarUrl.
 */
export interface ConversationProfileData {
  role?: 'job_seeker' | 'employer';
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  profile_image_url?: string | null;
  company_logo_url?: string | null;
}
