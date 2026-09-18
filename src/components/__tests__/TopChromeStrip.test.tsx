import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopChromeStrip from '../TopChromeStrip';

/**
 * Regressionsskydd: med viewport-fit=cover sträcker sig sidan in bakom iOS
 * statusrad, men Safari samplar body-färgen bara en gång vid sidladdning.
 * Vid SPA-navigering (t.ex. startsida → /auth) lämnas en rand i den gamla
 * färgens färg kvar högst upp. TopChromeStrip målar därför alltid rätt
 * ruttfärg över safe-area på touch-enheter — precis som BottomChromeStrip.
 *
 * Content-offset (som skjuter ner innehållet) får bara sättas i installerat
 * app-läge (standalone) — i webbläsaren hanterar sidorna safe-area själva.
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

  it('renderar remsa över safe-area i vanlig mobilwebbläsare, utan content-offset', () => {
    mockMatchMedia(false, true);
    const { container } = renderStrip();
    const strip = container.firstChild as HTMLElement;
    expect(strip).not.toBeNull();
    // jsdom parsar inte env() i style-attributet — läs råsträngen.
    expect(strip.getAttribute('style')).toContain('safe-area-inset-top');
    expect(
      document.documentElement.style.getPropertyValue('--top-chrome-content-offset')
    ).toBe('');
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
