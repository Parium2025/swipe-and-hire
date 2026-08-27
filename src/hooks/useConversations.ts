import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { safeSetItem } from '@/lib/safeStorage';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';
import { getIsOnline } from '@/lib/connectivityManager';
import { fetchCachedProfile, fetchCachedProfiles, rateLimited } from '@/lib/performanceGuards';
import { measurePerformance } from '@/lib/realtimePerformance';
import { useAuth } from './useAuth';
import { prefetchMediaUrl } from './useMediaUrl';
import { CHAT_AVATAR_TRANSFORM, MEDIA_URL_TTL } from '@/lib/mediaPresets';
import { toast } from 'sonner';
import { chunk } from '@/lib/fetchAllPages';


export interface ConversationMember {
  user_id: string;
  is_admin: boolean;
  last_read_at: string | null;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    profile_image_url: string | null;
    company_logo_url: string | null;
    role: 'job_seeker' | 'employer';
  };
}

// Frozen profile from job application - used for employer-candidate conversations
export interface ApplicationSnapshot {
  application_id: string;
  first_name: string | null;
  last_name: string | null;
  profile_image_snapshot_url: string | null;
  video_snapshot_url: string | null;
  cv_url: string | null;
  job_title: string | null;
  candidate_profile_label?: string | null;
  applied_at?: string | null;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  edited_at?: string | null;
  is_system_message: boolean;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  sender_profile?: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    profile_image_url: string | null;
    company_logo_url: string | null;
    role: 'job_seeker' | 'employer';
  };
}

export type ConversationKind = 'job' | 'internal';

export interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  job_id: string | null;
  application_id: string | null; // Current job context - updates when switching jobs
  candidate_id: string | null; // The job seeker user ID - one conversation per candidate
  /** 'job' = kandidatchatt, 'internal' = kollegachatt inom organisationen. */
  kind?: ConversationKind;
  organization_id?: string | null;
  created_by: string;
  created_at: string;
  last_message_at: string | null;
  members: ConversationMember[];
  last_message?: ConversationMessage;
  unread_count: number;
  /** True när den inloggade användaren har tystat konversationen (inga notiser, men den syns i inkorgen). */
  is_muted?: boolean;

  job?: {
    title: string;
  };
  // Frozen profile snapshot from current application context (for employer-candidate chats)
  applicationSnapshot?: ApplicationSnapshot;
}

// 🔥 localStorage cache for instant-load
const CONVERSATIONS_CACHE_KEY = 'parium_conversations_cache';
// Bump this version when cache structure changes or when we need to invalidate old data
const CACHE_VERSION = 11; // v11: hide self-conversations (provutskick) from inbox

interface CachedConversations {
  userId: string;
  conversations: Conversation[];
  timestamp: number;
  version?: number;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasUnknownIdentityForConversation(conv: Conversation, userId: string): boolean {
  if (conv.is_group) return false;

  const hasSnapshotName = hasText(conv.applicationSnapshot?.first_name) || hasText(conv.applicationSnapshot?.last_name);

  // Självkonversation (provutskick till dig själv) har ingen motpart — det är
  // ett giltigt tillstånd, inte en trasig identitet.
  const members = conv.members || [];
  const otherMember = members.find((m) => m.user_id !== userId);
  if (!otherMember) return members.some((m) => m.user_id === userId) ? false : true;

  const profile = otherMember.profile;
  const hasProfileName =
    hasText(profile?.company_name) ||
    hasText(profile?.first_name) ||
    hasText(profile?.last_name);

  return !hasSnapshotName && !hasProfileName;
}

function hasUnknownConversationIdentity(conversations: Conversation[], userId: string): boolean {
  return conversations.some((conv) => hasUnknownIdentityForConversation(conv, userId));
}

function readConversationsCacheForRecovery(userId: string): Conversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_CACHE_KEY);
    if (!raw) return [];
    const cached: CachedConversations = JSON.parse(raw);
    if (cached.userId !== userId) return [];
    if (!cached.version || cached.version < CACHE_VERSION) return [];
    return Array.isArray(cached.conversations) ? cached.conversations : [];
  } catch {
    return [];
  }
}

function readConversationsCache(userId: string): Conversation[] | null {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedConversations = JSON.parse(raw);
    if (!cached || cached.userId !== userId) return null;
    if (!cached.version || cached.version < CACHE_VERSION) {
      localStorage.removeItem(CONVERSATIONS_CACHE_KEY);
      return null;
    }
    if (!Array.isArray(cached.conversations)) {
      try { localStorage.removeItem(CONVERSATIONS_CACHE_KEY); } catch { /* ignore */ }
      return null;
    }
    if (cached.conversations.length === 0) return null;

    // Non-aggressive cache policy: return all cached conversations.
    // Unknown identity should be solved by recovery/refetch, not by hiding rows.
    return cached.conversations;
  } catch {
    try { localStorage.removeItem(CONVERSATIONS_CACHE_KEY); } catch { /* ignore */ }
    return null;
  }
}

function writeConversationsCache(userId: string, conversations: Conversation[]): void {
  try {
    const cached: CachedConversations = {
      userId,
      conversations: conversations.slice(0, 50), // Max 50 to save space
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    safeSetItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Storage full
  }
}

function mergeConversationsWithLastKnownIdentity(
  conversations: Conversation[],
  previousConversations: Conversation[],
  userId: string,
): Conversation[] {
  if (previousConversations.length === 0) return conversations;

  const previousById = new Map(previousConversations.map((conv) => [conv.id, conv]));

  return conversations.map((conv) => {
    const previous = previousById.get(conv.id);
    if (!previous) return conv;

    let merged = conv;

    if (hasUnknownIdentityForConversation(merged, userId) && !hasUnknownIdentityForConversation(previous, userId)) {
      const previousMembersById = new Map((previous.members || []).map((member) => [member.user_id, member]));
      const mergedMembers = (merged.members || []).map((member) => {
        if (member.profile) return member;
        const previousProfile = previousMembersById.get(member.user_id)?.profile;
        return previousProfile ? { ...member, profile: previousProfile } : member;
      });

      const hasOtherMember = mergedMembers.some((member) => member.user_id !== userId);
      const previousHasOtherMember = (previous.members || []).some((member) => member.user_id !== userId);

      merged = {
        ...merged,
        members: !hasOtherMember && previousHasOtherMember ? previous.members : mergedMembers,
        applicationSnapshot: merged.applicationSnapshot ?? previous.applicationSnapshot,
      };
    }

    if (!merged.last_message && previous.last_message) {
      merged = {
        ...merged,
        last_message: previous.last_message,
        last_message_at: merged.last_message_at ?? previous.last_message_at,
      };
    }

    return merged;
  });
}

// Vilken konversation som är öppen just nu — används för att inte räkna upp
// olästa för en chatt användaren tittar på (och för att undvika dubbelräkning
// mellan den globala kanalen och konversationskanalen).
let activeConversationId: string | null = null;

// Minimal shape of a realtime INSERT on conversation_messages
export interface IncomingRealtimeMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_system_message?: boolean;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
}

/**
 * Patch the conversation list cache in-place for one incoming message.
 * Returns false when the conversation is unknown (then the caller should refetch).
 * This keeps bulk sends (tusentals meddelanden/inbjudningar) från att trigga
 * en full omhämtning per event.
 */
export function applyIncomingMessageToConversations(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  msg: IncomingRealtimeMessage,
  options: { incrementUnread: boolean }
): boolean {
  const key = ['conversations', userId];
  const current = queryClient.getQueryData<Conversation[]>(key);
  if (!current || current.length === 0) return false;

  const idx = current.findIndex((c) => c.id === msg.conversation_id);
  if (idx === -1) return false;

  const existing = current[idx];

  // Ignorera out-of-order/duplicerade events
  if (existing.last_message?.id === msg.id) return true;
  if (
    existing.last_message_at &&
    new Date(msg.created_at).getTime() < new Date(existing.last_message_at).getTime()
  ) {
    return true;
  }

  const isOwn = msg.sender_id === userId;
  const shouldCount = options.incrementUnread && !isOwn;

  const updated: Conversation = {
    ...existing,
    last_message_at: msg.created_at,
    last_message: {
      id: msg.id,
      conversation_id: msg.conversation_id,
      sender_id: msg.sender_id,
      content: msg.content,
      created_at: msg.created_at,
      is_system_message: msg.is_system_message ?? false,
      attachment_url: msg.attachment_url ?? null,
      attachment_type: msg.attachment_type ?? null,
      attachment_name: msg.attachment_name ?? null,
      sender_profile: existing.members?.find((m) => m.user_id === msg.sender_id)?.profile,
    },
    unread_count: shouldCount ? (existing.unread_count || 0) + 1 : existing.unread_count || 0,
  };

  const next = [...current];
  next[idx] = updated;
  // Håll listan sorterad på senaste aktivitet
  next.sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });

  queryClient.setQueryData<Conversation[]>(key, next);
  return true;
}

/**
 * Hur många konversationer som laddas per svep. Inget hårt tak längre —
 * listan växer med 300 åt gången när användaren scrollar mot slutet.
 */
const CONVERSATIONS_PAGE_SIZE = 300;
/** Max antal id:n per `in()`-filter så URL:en aldrig blir för lång. */
const ID_CHUNK = 100;

export function useConversations() {

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const identityRecoveryTriggeredRef = useRef(false);

  // Växande fönster: queryKey hålls oförändrad (['conversations', userId])
  // eftersom hela appen skriver direkt mot den nyckeln. Gränsen läses via ref
  // så att queryFn alltid ser aktuellt värde.
  const listLimitRef = useRef(CONVERSATIONS_PAGE_SIZE);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);

  // Fetch all conversations for current user
  const conversationsQuery = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // 🚨 Tidigare hämtades ALLA medlemsrader först och därefter
      // `conversations` med `.in(<alla id>)`. PostgREST kapar tyst vid 1000
      // rader — en arbetsgivare med >1000 chattar tappade konversationer, och
      // medlemsuppslaget (2+ rader per chatt) kapades redan runt 500 chattar
      // vilket gav "Okänd användare". Nu styr `conversations` urvalet:
      // RLS begränsar redan till chattar användaren är medlem i, så vi kan
      // sortera nyast först och hämta ett växande fönster.
      const limit = listLimitRef.current;
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select(`
          *,
          job:job_id (title)
        `)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(limit);

      setHasMoreConversations((conversations?.length ?? 0) >= limit);


      if (convError) throw convError;

      if (!conversations || conversations.length === 0) {
        // Avoid flash-to-empty on transient backend hiccups.
        const previous = queryClient.getQueryData<Conversation[]>(['conversations', user.id]);
        if (previous && previous.length > 0) return previous;

        const cached = readConversationsCache(user.id);
        if (cached && cached.length > 0) return cached;

        return [];
      }

      const conversationIds = conversations.map((c) => c.id);

      // Egna medlemsrader (läsmarkering, tystning) — chunkat så URL:en aldrig
      // blir för lång och radtaket aldrig nås.
      const memberships: Array<{
        conversation_id: string;
        last_read_at: string | null;
        muted_at?: string | null;
        manually_unread?: boolean | null;
      }> = [];
      for (const idChunk of chunk(conversationIds, ID_CHUNK)) {
        const { data, error: memberError } = await supabase
          .from('conversation_members')
          .select('conversation_id, last_read_at, muted_at, manually_unread')
          .eq('user_id', user.id)
          .in('conversation_id', idChunk);
        if (memberError) throw memberError;
        memberships.push(...((data || []) as typeof memberships));
      }

      const mutedIds = new Set(
        memberships.filter((m) => m.muted_at).map((m) => m.conversation_id),
      );



      // Gather last-known-good identities from cache + current query data for merge/recovery.
      // Deduplicate by conversation ID (prefer query data over stale cache).
      const cacheConvs = readConversationsCacheForRecovery(user.id);
      const queryConvs = queryClient.getQueryData<Conversation[]>(['conversations', user.id]) || [];
      const seenIds = new Set<string>();
      const previousConversations: Conversation[] = [];
      for (const conv of [...queryConvs, ...cacheConvs]) {
        if (!seenIds.has(conv.id)) {
          seenIds.add(conv.id);
          previousConversations.push(conv);
        }
      }

      // Get application_ids for conversations that have them
      const applicationIds = conversations
        .map((c) => c.application_id)
        .filter((id): id is string => id !== null);

      // Fetch application snapshots for frozen profile data
      const applicationSnapshotMap = new Map<string, ApplicationSnapshot>();
      for (const idChunk of chunk(applicationIds, ID_CHUNK)) {
        const { data: applications, error: applicationsError } = await supabase
          .from('job_applications')
          .select(`
            id,
            first_name,
            last_name,
            profile_image_snapshot_url,
            video_snapshot_url,
            candidate_profile_label,
            applied_at,
            cv_url,
            job:job_id (title)
          `)
          .in('id', idChunk);

        if (applicationsError) throw applicationsError;

        (applications || []).forEach((app) => {
          applicationSnapshotMap.set(app.id, {
            application_id: app.id,
            first_name: app.first_name,
            last_name: app.last_name,
            profile_image_snapshot_url: app.profile_image_snapshot_url,
            candidate_profile_label: (app as any).candidate_profile_label ?? null,
            applied_at: (app as any).applied_at ?? null,
            video_snapshot_url: app.video_snapshot_url,
            cv_url: app.cv_url,
            job_title: (app.job as any)?.title || null,
          });
        });
      }


      // Fetch all members for these conversations.
      // Chunkat: 2+ rader per konversation gjorde att ett enda `.in()` slog i
      // 1000-raderstaket redan runt 500 chattar → medlemmar saknades och
      // motparten visades som "Okänd användare".
      const allMembers: Array<{
        conversation_id: string;
        user_id: string;
        is_admin: boolean | null;
        last_read_at: string | null;
      }> = [];
      for (const idChunk of chunk(conversationIds, ID_CHUNK)) {
        const { data, error: membersError } = await supabase
          .from('conversation_members')
          .select('conversation_id, user_id, is_admin, last_read_at')
          .in('conversation_id', idChunk);
        if (membersError) throw membersError;
        allMembers.push(...((data || []) as typeof allMembers));
      }


      // Get unique user IDs to fetch profiles
      const allUserIds = [...new Set((allMembers || []).map((m) => m.user_id))];

      // Profiles are CRITICAL for identity — if this fails, React Query will retry (retry: 2).
      // Never silently swallow profile errors — that causes "Okänd användare".
      const profileMap = await fetchCachedProfiles(allUserIds);

      // 🔥 Use efficient DB function instead of fetching ALL messages
      // This scales to millions of messages - only returns latest + unread count per conversation
      // Summaries are best-effort — conversations still show without last message preview
      let summaries: any[] = [];
      try {
        const { data: summariesData, error: summariesError } = await supabase
          .rpc('get_conversation_summaries', {
            p_user_id: user.id,
            // Begränsa till de konversationer vi faktiskt visar — annars kan
            // RPC:ns 1000-radersgräns kapa bort förhandsvisningar för
            // användare med väldigt många chattar.
            p_conversation_ids: conversationIds,
          });

        if (!summariesError && summariesData) {
          summaries = summariesData;
        }
      } catch {
        // Non-fatal
      }

      const lastMessageMap = new Map<string, ConversationMessage>();
      const unreadCounts = new Map<string, number>();

      // Initialize unread counts
      conversationIds.forEach((id) => unreadCounts.set(id, 0));

      (summaries || []).forEach((s: any) => {
        if (s.last_message_content) {
          lastMessageMap.set(s.conversation_id, {
            id: `summary-${s.conversation_id}`,
            conversation_id: s.conversation_id,
            sender_id: s.last_message_sender_id,
            content: s.last_message_content,
            created_at: s.last_message_created_at,
            is_system_message: s.last_message_is_system || false,
            sender_profile: profileMap.get(s.last_message_sender_id) || undefined,
          });
        }
        unreadCounts.set(s.conversation_id, Number(s.unread_count) || 0);
      });

      // Tyst spärr: konversationer med aktivt blockerade motparter döljs helt.
      const { data: activeBlocks } = await supabase
        .from('conversation_blocks')
        .select('blocked_id')
        .is('released_at', null);
      const blockedUserIds = new Set((activeBlocks || []).map((b) => b.blocked_id));
      const hiddenConversationIds = new Set(
        (allMembers || [])
          .filter((m) => m.user_id !== user.id && blockedUserIds.has(m.user_id))
          .map((m) => m.conversation_id),
      );

      // Build final conversation objects
      const result = conversations
        .filter((c) => !hiddenConversationIds.has(c.id))
        .filter((c) => {
          // Provutskick till sig själv (du är enda medlemmen) ska aldrig synas i inkorgen.
          const memberIds = (allMembers || [])
            .filter((m) => m.conversation_id === c.id)
            .map((m) => m.user_id);
          return memberIds.length === 0 || memberIds.some((id) => id !== user.id);
        })
        .map((conv) => {
        const members = (allMembers || [])
          .filter((m) => m.conversation_id === conv.id)
          .map((m) => ({
            ...m,
            profile: profileMap.get(m.user_id),
          }));

        return {
          ...conv,
          members,
          last_message: lastMessageMap.get(conv.id),
          unread_count: unreadCounts.get(conv.id) || 0,
          is_muted: mutedIds.has(conv.id),

          // Include frozen profile snapshot from application if available
          applicationSnapshot: conv.application_id
            ? applicationSnapshotMap.get(conv.application_id)
            : undefined,
        } as Conversation;
      });

      const repairedResult = mergeConversationsWithLastKnownIdentity(result, previousConversations, user.id);

      // Never persist a payload that would render "Okänd användare"
      if (!hasUnknownConversationIdentity(repairedResult, user.id)) {
        writeConversationsCache(user.id, repairedResult);
      }

      // 🔥 Prefetch avatars for all conversation members AND snapshots (eliminates flicker)
      repairedResult.forEach((conv) => {
        // Prefetch snapshot image if available (frozen candidate profile photo)
        if (conv.applicationSnapshot?.profile_image_snapshot_url) {
          void prefetchMediaUrl(conv.applicationSnapshot.profile_image_snapshot_url, 'profile-image', MEDIA_URL_TTL, CHAT_AVATAR_TRANSFORM).catch(() => {});
        }
        (conv.members || []).forEach((member) => {
          if (member.user_id !== user.id && member.profile) {
            const isEmployer = member.profile.role === 'employer';
            const storagePath = isEmployer && member.profile.company_logo_url
              ? member.profile.company_logo_url
              : member.profile.profile_image_url;
            if (storagePath) {
              if (isEmployer) {
                void prefetchMediaUrl(storagePath, 'company-logo').catch(() => {});
              } else {
                void prefetchMediaUrl(storagePath, 'profile-image', MEDIA_URL_TTL, CHAT_AVATAR_TRANSFORM).catch(() => {});
              }
            }
          }
        });
      });

      return repairedResult;
    },
    enabled: !!user,
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    retry: 2,
    // Keep showing previous successful data during refetches — prevents flash-to-empty
    placeholderData: (previousData: Conversation[] | undefined) => previousData,
    // 🔥 Instant-load from localStorage cache
    initialData: () => {
      if (!user) return undefined;
      const cached = readConversationsCache(user.id);
      return cached ?? undefined;
    },
    initialDataUpdatedAt: () => {
      if (!user) return undefined;
      const cached = readConversationsCache(user.id);
      return cached ? Date.now() - 60000 : undefined;
    },
  });

  // Recovery path: if a stale in-memory state still resolves to unknown identity, force one refetch.
  useEffect(() => {
    if (!user || !conversationsQuery.data || conversationsQuery.isFetching) return;

    const hasUnknownIdentity = hasUnknownConversationIdentity(conversationsQuery.data, user.id);

    if (hasUnknownIdentity && !identityRecoveryTriggeredRef.current) {
      identityRecoveryTriggeredRef.current = true;
      conversationsQuery.refetch();
      return;
    }

    if (!hasUnknownIdentity) {
      identityRecoveryTriggeredRef.current = false;
    }
  }, [user, conversationsQuery.data, conversationsQuery.isFetching, conversationsQuery.refetch]);

  // Avatar prefetch is handled inside queryFn — no duplicate useEffect needed

  // Stabil nyckel av användarens konversations-id:n. Används för att sätta ett
  // SERVER-SIDE filter på meddelandekanalen — utan det skulle varje
  // conversation_messages-INSERT i hela plattformen skickas till varje ansluten
  // klient (RLS utvärderas per prenumerant → O(klienter × meddelanden)).
  const conversationIdsKey = useMemo(() => {
    const ids = (conversationsQuery.data || []).map((c) => c.id);
    return Array.from(new Set(ids)).sort().join(',');
  }, [conversationsQuery.data]);

  // Subscribe to realtime updates for new messages
  // Debounced to prevent refetch storms at scale (1M+ users)
  useEffect(() => {
    if (!user) return;

    const idList = conversationIdsKey ? conversationIdsKey.split(',') : [];
    const knownIds = new Set(idList);
    // Postgres-filter har en längdgräns; över 100 id:n faller vi tillbaka på
    // ofiltrerad kanal + klientfiltrering (extremfall).
    const messageFilter =
      idList.length > 0 && idList.length <= 100
        ? `conversation_id=in.(${idList.join(',')})`
        : undefined;

    const channel = createRealtimeChannel('conversations-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          ...(messageFilter ? { filter: messageFilter } : {}),
        },

        (payload) => {
          const msg = payload.new as IncomingRealtimeMessage;
          if (!msg?.conversation_id) return;
          // Klientspärr när kanalen gick ofiltrerad (>100 konversationer).
          if (!messageFilter && knownIds.size > 0 && !knownIds.has(msg.conversation_id)) return;



          // 1) Snabbaste vägen: patcha listan i minnet (ingen nätverksrundtur).
          //    Vid bulkutskick (tusentals meddelanden) blir detta O(1) per event
          //    istället för en full omhämtning.
          const patched = applyIncomingMessageToConversations(queryClient, user.id, msg, {
            incrementUnread: msg.conversation_id !== activeConversationId,
          });

          if (patched) return;

          // 2) Okänd konversation (ny chatt/inbjudan) → coalescad omhämtning.
          //    Debounce 400 ms, men aldrig längre än 2 s även vid konstant flöde.
          if (!maxWaitRef.current) {
            maxWaitRef.current = setTimeout(() => {
              maxWaitRef.current = null;
              if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
              }
              queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
            }, 2000);
          }

          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            debounceRef.current = null;
            if (maxWaitRef.current) {
              clearTimeout(maxWaitRef.current);
              maxWaitRef.current = null;
            }
            queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
          }, 400);
        }
      )
      // 🔄 Multi-device-synk: läsmarkering, tystning och borttagning av
      //    egna medlemsrader speglas direkt på alla inloggade enheter.
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_members',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            conversation_id?: string;
            last_read_at?: string | null;
            muted_at?: string | null;
            manually_unread?: boolean | null;
          };
          if (!row?.conversation_id) return;

          queryClient.setQueryData<Conversation[]>(['conversations', user.id], (prev) => {
            if (!prev) return prev;
            return prev.map((conv) => {
              if (conv.id !== row.conversation_id) return conv;
              const lastMessageAt = conv.last_message?.created_at || conv.last_message_at;
              const isRead =
                !row.manually_unread &&
                !!row.last_read_at &&
                (!lastMessageAt || new Date(row.last_read_at) >= new Date(lastMessageAt));
              return {
                ...conv,
                is_muted: !!row.muted_at,
                unread_count: isRead ? 0 : conv.unread_count,
              };
            });
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'conversation_members',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.old as { conversation_id?: string };
          if (!row?.conversation_id) return;
          queryClient.setQueryData<Conversation[]>(['conversations', user.id], (prev) =>
            prev ? prev.filter((conv) => conv.id !== row.conversation_id) : prev
          );
        }
      )
      // ➕ Nya konversationer: eftersom meddelandekanalen nu är filtrerad på
      //    kända id:n måste vi fånga när användaren läggs till i en ny chatt,
      //    annars syns första meddelandet inte förrän nästa omhämtning.
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_members',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
        }
      )
      .subscribe();


    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (maxWaitRef.current) clearTimeout(maxWaitRef.current);
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, conversationIdsKey]);


  // Total unread count across all conversations
  const totalUnreadCount = conversationsQuery.data?.reduce((sum, c) => sum + c.unread_count, 0) || 0;

  // Synka sessionStorage så att fallback i AppSidebar/TopNav är korrekt
  // vid nästa sidladdning innan context hunnit hämta data.
  // ⚠️ Skriv ENDAST när vi har en färdig query (inte mid-refetch) OCH datan
  // faktiskt har unread_count-fältet beräknat. Annars riskerar vi att skriva
  // 0 vid tab-refocus → badgen flimrar.
  useEffect(() => {
    if (!conversationsQuery.data || conversationsQuery.isFetching) return;
    const hasComputedUnread = conversationsQuery.data.some(
      (c) => typeof c.unread_count === 'number'
    );
    if (!hasComputedUnread && conversationsQuery.data.length > 0) return;
    try {
      sessionStorage.setItem('parium_job_seeker_unread_messages', String(totalUnreadCount));
      sessionStorage.setItem('parium_unread_messages', String(totalUnreadCount));
    } catch {}
  }, [totalUnreadCount, conversationsQuery.data, conversationsQuery.isFetching]);

  // Ladda nästa fönster (300 till). Anropas när listan scrollas mot slutet.
  const refetchConversations = conversationsQuery.refetch;
  const loadMoreConversations = useCallback(async () => {
    if (!user || loadingMoreConversations || !hasMoreConversations) return;
    setLoadingMoreConversations(true);
    listLimitRef.current += CONVERSATIONS_PAGE_SIZE;
    try {
      await refetchConversations();
    } finally {
      setLoadingMoreConversations(false);
    }
  }, [user, loadingMoreConversations, hasMoreConversations, refetchConversations]);

  return {
    conversations: conversationsQuery.data || [],
    isLoading: conversationsQuery.isLoading,
    totalUnreadCount,
    refetch: conversationsQuery.refetch,
    hasMoreConversations,
    loadingMoreConversations,
    loadMoreConversations,
  };

}

const MESSAGES_PAGE_SIZE = 200;

export function useConversationMessages(conversationId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // Synkron spärr: scroll-eventet kan trigga flera anrop innan React
  // hunnit rendera om med loadingOlder=true.
  const loadingOlderRef = useRef(false);
  const prevConversationIdRef = useRef(conversationId);


  // Reset hasMore synchronously when conversation changes (before render)
  if (conversationId !== prevConversationIdRef.current) {
    prevConversationIdRef.current = conversationId;
    setHasMore(false);
  }

  const messagesQuery = useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      // Fetch latest messages with a reasonable limit to prevent memory issues
      const { data: messages, error } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PAGE_SIZE);

      if (error) throw error;
      if (!messages || messages.length === 0) {
        setHasMore(false);
        return [];
      }

      // If we got fewer than the page size, there are no older messages
      setHasMore(messages.length >= MESSAGES_PAGE_SIZE);

      // Reverse to get chronological order (we fetched newest-first for the LIMIT to work correctly)
      messages.reverse();

      // Fetch sender profiles
      const senderIds = [...new Set(messages.map(m => m.sender_id))];

      const profileMap = await fetchCachedProfiles(senderIds);

      return messages.map(msg => ({
        ...msg,
        sender_profile: profileMap.get(msg.sender_id),
      })) as ConversationMessage[];
    },
    enabled: !!conversationId,
    gcTime: 30 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  // Load older messages (prepend to existing)
  const fetchOlderMessages = useCallback(async () => {
    if (!conversationId || loadingOlder || !hasMore) return;

    const currentMessages = queryClient.getQueryData<ConversationMessage[]>(
      ['conversation-messages', conversationId]
    );
    if (!currentMessages || currentMessages.length === 0) return;

    const oldestTimestamp = currentMessages[0].created_at;
    setLoadingOlder(true);

    try {
      const { data: olderMessages, error } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .lt('created_at', oldestTimestamp)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PAGE_SIZE);

      if (error) throw error;

      if (!olderMessages || olderMessages.length === 0) {
        setHasMore(false);
        return;
      }

      setHasMore(olderMessages.length >= MESSAGES_PAGE_SIZE);

      // Reverse to chronological order
      olderMessages.reverse();

      // Fetch sender profiles for older messages
      const newSenderIds = [...new Set(olderMessages.map(m => m.sender_id))];
      const profileMap = await fetchCachedProfiles(newSenderIds);

      const enrichedOlder = olderMessages.map(msg => ({
        ...msg,
        sender_profile: profileMap.get(msg.sender_id),
      })) as ConversationMessage[];

      // Prepend older messages to cache
      queryClient.setQueryData<ConversationMessage[]>(
        ['conversation-messages', conversationId],
        (old) => [...enrichedOlder, ...(old || [])]
      );
    } catch (error) {
      console.error('Failed to load older messages:', error);
      toast.error('Kunde inte ladda äldre meddelanden');
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, loadingOlder, hasMore, queryClient]);

  // Subscribe to realtime messages for this conversation - instant cache update
  useEffect(() => {
    if (!conversationId || !user) return;

    activeConversationId = conversationId;

    const channel = createRealtimeChannel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            content: string;
            created_at: string;
            is_system_message: boolean;
          };

          // For own messages: check if it was already added optimistically.
          if (newMessage.sender_id === user.id) {
            const currentMessages = queryClient.getQueryData<ConversationMessage[]>(
              ['conversation-messages', conversationId]
            );
            const alreadyExists = currentMessages?.some(
              m => m.id === newMessage.id
            );
            if (alreadyExists) return;
          }

          // Fetch sender profile through shared cache to avoid one profile read per realtime event burst
          const senderProfile = await fetchCachedProfile(newMessage.sender_id);

          // Add message directly to cache - instant update!
          queryClient.setQueryData<ConversationMessage[]>(
            ['conversation-messages', conversationId],
            (old) => {
              if (!old) return [{ ...newMessage, sender_profile: senderProfile || undefined }];
              
              // Check if message already exists by real ID
              if (old.some(m => m.id === newMessage.id)) return old;

              // For own messages: replace temp placeholder if it exists
              if (newMessage.sender_id === user.id) {
                const tempIdx = old.findIndex(m => m.id.startsWith('temp-') && m.content === newMessage.content);
                if (tempIdx !== -1) {
                  const updated = [...old];
                  updated[tempIdx] = { ...newMessage, sender_profile: senderProfile || undefined };
                  return updated;
                }
              }
              
              return [...old, { ...newMessage, sender_profile: senderProfile || undefined }];
            }
          );

          // Also update conversation list to show new last message (utan refetch)
          const patched = applyIncomingMessageToConversations(queryClient, user.id, newMessage, {
            incrementUnread: false,
          });
          if (!patched) {
            queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as {
            id: string;
            content: string;
            edited_at: string | null;
          };

          // Update the edited message in cache for real-time sync
          queryClient.setQueryData<ConversationMessage[]>(
            ['conversation-messages', conversationId],
            (old) => old?.map(m =>
              m.id === updated.id
                ? { ...m, content: updated.content, edited_at: updated.edited_at }
                : m
            ) || []
          );
        }
      )
      .subscribe();

    return () => {
      if (activeConversationId === conversationId) activeConversationId = null;
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, queryClient]);

  // Mark conversation as read (optimistic — badge nollställs direkt)
  const markAsRead = useCallback(async () => {
    if (!conversationId || !user) return;

    // Optimistisk uppdatering: nollställ unread_count för denna konversation
    // i cache så badgar i sidebar/topnav/Messages uppdateras omedelbart.
    queryClient.setQueryData<Conversation[]>(
      ['conversations', user.id],
      (prev) => {
        if (!prev) return prev;
        const next = prev.map((c) =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        );
        // Synka sessionStorage-cachen som AppSidebar/TopNav faller tillbaka på
        // vid nästa sidladdning, annars visas gammalt värde innan context hunnit hämta.
        try {
          const total = next.reduce((sum, c) => sum + (c.unread_count || 0), 0);
          sessionStorage.setItem('parium_job_seeker_unread_messages', String(total));
          sessionStorage.setItem('parium_unread_messages', String(total));
        } catch {}
        return next;
      }
    );

    if (!getIsOnline()) return; // Silent fail for mark as read - non-critical

    try {
      await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString(), manually_unread: false } as never)
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
    } catch (err) {
      // Non-critical: log but don't block UX
      console.warn('markAsRead failed:', err);
    }
  }, [conversationId, user, queryClient]);

  // Edit an existing message
  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!conversationId || !user || !newContent.trim()) return;

    const trimmed = newContent.trim();

    // Optimistic update
    queryClient.setQueryData<ConversationMessage[]>(
      ['conversation-messages', conversationId],
      (old) => old?.map(m => m.id === messageId ? { ...m, content: trimmed, edited_at: new Date().toISOString() } : m) || []
    );

    try {
      const { error } = await (supabase
        .from('conversation_messages') as any)
        .update({ content: trimmed, edited_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('sender_id', user.id); // Security: only own messages

      if (error) throw error;
    } catch (error) {
      // Rollback: refetch from DB
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
      throw error;
    }
  }, [conversationId, user, queryClient]);

  // Send message with optimistic update - instant UI feedback
  const sendMessage = useCallback(async (
    content: string,
    attachment?: { url: string; type: string; name: string },
  ) => {
    if (!conversationId || !user || (!content.trim() && !attachment)) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ConversationMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
      created_at: new Date().toISOString(),
      is_system_message: false,
      attachment_url: attachment?.url || null,
      attachment_type: attachment?.type || null,
      attachment_name: attachment?.name || null,
      sender_profile: undefined,
    };

    // Add message to cache immediately (optimistic)
    queryClient.setQueryData<ConversationMessage[]>(
      ['conversation-messages', conversationId],
      (old) => [...(old || []), optimisticMessage]
    );

    try {
      const { data, error } = await rateLimited(`send-message-${conversationId}-${user.id}`, 350, async () => measurePerformance('chat', () => supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content.trim(),
          ...(attachment ? {
            attachment_url: attachment.url,
            attachment_type: attachment.type,
            attachment_name: attachment.name,
          } : {}),
        })
        .select()
        .single()));

      if (error) throw error;

      // Replace temp message with real one
      queryClient.setQueryData<ConversationMessage[]>(
        ['conversation-messages', conversationId],
        (old) => old?.map(m => m.id === tempId ? { ...data, sender_profile: optimisticMessage.sender_profile } : m) || []
      );

      // Update last read
      await markAsRead();
    } catch (error) {
      // Rollback on error
      queryClient.setQueryData<ConversationMessage[]>(
        ['conversation-messages', conversationId],
        (old) => old?.filter(m => m.id !== tempId) || []
      );
      // Blockerad relation → meddelandet sparas aldrig. Var tydlig i stället för generiskt fel.
      const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? '');
      if (message.includes('CONVERSATION_BLOCKED')) {
        toast.error('Meddelandet kunde inte skickas', {
          description: 'Konversationen är blockerad. Inga meddelanden levereras mellan er.',
        });
      }
      throw error;
    }

  }, [conversationId, user, markAsRead, queryClient]);

  return {
    messages: messagesQuery.data || [],
    isLoading: messagesQuery.isLoading,
    isError: messagesQuery.isError,
    sendMessage,
    editMessage,
    markAsRead,
    refetch: messagesQuery.refetch,
    fetchOlderMessages,
    hasMore,
    loadingOlder,
  };
}

// Create or find unified conversation per candidate
// One thread per candidate - job context can change with system messages
export function useCreateConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      memberIds, 
      name, 
      isGroup = false,
      jobId = null,
      applicationId = null,
      initialMessage,
      kind = 'job',
    }: {
      memberIds: string[];
      name?: string;
      isGroup?: boolean;
      jobId?: string | null;
      applicationId?: string | null;
      initialMessage?: string;
      /** 'internal' = kollegachatt inom organisationen (aldrig kopplad till kandidat/annons). */
      kind?: ConversationKind;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const isInternal = kind === 'internal';

      // Interna samtal kräver organisation — hämtas en gång och används både
      // för att hitta befintlig tråd och för att skapa en ny.
      let organizationId: string | null = null;
      if (isInternal) {
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('organization_id')
          .eq('user_id', user.id)
          .not('organization_id', 'is', null)
          .maybeSingle();
        organizationId = roleRow?.organization_id ?? null;
        if (!organizationId) {
          throw new Error('Du tillhör ingen organisation — interna chattar kräver ett team.');
        }
      }

      const candidateId = memberIds[0]; // The job seeker
      let conversationId: string | null = null;
      let isExisting = false;
      let needsJobContextSwitch = false;
      let previousApplicationId: string | null = null;

      // For 1-1 chats, look for existing unified conversation with this candidate
      // IMPORTANT: Must scope to conversations the current user is a member of,
      // otherwise two different employers messaging the same candidate would share a thread!
      if (!isGroup && memberIds.length === 1) {
        // First get conversation IDs the current user belongs to
        const { data: myMemberships } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', user.id);

        const myConvIds = myMemberships?.map(m => m.conversation_id) || [];

        if (myConvIds.length > 0 && !isInternal) {
          const { data: existingByCandidate } = await supabase
            .from('conversations')
            .select('id, application_id')
            .eq('candidate_id', candidateId)
            .not('candidate_id', 'is', null)
            .eq('kind', 'job')
            .in('id', myConvIds)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingByCandidate) {
            conversationId = existingByCandidate.id;
            isExisting = true;
            previousApplicationId = existingByCandidate.application_id;
            
            // Check if job context is changing
            if (applicationId && applicationId !== previousApplicationId) {
              needsJobContextSwitch = true;
            }
          }
        }

        // Intern 1-1: återanvänd befintlig kollegatråd i stället för att skapa dubbletter.
        if (myConvIds.length > 0 && isInternal) {
          const { data: internalCandidates } = await supabase
            .from('conversations')
            .select('id, conversation_members(user_id)')
            .eq('kind', 'internal')
            .eq('is_group', false)
            .in('id', myConvIds)
            .order('updated_at', { ascending: false });

          const match = (internalCandidates || []).find((c) => {
            const ids = ((c as any).conversation_members || []).map((m: any) => m.user_id).sort();
            const wanted = [user.id, memberIds[0]].sort();
            return ids.length === 2 && ids[0] === wanted[0] && ids[1] === wanted[1];
          });

          if (match) {
            conversationId = match.id;
            isExisting = true;
          }
        }
      }

      // Create new conversation if none exists
      if (!conversationId) {
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .insert({
            name: isGroup ? name : null,
            is_group: isGroup,
            job_id: isInternal ? null : jobId,
            application_id: isInternal ? null : applicationId,
            // candidate_id sätts bara för kandidatchattar — aldrig för kollegor
            candidate_id: isGroup || isInternal ? null : candidateId,
            kind,
            organization_id: organizationId,
            created_by: user.id,
          })
          .select()
          .single();

        if (convError) throw convError;
        conversationId = conversation.id;

        // Add creator as admin member (upsert to handle race conditions)
        await supabase
          .from('conversation_members')
          .upsert(
            { conversation_id: conversationId, user_id: user.id, is_admin: true },
            { onConflict: 'conversation_id,user_id' }
          );

        // Add other members (ignore duplicates)
        for (const memberId of memberIds) {
          if (memberId !== user.id) {
            const { error: addErr } = await supabase
              .from('conversation_members')
              .insert({
                conversation_id: conversationId,
                user_id: memberId,
                is_admin: false,
              });
            // Ignore duplicate key - member already exists
            if (addErr && addErr.code !== '23505') throw addErr;
          }
        }
      }

      // Handle job context switch - update application_id and add system message
      if (needsJobContextSwitch && applicationId && conversationId) {
        // Get job title for the system message
        const { data: application } = await supabase
          .from('job_applications')
          .select('job:job_id (title)')
          .eq('id', applicationId)
          .single();

        const jobTitle = (application?.job as any)?.title || 'Okänd tjänst';

        // Atomär transaktion: båda operationerna lyckas eller ingen
        // Premium Spotify-känsla - inga inkonsistenta tillstånd möjliga
        const { error: switchError } = await supabase.rpc('switch_conversation_job_context', {
          p_conversation_id: conversationId,
          p_new_application_id: applicationId,
          p_new_job_id: jobId,
          p_job_title: jobTitle,
        });

        if (switchError) {
          console.error('Failed to switch job context:', switchError);
          // Non-critical: conversation still works, just without the marker
        }
      }

      // Send initial message if provided
      if (initialMessage && conversationId) {
        await supabase
          .from('conversation_messages')
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: initialMessage,
          });
      }

      return { id: conversationId, isExisting, jobContextSwitched: needsJobContextSwitch };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
