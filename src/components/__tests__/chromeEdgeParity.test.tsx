import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import BottomChromeStrip from '../BottomChromeStrip';
import ChromeMatchedBackground from '../ChromeMatchedBackground';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Blue screen edge parity', () => {
  it('uses the active chrome color on both login/logout splash covers', () => {
    const html = readFileSync('index.html', 'utf8');
    const react = readFileSync('src/components/AuthSplashScreen.tsx', 'utf8');
    const gate = readFileSync('src/lib/authSplashEvents.ts', 'utf8');
    expect(html).toContain('background: var(--active-browser-chrome-color, #00193D)');
    expect(react).toContain("background: 'var(--active-browser-chrome-color)'");
    expect(gate.match(/setProperty\('background-image', 'none', 'important'\)/g)).toHaveLength(2);
  });

  it('reserves the bottom strip before the logout button padding on touch phones', () => {
    const sidebar = readFileSync('src/components/AppSidebar.tsx', 'utf8');
    const css = readFileSync('src/index.css', 'utf8');
    expect(sidebar).toContain('sidebar-logout-spacing mt-auto p-4');
    expect(css).toContain('[data-mobile="true"] .sidebar-logout-spacing');
    expect(css).toContain('padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px) + 14px)');
  });
  it.each(['/auth', '/home', '/my-candidates'])('adds the bottom line on %s without resizing the strip', (path) => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const { container } = render(<MemoryRouter initialEntries={[path]}><BottomChromeStrip /></MemoryRouter>);
    const strip = container.querySelector<HTMLElement>('[data-browser-chrome-strip="bottom"]');
    expect(strip?.classList.contains('chrome-bottom-separator')).toBe(true);
    // jsdom cannot parse env() in calc(); guard the unchanged source instead.
    expect(readFileSync('src/components/BottomChromeStrip.tsx', 'utf8')).toContain("height: 'calc(env(safe-area-inset-bottom, 0px) + 14px)'");
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

  it('keeps auth sampling roots solid and matches the initial document chrome', () => {
    const html = readFileSync('index.html', 'utf8');
    const auth = readFileSync('src/pages/Auth.tsx', 'utf8');
    const gate = readFileSync('src/lib/authSplashEvents.ts', 'utf8');
    expect(html).not.toContain('#062B5E');
    expect(gate).not.toContain('#062B5E');
    expect(auth).toContain("el.style.setProperty('background-image', 'none', 'important')");
    expect(auth).not.toContain("backgroundImage: 'var(--gradient-auth-shell)'");
  });

  it('uses destination paint instead of the generic gradient while audience routes load', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain('className="fixed inset-0 audience-route-paint"');
    expect(app).toContain("pathname === '/jobbsokare' || pathname === '/arbetsgivare'");
  });
});