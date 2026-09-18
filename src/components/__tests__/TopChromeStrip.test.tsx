import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from '@/lib/router-compat';
import TopChromeStrip from '../TopChromeStrip';

/**
 * Regressionsskydd: toppremsan speglar bottenremsan på alla touch-enheter så
 * iOS safe-area aldrig faller tillbaka till svart under kallstart eller SPA-nav.
 */
const mockMatchMedia = (standalone: boolean, coarse: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('standalone') ? standalone : coarse,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList
  );
};

// TanStack Routers RouterProvider monterar asynkront (microtask) — flusha
// initial-laddningen så att assertions ser det färdiga trädet.
const renderStrip = async () => {
  const result = render(
    <MemoryRouter initialEntries={['/']}>
      <TopChromeStrip />
    </MemoryRouter>
  );
  await act(async () => {});
  return result;
};

describe('TopChromeStrip', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty('--top-chrome-content-offset');
  });

  it('renderar remsa och offset i vanlig mobilwebbläsare', async () => {
    mockMatchMedia(false, true);
    const { container } = await renderStrip();
    expect(container.firstChild).not.toBeNull();
    expect(
      document.documentElement.style.getPropertyValue('--top-chrome-content-offset')
    ).toContain('safe-area-inset-top');
  });

  it('renderar ingen remsa på desktop', async () => {
    mockMatchMedia(false, false);
    const { container } = await renderStrip();
    expect(container.firstChild).toBeNull();
  });

  it('renderar remsa och offset i installerat app-läge', async () => {
    mockMatchMedia(true, true);
    const { container } = await renderStrip();
    expect(container.firstChild).not.toBeNull();
    expect(
      document.documentElement.style.getPropertyValue('--top-chrome-content-offset')
    ).toContain('safe-area-inset-top');
  });
});
