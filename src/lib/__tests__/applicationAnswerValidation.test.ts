import { describe, expect, it } from 'vitest';
import {
  hasAllRequiredApplicationAnswers,
  isApplicationAnswerPresent,
  isPermanentApplicationError,
} from '@/lib/applicationAnswerValidation';

describe('application answer validation', () => {
  it('allows applications when a job has no questions', () => {
    expect(hasAllRequiredApplicationAnswers([], {})).toBe(true);
  });

  it('requires every required answer and accepts false and zero', () => {
    const questions = [
      { id: 'text', is_required: true },
      { id: 'optional', is_required: false },
      { id: 'zero', is_required: true },
      { id: 'boolean', is_required: true },
    ];

    expect(hasAllRequiredApplicationAnswers(questions, {
      text: ' svar ',
      zero: 0,
      boolean: false,
    })).toBe(true);
    expect(hasAllRequiredApplicationAnswers(questions, { text: '   ', zero: 0, boolean: false })).toBe(false);
  });

  it('rejects empty strings, arrays, objects and null values', () => {
    expect(isApplicationAnswerPresent('')).toBe(false);
    expect(isApplicationAnswerPresent([])).toBe(false);
    expect(isApplicationAnswerPresent({})).toBe(false);
    expect(isApplicationAnswerPresent(null)).toBe(false);
  });

  it('classifies validation, authorization, quota and duplicate errors as permanent', () => {
    expect(isPermanentApplicationError({ code: '23505' })).toBe(true);
    expect(isPermanentApplicationError({ code: '23514' })).toBe(true);
    expect(isPermanentApplicationError({ code: '42501' })).toBe(true);
    expect(isPermanentApplicationError({ message: 'application_quota_exceeded' })).toBe(true);
    expect(isPermanentApplicationError({ message: 'network unavailable' })).toBe(false);
  });
});