import { describe, expect, it } from 'vitest';
import {
  AUTH_REGISTRATION_LIMITS,
  MIN_AUTH_PASSWORD_LENGTH,
  normalizeAuthWebsite,
} from '@/lib/authRegistrationValidation';

describe('Auth registration validation', () => {
  it('uses the same eight-character password floor as the strength meter', () => {
    expect(MIN_AUTH_PASSWORD_LENGTH).toBe(8);
    expect(AUTH_REGISTRATION_LIMITS).toMatchObject({
      email: 254,
      password: 128,
      name: 100,
      companyName: 200,
      address: 160,
      website: 200,
      companyDescription: 3000,
    });
  });

  it.each([
    ['parium.se', 'https://parium.se/'],
    ['https://example.com/jobs', 'https://example.com/jobs'],
    ['http://example.se', 'http://example.se/'],
  ])('normalizes a public web address: %s', (input, expected) => {
    expect(normalizeAuthWebsite(input)).toBe(expected);
  });

  it.each([
    '',
    'javascript:alert(1)',
    'data:text/html,hello',
    'https://user:secret@example.com',
    'https://127.0.0.1',
    'https://192.168.1.20',
    'https://service.internal',
    'https://company.local',
    'not-a-host',
  ])('rejects an invalid or unsafe web address: %s', (input) => {
    expect(normalizeAuthWebsite(input)).toBeNull();
  });
});
