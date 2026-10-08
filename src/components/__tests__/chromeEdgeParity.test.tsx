import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import BottomChromeStrip from '../BottomChromeStrip';
import ChromeMatchedBackground from '../ChromeMatchedBackground';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Blue screen edge parity', () => {
  it.each(['/auth', '/home', '/my-candidates'])('adds the bottom line on %s without resizing the strip', (path) => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const { container } = render(<MemoryRouter initialEntries={[path]}><BottomChromeStrip /></MemoryRouter>);
    const strip = container.querySelector<HTMLElement>('[data-browser-chrome-strip="bottom"]');
    expect(strip?.classList.contains('chrome-bottom-separator')).toBe(true);
    expect(strip?.style.height).toBe('calc(env(safe-area-inset-bottom, 0px) + 14px)');
  });

  it('leaves the video strip without the new line', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const { container } = render(<MemoryRouter initialEntries={['/']}><BottomChromeStrip /></MemoryRouter>);
    expect(container.querySelector('.chrome-bottom-separator')).toBeNull();
  });

  it('shares a paint-only background across all three blue screens', () => {
    const { container } = render(<ChromeMatchedBackground variant="auth" />);
    expect(container.firstElementChild?.classList.contains('fixed')).toBe(true);
    expect(container.firstElementChild?.getAttribute('data-chrome-matched-background')).toBe('auth');
  });

  it('keeps static and React splash text independent of root font changes', () => {
    const html = readFileSync('index.html', 'utf8');
    const css = readFileSync('src/index.css', 'utf8');
    const react = readFileSync('src/components/AuthSplashScreen.tsx', 'utf8');
    expect(html).toContain('#auth-splash-tagline { font-size: 20px; margin-top: 4px; }');
    expect(html).toContain('#auth-splash-tagline { font-size: 24px; }');
    expect(css).toMatch(/\.auth-splash-tagline \{\s*font-size: 20px;/);
    expect(css).toContain('.auth-splash-tagline { font-size: 24px; }');
    expect(react).toContain('className="auth-splash-tagline"');
    expect(react).not.toContain("fontSize: 'clamp(1.25rem");
  });
});