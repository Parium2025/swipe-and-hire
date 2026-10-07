import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

describe('Listnamn vid mushovring', () => {
  it('visar hela namnet även när texten får plats', async () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    try {
      vi.resetModules();
      const { TruncatedText } = await import('@/components/ui/truncated-text');
      render(<TruncatedText text="Det är fest nu 😊" lines={2} insideInteractive alwaysShowTooltip="desktop-only" />);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      fireEvent.mouseEnter(screen.getByText('Det är fest nu 😊'));
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Det är fest nu 😊');
    } finally {
      window.matchMedia = original;
    }
  });
});