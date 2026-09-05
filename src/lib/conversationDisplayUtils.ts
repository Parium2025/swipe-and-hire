import { resolveCandidateMedia } from '@/lib/candidateMedia';
import type { ApplicationSnapshot, ConversationMember, ConversationMessage } from '@/hooks/useConversations';

type LastMessageIdentity = Pick<ConversationMessage, 'sender_id' | 'sender_identity' | 'is_system_message'> & {
  sender_profile?: ConversationMessage['sender_profile'];
};
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
 * Ansökningens ögonblicksbild beskriver ALLTID kandidaten.
 * Den får därför bara användas när motparten är kandidaten (dvs. när
 * arbetsgivaren tittar). När jobbsökaren tittar är motparten företaget —
 * då ska bolagsnamn och företagslogga visas, aldrig kandidatens egna namn.
 */
function snapshotDescribesCounterpart(
  snapshot: ApplicationSnapshot | undefined,
  displayMember: ConversationMember | undefined,
): boolean {
  if (!snapshot) return false;
  return displayMember?.profile?.role !== 'employer';
}


/**
 * När en arbetsgivarmotpart senast skrev ett personligt meddelande (fritext)
 * ska listan och rubriken visa rekryteraren som person — namn och profilbild —
 * i stället för bolaget. Mallar/automatiska utskick fortsätter som bolaget.
 */
function counterpartPersonProfile(
  displayMember: ConversationMember | undefined,
  lastMessage: LastMessageIdentity | undefined,
): ProfileLike | undefined {
  if (!lastMessage || lastMessage.sender_identity !== 'person') return undefined;
  if (lastMessage.is_system_message) return undefined;
  if (!displayMember || displayMember.profile?.role !== 'employer') return undefined;
  if (lastMessage.sender_id !== displayMember.user_id) return undefined;
  const senderProfile = lastMessage.sender_profile ?? displayMember.profile;
  if (!senderProfile) return undefined;
  const personName = buildFullName(senderProfile.first_name, senderProfile.last_name);
  if (!hasText(personName)) return undefined;
  return { ...senderProfile, role: 'employer', company_name: null, company_logo_url: null };
}

/**
 * Get display name for a conversation, preferring frozen application snapshot data.
 */
export function getConversationDisplayName(opts: {
  isGroup: boolean;
  groupName: string | null;
  snapshot: ApplicationSnapshot | undefined;
  displayMember: ConversationMember | undefined;
  isSelf?: boolean;
  lastMessage?: LastMessageIdentity;
}): string {
  const { isGroup, groupName, snapshot, displayMember, isSelf, lastMessage } = opts;

  if (isGroup && groupName) return groupName;

  // Provutskick till dig själv — konversationen har bara dig som medlem.
  if (isSelf) return 'Du (provutskick)';

  // Snapshot is immutable per application context.
  // If snapshot exists, never leak updated live profile identity into conversation UI.
  if (snapshotDescribesCounterpart(snapshot, displayMember)) {
    const snapshotName = buildFullName(snapshot!.first_name, snapshot!.last_name);
    return snapshotName || 'Okänd användare';
  }


  const personProfile = counterpartPersonProfile(displayMember, lastMessage);
  if (personProfile) return buildFullName(personProfile.first_name, personProfile.last_name);

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
 * 1. Snapshot identity (namn) är alltid fryst.
 * 2. Snapshot-foto används när det finns.
 * 3. Saknas snapshot-foto på en ansökan från snapshot-eran (t.ex. kandidatprofil
 *    utan bild) visas initialer — kontots livebild får aldrig läcka in.
 *    Endast äldre ansökningar utan snapshot faller tillbaka på live-profilbilden.
 * 4. Inget alls → undefined
 */
export function getConversationAvatarProfile(
  snapshot: ApplicationSnapshot | undefined,
  displayMember: ConversationMember | undefined,
  lastMessage?: LastMessageIdentity,
): ProfileLike | undefined {
  if (snapshotDescribesCounterpart(snapshot, displayMember)) {
    const liveProfile = displayMember?.profile;
    const liveImage =
      liveProfile && liveProfile.role !== 'employer' ? liveProfile.profile_image_url || null : null;
    return {
      role: 'job_seeker' as const,
      first_name: snapshot!.first_name,
      last_name: snapshot!.last_name,
      company_name: null,
      profile_image_url: resolveCandidateMedia(snapshot!, { profile_image_url: liveImage })
        .profile_image_url,
      company_logo_url: null,
    };
  }



  const personProfile = counterpartPersonProfile(displayMember, lastMessage);
  if (personProfile) return personProfile;

  // No snapshot — use live profile
  if (displayMember?.profile) return displayMember.profile;

  return undefined;
}

/**
 * Get display name from a message sender profile.
 *
 * Ett meddelande skrivs alltid av en person. Även när konversationen som helhet
 * visas som företaget (rubrik/lista) ska själva bubblan visa vem som skrev den —
 * därför föredras personens namn framför bolagsnamnet här.
 */
export function getMessageSenderName(profile: ProfileLike | undefined, useCompanyIdentity = false): string {
  if (!profile) return 'Okänd';
  if (useCompanyIdentity && profile.role === 'employer' && hasText(profile.company_name)) {
    return profile.company_name!;
  }
  const personName = buildFullName(profile.first_name, profile.last_name);
  if (hasText(personName)) return personName;
  if (profile.role === 'employer' && hasText(profile.company_name)) return profile.company_name!;
  return 'Okänd';
}

/**
 * Profil för avsändaravatar i en meddelandebubbla.
 *
 * Konversationens huvudavatar visar företaget (logga), men ett enskilt meddelande
 * ska visa personen som skrev det. Därför rensas bolagsfälten här så att
 * ConversationAvatar faller tillbaka på personens profilbild och initialer.
 */
export function getMessageSenderAvatarProfile(
  profile: ProfileLike | undefined,
  useCompanyIdentity = false,
): ProfileLike | undefined {
  if (!profile) return undefined;
  if (profile.role !== 'employer' || useCompanyIdentity) return profile;
  return { ...profile, company_name: null, company_logo_url: null };
}

/**
 * Resolve which member represents the "other side" of a conversation.
 *
 * En konversation som bara har dig själv som medlem (provutskick via
 * Utskicksstudion) har ingen motpart — då används ditt eget medlemskap så att
 * raden renderas normalt i stället för som en evig skelettplatshållare.
 */
export function resolveDisplayMember(
  members: ConversationMember[] | undefined,
  currentUserId: string | undefined,
): { displayMember: ConversationMember | undefined; isSelf: boolean } {
  const all = members || [];
  const others = all.filter((m) => m.user_id !== currentUserId);
  if (others.length > 0) return { displayMember: others[0], isSelf: false };
  const self = all.find((m) => m.user_id === currentUserId);
  return { displayMember: self, isSelf: !!self };
}
