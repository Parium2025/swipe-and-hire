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

  it.each(['AppSidebar', 'EmployerSidebar'])('reserves the bottom strip before the %s logout button padding on touch phones', (name) => {
    const sidebar = readFileSync(`src/components/${name}.tsx`, 'utf8');
    const css = readFileSync('src/index.css', 'utf8');
    expect(sidebar).toContain('sidebar-logout-spacing p-4');
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

  it('matches cold reload paint and fades immediately below the safe area', () => {
    const css = readFileSync('src/index.css', 'utf8');
    const topEdge = css.split('.chrome-matched-background::before {')[1].split('}')[0];
    expect(topEdge).toContain('var(--active-browser-chrome-color) env(safe-area-inset-top, 0px)');
    expect(topEdge).not.toContain('+ 22px');
    expect(readFileSync('src/pages/Index.tsx', 'utf8')).toContain('const plainBg = <div className="relative min-h-screen"><ChromeMatchedBackground /></div>');
    expect(readFileSync('src/components/ui/page-loader.tsx', 'utf8')).toContain('{fullscreen && <ChromeMatchedBackground />}');
  });

  it('uses the same card transform for rendering and cache warming', () => {
    for (const name of ['MobileJobCard', 'ReadOnlyMobileJobCard']) {
      expect(readFileSync(`src/components/${name}.tsx`, 'utf8')).toContain("useCardImage(cardImageSource, 'job-images', imageVersion, JOB_CARD_TRANSFORM)");
    }
    const search = readFileSync('src/pages/SearchJobs.tsx', 'utf8');
    expect(search).toContain("buildCardImageUrl(job.company_logo_url, 'company-logos', getImageVersion(job)");
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
import { isSignInTransition } from '@/lib/browserChrome';
describe('sign-in never reloads the document', () => {
  it('treats /auth → app as a sign-in transition', () => {
    expect(isSignInTransition('/auth', '/home')).toBe(true);
    expect(isSignInTransition('/auth', '/search-jobs')).toBe(true);
    expect(isSignInTransition('/auth', '/')).toBe(false);
    expect(isSignInTransition('/home', '/auth')).toBe(false);
    expect(isSignInTransition(null, '/home')).toBe(false);
  });
});
