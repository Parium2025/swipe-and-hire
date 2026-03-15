import { describe, it, expect } from 'vitest';
import {
  createConversationId,
  isRetryableError,
  formatConversationError,
} from '@/lib/conversationService';

// ═══════════════════════════════════════════════
// createConversationId
// ═══════════════════════════════════════════════
describe('createConversationId', () => {
  it('generates a valid UUID v4 format', () => {
    const id = createConversationId();
    // UUID v4 pattern: 8-4-4-4-12 hex chars, version nibble = 4, variant bits = 8/9/a/b
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(id).toMatch(uuidRegex);
  });

  it('generates unique IDs across multiple calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createConversationId()));
    expect(ids.size).toBe(100);
  });

  it('returns a string of exactly 36 characters', () => {
    const id = createConversationId();
    expect(id.length).toBe(36);
  });
});

// ═══════════════════════════════════════════════
// isRetryableError
// ═══════════════════════════════════════════════
describe('isRetryableError', () => {
  it('recognizes RLS permission error (42501)', () => {
    expect(isRetryableError({ code: '42501', message: 'permission denied' })).toBe(true);
  });

  it('recognizes serialization failure (40001)', () => {
    expect(isRetryableError({ code: '40001', message: 'could not serialize' })).toBe(true);
  });

  it('recognizes deadlock (40P01)', () => {
    expect(isRetryableError({ code: '40P01', message: 'deadlock detected' })).toBe(true);
  });

  it('recognizes row-level security message', () => {
    expect(isRetryableError({ message: 'new row violates row-level security policy' })).toBe(true);
  });

  it('recognizes network errors', () => {
    expect(isRetryableError({ message: 'Network request failed' })).toBe(true);
  });

  it('recognizes fetch errors', () => {
    expect(isRetryableError({ message: 'Failed to fetch' })).toBe(true);
  });

  it('returns false for non-retryable errors', () => {
    expect(isRetryableError({ code: '23505', message: 'duplicate key' })).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});

// ═══════════════════════════════════════════════
// formatConversationError
// ═══════════════════════════════════════════════
describe('formatConversationError', () => {
  it('formats error with code and message', () => {
    const result = formatConversationError({ code: '42501', message: 'permission denied' });
    expect(result).toBe('[42501] permission denied');
  });

  it('formats error with details', () => {
    const result = formatConversationError({ 
      code: '23503', 
      message: 'foreign key violation', 
      details: 'Key (job_id)=(xyz) not found' 
    });
    expect(result).toBe('[23503] foreign key violation • Key (job_id)=(xyz) not found');
  });

  it('handles error without code', () => {
    const result = formatConversationError({ message: 'something broke' });
    expect(result).toBe('something broke');
  });

  it('handles error without message', () => {
    const result = formatConversationError({});
    expect(result).toBe('Okänt fel');
  });

  it('handles null error', () => {
    const result = formatConversationError(null);
    expect(result).toBe('Okänt fel');
  });
});
