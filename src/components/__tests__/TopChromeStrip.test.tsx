import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopChromeStrip from '../TopChromeStrip';

/**
 * Regressionsskydd: med viewport-fit=cover sträcker sig sidan in bakom iOS
 * statusrad i installerat app-läge. Safari 26 färgar sin browser-UI från ett
 * fixed element vid kanten, därför används ett 1 px ankare i vanlig Safari.
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

  it('renderar ett 1 px färgankare utan content-offset i vanlig mobil-Safari', () => {
    mockMatchMedia(false, true);
    const { container } = renderStrip();
    const strip = container.firstChild as HTMLElement;
    expect(strip).not.toBeNull();
    expect(strip.style.height).toBe('1px');
    expect(strip.style.backgroundColor).toBe('rgb(42, 42, 42)');
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
