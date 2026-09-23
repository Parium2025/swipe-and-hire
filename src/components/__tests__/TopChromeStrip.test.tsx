import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopChromeStrip from '../TopChromeStrip';

/**
 * Regressionsskydd: med viewport-fit=cover sträcker sig sidan in bakom iOS
 * statusrad i installerat app-läge. I vanlig Safari börjar viewporten redan
 * under statusfältet och en egen remsa skulle bli en synlig dubbelrad.
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

const renderStrip = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <TopChromeStrip />
    </MemoryRouter>
  );

describe('TopChromeStrip', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty('--top-chrome-content-offset');
  });

  it('renderar ingen extra remsa i vanlig mobil-Safari', () => {
    mockMatchMedia(false, true);
    const { container } = renderStrip();
    expect(container.firstChild).toBeNull();
    expect(
      document.documentElement.style.getPropertyValue('--top-chrome-content-offset')
    ).toBe('0px');
  });

  it('renderar ingen remsa på desktop', () => {
    mockMatchMedia(false, false);
    const { container } = renderStrip();
    expect(container.firstChild).toBeNull();
  });

  it('renderar remsa och offset i installerat app-läge', () => {
    mockMatchMedia(true, true);
    const { container } = renderStrip();
    expect(container.firstChild).not.toBeNull();
    expect(
      document.documentElement.style.getPropertyValue('--top-chrome-content-offset')
    ).toContain('safe-area-inset-top');
  });
});
