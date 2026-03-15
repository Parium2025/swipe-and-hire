import { describe, it, expect } from 'vitest';
import {
  getConversationDisplayName,
  getConversationAvatarProfile,
  getMessageSenderName,
} from '@/lib/conversationDisplayUtils';
import type { ApplicationSnapshot, ConversationMember } from '@/hooks/useConversations';

// ───────── helpers ──────────
function makeMember(overrides: Partial<ConversationMember['profile']> & { user_id?: string } = {}): ConversationMember {
  const { user_id = 'u1', ...profileOverrides } = overrides;
  return {
    user_id,
    is_admin: false,
    last_read_at: null,
    profile: {
      first_name: 'Anna',
      last_name: 'Svensson',
      company_name: null,
      profile_image_url: 'profiles/anna.jpg',
      company_logo_url: null,
      role: 'job_seeker',
      ...profileOverrides,
    },
  };
}

function makeSnapshot(overrides: Partial<ApplicationSnapshot> = {}): ApplicationSnapshot {
  return {
    application_id: 'app-1',
    first_name: 'Frozen',
    last_name: 'Name',
    profile_image_snapshot_url: 'snapshots/frozen.jpg',
    video_snapshot_url: null,
    cv_url: null,
    job_title: 'Utvecklare',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════
// getConversationDisplayName
// ═══════════════════════════════════════════════
describe('getConversationDisplayName', () => {
  it('returns group name when conversation is a group', () => {
    expect(
      getConversationDisplayName({
        isGroup: true,
        groupName: 'Dev Team',
        snapshot: undefined,
        displayMember: makeMember(),
      }),
    ).toBe('Dev Team');
  });

  it('returns frozen snapshot name over live profile for candidates', () => {
    const snapshot = makeSnapshot({ first_name: 'Frozen', last_name: 'Candidate' });
    expect(
      getConversationDisplayName({
        isGroup: false,
        groupName: null,
        snapshot,
        displayMember: makeMember({ first_name: 'Live', last_name: 'Profile' }),
      }),
    ).toBe('Frozen Candidate');
  });

  it('falls back to live profile when no snapshot', () => {
    expect(
      getConversationDisplayName({
        isGroup: false,
        groupName: null,
        snapshot: undefined,
        displayMember: makeMember({ first_name: 'Live', last_name: 'Profile' }),
      }),
    ).toBe('Live Profile');
  });

  it('uses company name for employer members', () => {
    expect(
      getConversationDisplayName({
        isGroup: false,
        groupName: null,
        snapshot: undefined,
        displayMember: makeMember({ role: 'employer', company_name: 'Acme AB', first_name: 'CEO', last_name: 'Person' }),
      }),
    ).toBe('Acme AB');
  });

  it('returns "Okänd användare" when no profile and no snapshot', () => {
    expect(
      getConversationDisplayName({
        isGroup: false,
        groupName: null,
        snapshot: undefined,
        displayMember: undefined,
      }),
    ).toBe('Okänd användare');
  });

  it('returns "Okänd användare" when profile names are empty strings', () => {
    expect(
      getConversationDisplayName({
        isGroup: false,
        groupName: null,
        snapshot: undefined,
        displayMember: makeMember({ first_name: '', last_name: '' }),
      }),
    ).toBe('Okänd användare');
  });

  it('returns "Okänd användare" when profile names are whitespace-only', () => {
    expect(
      getConversationDisplayName({
        isGroup: false,
        groupName: null,
        snapshot: undefined,
        displayMember: makeMember({ first_name: '  ', last_name: '  ' }),
      }),
    ).toBe('Okänd användare');
  });

  it('handles snapshot with only first_name', () => {
    expect(
      getConversationDisplayName({
        isGroup: false,
        groupName: null,
        snapshot: makeSnapshot({ first_name: 'OnlyFirst', last_name: null }),
        displayMember: undefined,
      }),
    ).toBe('OnlyFirst');
  });

  it('handles snapshot with only last_name', () => {
    expect(
      getConversationDisplayName({
        isGroup: false,
        groupName: null,
        snapshot: makeSnapshot({ first_name: null, last_name: 'OnlyLast' }),
        displayMember: undefined,
      }),
    ).toBe('OnlyLast');
  });

  it('skips snapshot when both names are null and falls back to profile', () => {
    expect(
      getConversationDisplayName({
        isGroup: false,
        groupName: null,
        snapshot: makeSnapshot({ first_name: null, last_name: null }),
        displayMember: makeMember({ first_name: 'Fallback', last_name: 'User' }),
      }),
    ).toBe('Fallback User');
  });

  it('skips snapshot when names are empty strings and falls back to profile', () => {
    expect(
      getConversationDisplayName({
        isGroup: false,
        groupName: null,
        snapshot: makeSnapshot({ first_name: '', last_name: '' }),
        displayMember: makeMember({ first_name: 'Real', last_name: 'Person' }),
      }),
    ).toBe('Real Person');
  });
});

// ═══════════════════════════════════════════════
// getConversationAvatarProfile
// ═══════════════════════════════════════════════
describe('getConversationAvatarProfile', () => {
  it('uses snapshot when it has an image', () => {
    const snapshot = makeSnapshot({ profile_image_snapshot_url: 'snap/img.jpg' });
    const result = getConversationAvatarProfile(snapshot, makeMember());

    expect(result).toEqual({
      role: 'job_seeker',
      first_name: snapshot.first_name,
      last_name: snapshot.last_name,
      company_name: null,
      profile_image_url: 'snap/img.jpg',
      company_logo_url: null,
    });
  });

  it('uses snapshot identity even when snapshot has no image (frozen state)', () => {
    const snapshot = makeSnapshot({ profile_image_snapshot_url: null });
    const member = makeMember({ profile_image_url: 'live/img.jpg' });
    const result = getConversationAvatarProfile(snapshot, member);

    // Should use snapshot (frozen at application time) — NOT live profile
    expect(result?.first_name).toBe('Frozen');
    expect(result?.profile_image_url).toBeNull();
  });

  it('falls back to live profile when no snapshot at all', () => {
    const member = makeMember();
    const result = getConversationAvatarProfile(undefined, member);

    expect(result).toBe(member.profile);
  });

  it('returns undefined when no snapshot and no member', () => {
    expect(getConversationAvatarProfile(undefined, undefined)).toBeUndefined();
  });

  it('returns snapshot profile when it has image, even if member also has one (snapshot wins)', () => {
    const snapshot = makeSnapshot({ profile_image_snapshot_url: 'snap.jpg' });
    const member = makeMember({ profile_image_url: 'live.jpg' });

    expect(getConversationAvatarProfile(snapshot, member)?.profile_image_url).toBe('snap.jpg');
  });

  it('builds profile from snapshot names when no image and no live profile', () => {
    const snapshot = makeSnapshot({
      first_name: 'Ghost',
      last_name: 'User',
      profile_image_snapshot_url: null,
    });
    const result = getConversationAvatarProfile(snapshot, undefined);

    expect(result).toEqual({
      role: 'job_seeker',
      first_name: 'Ghost',
      last_name: 'User',
      company_name: null,
      profile_image_url: null,
      company_logo_url: null,
    });
  });

  it('returns undefined when snapshot has no names and no image and no member', () => {
    const snapshot = makeSnapshot({
      first_name: null,
      last_name: null,
      profile_image_snapshot_url: null,
    });
    expect(getConversationAvatarProfile(snapshot, undefined)).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════
// getMessageSenderName
// ═══════════════════════════════════════════════
describe('getMessageSenderName', () => {
  it('returns full name for job seekers', () => {
    expect(getMessageSenderName({
      role: 'job_seeker',
      first_name: 'Erik',
      last_name: 'Karlsson',
    })).toBe('Erik Karlsson');
  });

  it('returns company name for employers', () => {
    expect(getMessageSenderName({
      role: 'employer',
      first_name: 'CEO',
      last_name: 'Person',
      company_name: 'TechCo AB',
    })).toBe('TechCo AB');
  });

  it('falls back to personal name when employer has no company_name', () => {
    expect(getMessageSenderName({
      role: 'employer',
      first_name: 'Solo',
      last_name: 'Entrepreneur',
      company_name: null,
    })).toBe('Solo Entrepreneur');
  });

  it('returns "Okänd" for undefined profile', () => {
    expect(getMessageSenderName(undefined)).toBe('Okänd');
  });

  it('returns "Okänd" for empty name fields', () => {
    expect(getMessageSenderName({
      role: 'job_seeker',
      first_name: null,
      last_name: null,
    })).toBe('Okänd');
  });

  it('returns "Okänd" for whitespace-only name fields', () => {
    expect(getMessageSenderName({
      role: 'job_seeker',
      first_name: '  ',
      last_name: '  ',
    })).toBe('Okänd');
  });

  it('handles first_name only', () => {
    expect(getMessageSenderName({
      role: 'job_seeker',
      first_name: 'Anna',
      last_name: null,
    })).toBe('Anna');
  });

  it('does not use whitespace-only company_name for employers', () => {
    expect(getMessageSenderName({
      role: 'employer',
      first_name: 'John',
      last_name: 'Doe',
      company_name: '   ',
    })).toBe('John Doe');
  });
});
