import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimChromeReload, needsFullPageChromeNavigation, primeBrowserChrome, syncBrowserChrome, navigateAcrossChromeColor } from '../browserChrome';

const themeColorTags = () =>
  Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));

describe('browserChrome', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
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
    expect(landingTags[0]?.content).toBe('#00193D');

    syncBrowserChrome('/auth');
    vi.advanceTimersByTime(20);

    const authTags = themeColorTags();
    expect(authTags).toHaveLength(1);
    expect(authTags[0]).toBe(landingTags[0]);
    expect(authTags[0]?.content).toBe('#00193D');
  });

  it('synkar målgruppssidornas toppfärg till blått', () => {
    vi.useFakeTimers();
    syncBrowserChrome('/jobbsokare');
    vi.advanceTimersByTime(20);

    expect(themeColorTags()).toHaveLength(1);
    expect(themeColorTags().every((tag) => tag.content === '#00193D')).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue('--active-browser-chrome-color')
    ).toBe('#00193D');
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
    expect(themeColorTags().every((tag) => tag.content === '#00193D')).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue('--active-browser-chrome-color')
    ).toBe('#00193D');

    syncBrowserChrome('/auth');
    vi.advanceTimersByTime(20);

    expect(themeColorTags().every((tag) => tag.content === '#00193D')).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue('--active-browser-chrome-color')
    ).toBe('#00193D');
  });

  it.each(['/auth', '/jobbsokare', '/arbetsgivare', '/'])('uses same-document navigation to %s even on iPhone', (target) => {
    vi.stubGlobal('navigator', { userAgent: 'iPhone', maxTouchPoints: 1 });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(needsFullPageChromeNavigation()).toBe(true);
    const navigate = vi.fn();
    navigateAcrossChromeColor(target, navigate);
    expect(navigate).toHaveBeenCalledOnce();
  });

  it('tillåter högst två chrome-omladdningar per tidsfönster så den aldrig loopar', () => {
    sessionStorage.clear();
    expect(claimChromeReload(1_000)).toBe(true);
    expect(claimChromeReload(2_000)).toBe(true);
    expect(claimChromeReload(3_000)).toBe(false);
    expect(claimChromeReload(9_000)).toBe(false);
    expect(claimChromeReload(11_500)).toBe(true);
    expect(claimChromeReload(11_600)).toBe(false);
    expect(claimChromeReload(22_000)).toBe(true);
  });
});
