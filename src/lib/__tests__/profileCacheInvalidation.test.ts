import { describe, it, expect, beforeEach } from 'vitest';
import {
  writePersistentCache,
  readPersistentCache,
  invalidateCachedProfile,
} from '@/lib/performanceGuards';
import { QueryClient } from '@tanstack/react-query';
import { patchConversationProfileCaches } from '@/lib/conversationProfileCache';
import type { Conversation, ConversationMessage } from '@/hooks/useConversations';

type ProfileLite = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  profile_image_url: string | null;
  company_logo_url: string | null;
  role: 'job_seeker' | 'employer';
};

const isProfileLite = (data: unknown): data is ProfileLite =>
  Boolean(data && typeof data === 'object' && typeof (data as ProfileLite).user_id === 'string');

const TTL = 15 * 60 * 1000;
const keyFor = (userId: string) => `parium_profile_lite_v2_${userId}`;

const sampleProfile = (userId: string): ProfileLite => ({
  user_id: userId,
  first_name: 'Fredrik',
  last_name: 'Andits',
  company_name: 'Hoffstens Motor',
  profile_image_url: 'old-image.jpg',
  company_logo_url: null,
  role: 'employer',
});

describe('patchConversationProfileCaches', () => {
  it('byter personbild och bolagslogga i listan och gamla meddelanden direkt', () => {
    const queryClient = new QueryClient();
    const oldProfile = sampleProfile('user-123');
    const conversation = {
      id: 'conversation-1',
      name: null,
      is_group: false,
      job_id: null,
      application_id: null,
      candidate_id: null,
      created_by: 'viewer-1',
      created_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      unread_count: 0,
      members: [{ user_id: 'user-123', is_admin: false, last_read_at: null, profile: oldProfile }],
      last_message: {
        id: 'message-1', conversation_id: 'conversation-1', sender_id: 'user-123', content: 'Hej',
        created_at: new Date().toISOString(), is_system_message: false,
        sender_identity: 'person', sender_profile: oldProfile,
      },
    } as Conversation;
    const messages = [conversation.last_message] as ConversationMessage[];

    queryClient.setQueryData(['conversations', 'viewer-1'], [conversation]);
    queryClient.setQueryData(['conversation-messages', 'conversation-1'], messages);
    patchConversationProfileCaches(queryClient, 'user-123', {
      ...oldProfile,
      profile_image_url: 'new-person.jpg',
      company_logo_url: 'new-company.jpg',
    });

    const nextConversation = queryClient.getQueryData<Conversation[]>(['conversations', 'viewer-1'])?.[0];
    const nextMessage = queryClient.getQueryData<ConversationMessage[]>(['conversation-messages', 'conversation-1'])?.[0];
    expect(nextConversation?.members[0].profile?.profile_image_url).toBe('new-person.jpg');
    expect(nextConversation?.members[0].profile?.company_logo_url).toBe('new-company.jpg');
    expect(nextConversation?.last_message?.sender_profile?.profile_image_url).toBe('new-person.jpg');
    expect(nextMessage?.sender_profile?.profile_image_url).toBe('new-person.jpg');
    expect(nextMessage?.sender_profile?.company_logo_url).toBe('new-company.jpg');
  });

  it('lämnar andra personers chattbilder orörda', () => {
    const queryClient = new QueryClient();
    const otherProfile = sampleProfile('user-456');
    const messages = [{
      id: 'message-2', conversation_id: 'conversation-1', sender_id: 'user-456', content: 'Hej',
      created_at: new Date().toISOString(), is_system_message: false,
      sender_identity: 'person', sender_profile: otherProfile,
    }] as ConversationMessage[];
    queryClient.setQueryData(['conversation-messages', 'conversation-1'], messages);

    patchConversationProfileCaches(queryClient, 'user-123', {
      ...sampleProfile('user-123'),
      profile_image_url: 'new-person.jpg',
    });

    expect(queryClient.getQueryData<ConversationMessage[]>(['conversation-messages', 'conversation-1']))
      .toEqual(messages);
  });
});

describe('invalidateCachedProfile', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('rensar den cachade chattprofilen så ny bild hämtas direkt', () => {
    const userId = 'user-123';
    writePersistentCache(keyFor(userId), sampleProfile(userId));

    // Cachen är färsk och skulle normalt visas i upp till 15 minuter.
    expect(readPersistentCache(keyFor(userId), TTL, isProfileLite)?.profile_image_url).toBe('old-image.jpg');

    invalidateCachedProfile(userId);

    // Efter sparad profilbild får den gamla cachen aldrig användas igen.
    expect(readPersistentCache(keyFor(userId), TTL, isProfileLite)).toBeNull();
  });

  it('rör inte andra användares cachade profiler', () => {
    writePersistentCache(keyFor('user-a'), sampleProfile('user-a'));
    writePersistentCache(keyFor('user-b'), sampleProfile('user-b'));

    invalidateCachedProfile('user-a');

    expect(readPersistentCache(keyFor('user-a'), TTL, isProfileLite)).toBeNull();
    expect(readPersistentCache(keyFor('user-b'), TTL, isProfileLite)?.profile_image_url).toBe('old-image.jpg');
  });

  it('tål tomma eller saknade användar-id utan att kasta', () => {
    expect(() => invalidateCachedProfile(null)).not.toThrow();
    expect(() => invalidateCachedProfile(undefined)).not.toThrow();
    expect(() => invalidateCachedProfile('')).not.toThrow();
  });
});
