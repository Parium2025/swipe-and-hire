import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimChromeReload, needsFullPageChromeNavigation, primeBrowserChrome, syncBrowserChrome } from '../browserChrome';

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
    expect(landingTags[0]?.content).toBe('#626262');

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

  it('begränsar full sidväxling till vanlig iOS-webbläsare', () => {
    expect(needsFullPageChromeNavigation()).toBe(false);
  });

  it('behåller aktuell färg under utgångsanimationen och byter först när målvägen visas', () => {
    vi.useFakeTimers();
    syncBrowserChrome('/');
    vi.advanceTimersByTime(20);

    primeBrowserChrome('/auth');
    vi.advanceTimersByTime(20);

    expect(themeColorTags()).toHaveLength(1);
    expect(themeColorTags().every((tag) => tag.content === '#626262')).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue('--active-browser-chrome-color')
    ).toBe('#626262');

    syncBrowserChrome('/auth');
    vi.advanceTimersByTime(20);

    expect(themeColorTags().every((tag) => tag.content === '#062B5E')).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue('--active-browser-chrome-color')
    ).toBe('#062B5E');
  });

  it('tillåter högst en chrome-omladdning per tidsfönster så den aldrig loopar', () => {
    sessionStorage.clear();
    expect(claimChromeReload(1_000)).toBe(true);
    expect(claimChromeReload(2_000)).toBe(false);
    expect(claimChromeReload(9_000)).toBe(false);
    expect(claimChromeReload(12_000)).toBe(true);
  });
});
