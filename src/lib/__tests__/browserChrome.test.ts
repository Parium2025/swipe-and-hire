import { afterEach, describe, expect, it, vi } from 'vitest';
import { primeBrowserChrome, syncBrowserChrome } from '../browserChrome';

const themeColorTags = () =>
  Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));

describe('browserChrome', () => {
  afterEach(() => {
    vi.useRealTimers();
    themeColorTags().forEach((tag) => tag.remove());
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
    document.documentElement.className = '';
    document.body.className = '';
  });

  it('behåller en stabil färgtagg och tvingar Safari att läsa den nya färgen', () => {
    vi.useFakeTimers();
    syncBrowserChrome('/');
    vi.advanceTimersByTime(20);

    const landingTags = themeColorTags();
    expect(landingTags).toHaveLength(1);
    expect(landingTags[0]?.content).toBe('#2a2a2a');

    syncBrowserChrome('/auth');
    vi.advanceTimersByTime(20);

    const authTags = themeColorTags();
    expect(authTags).toHaveLength(1);
    expect(authTags[0]).toBe(landingTags[0]);
    expect(authTags[0]?.content).toBe('#062B5E');
  });

  it('synkar målgruppssidornas toppfärg till blått', () => {
    vi.useFakeTimers();
    syncBrowserChrome('/jobbsokare');
    vi.advanceTimersByTime(20);

    expect(themeColorTags()).toHaveLength(1);
    expect(themeColorTags().every((tag) => tag.content === '#001F3D')).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue('--active-browser-chrome-color')
    ).toBe('#001F3D');
  });

  it('förbereder målruttens färg före SPA-navigation och stoppar gamla ruttskrivningar', () => {
    vi.useFakeTimers();
    syncBrowserChrome('/');

    primeBrowserChrome('/auth');
    vi.advanceTimersByTime(20);

    expect(themeColorTags()).toHaveLength(1);
    expect(themeColorTags().every((tag) => tag.content === '#062B5E')).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue('--active-browser-chrome-color')
    ).toBe('#062B5E');
  });
});