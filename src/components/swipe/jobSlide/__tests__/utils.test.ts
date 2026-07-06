import { describe, expect, it } from 'vitest';
import {
  getCompanyInitials,
  getImageObjectPosition,
  isWithinInteractiveTarget,
  isWithinTapHintTarget,
} from '../utils';

describe('getImageObjectPosition', () => {
  it('defaults empty/center to "center 50%"', () => {
    expect(getImageObjectPosition()).toBe('center 50%');
    expect(getImageObjectPosition('center')).toBe('center 50%');
  });
  it('maps semantic keywords', () => {
    expect(getImageObjectPosition('top')).toBe('center 20%');
    expect(getImageObjectPosition('bottom')).toBe('center 80%');
  });
  it('passes through numeric percent as vertical', () => {
    expect(getImageObjectPosition('35')).toBe('center 35%');
  });
});

describe('getCompanyInitials', () => {
  it('takes first letter of each word, uppercased, max 2', () => {
    expect(getCompanyInitials('Parium AB')).toBe('PA');
    expect(getCompanyInitials('spotify technology')).toBe('ST');
    expect(getCompanyInitials('Volvo Cars Group')).toBe('VC');
  });
  it('handles single word', () => {
    expect(getCompanyInitials('Apple')).toBe('A');
  });
});

describe('isWithinTapHintTarget / isWithinInteractiveTarget', () => {
  it('returns false for null / non-Element', () => {
    expect(isWithinTapHintTarget(null)).toBe(false);
    expect(isWithinInteractiveTarget(null)).toBe(false);
  });
  it('detects data-tap-hint-scroll ancestor', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-tap-hint-scroll', '');
    const child = document.createElement('span');
    parent.appendChild(child);
    expect(isWithinTapHintTarget(child)).toBe(true);
  });
  it('detects interactive ancestors (button, [role=button], [data-swipe-action-button])', () => {
    const btn = document.createElement('button');
    expect(isWithinInteractiveTarget(btn)).toBe(true);

    const role = document.createElement('div');
    role.setAttribute('role', 'button');
    expect(isWithinInteractiveTarget(role)).toBe(true);

    const action = document.createElement('div');
    action.setAttribute('data-swipe-action-button', '');
    const inner = document.createElement('svg');
    action.appendChild(inner);
    expect(isWithinInteractiveTarget(inner)).toBe(true);
  });
  it('returns false for plain elements', () => {
    const div = document.createElement('div');
    expect(isWithinInteractiveTarget(div)).toBe(false);
    expect(isWithinTapHintTarget(div)).toBe(false);
  });
});
