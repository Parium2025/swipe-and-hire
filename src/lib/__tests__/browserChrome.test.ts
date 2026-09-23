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

  it('skapar om alla färgtaggar när rutten byts så Safari läser den nya färgen', () => {
    vi.useFakeTimers();
    syncBrowserChrome('/');

    const landingTags = themeColorTags();
    expect(landingTags).toHaveLength(3);
    expect(landingTags.every((tag) => tag.content === '#2a2a2b')).toBe(true);

    syncBrowserChrome('/auth');

    const authTags = themeColorTags();
    expect(authTags).toHaveLength(3);
    expect(authTags.every((tag) => tag.content === '#062B5f')).toBe(true);
    expect(landingTags.every((tag) => !tag.isConnected)).toBe(true);

    vi.runAllTimers();
    expect(themeColorTags().every((tag) => tag.content === '#062B5E')).toBe(true);
  });

  it('synkar målgruppssidornas toppfärg till blått', () => {
    vi.useFakeTimers();
    syncBrowserChrome('/jobbsokare');
    vi.runAllTimers();

    expect(themeColorTags()).toHaveLength(3);
    expect(themeColorTags().every((tag) => tag.content === '#001F3D')).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue('--active-browser-chrome-color')
    ).toBe('#001F3D');
  });

  it('förbereder målruttens färg före SPA-navigation och stoppar gamla ruttskrivningar', () => {
    vi.useFakeTimers();
    syncBrowserChrome('/');

    primeBrowserChrome('/auth');
    vi.runAllTimers();

    expect(themeColorTags()).toHaveLength(3);
    expect(themeColorTags().every((tag) => tag.content === '#062B5E')).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue('--active-browser-chrome-color')
    ).toBe('#062B5E');
  });
});