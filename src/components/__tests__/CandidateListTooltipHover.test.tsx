import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// Tooltipen ska ENDAST visas när texten faktiskt klipps — aldrig när den får plats.
describe('Listnamn vid mushovring', () => {
  it('visar inte tooltip när texten får plats', async () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    try {
      vi.resetModules();
      const { TruncatedText } = await import('@/components/ui/truncated-text');
      render(<TruncatedText text="Det är fest nu 😊" lines={2} insideInteractive />);
      fireEvent.mouseEnter(screen.getByText('Det är fest nu 😊'));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });

  it('visar tooltip när texten är klippt', async () => {
    const originalMatchMedia = window.matchMedia;
    const originalGetComputedStyle = window.getComputedStyle;
    const props = ['scrollWidth', 'clientWidth', 'scrollHeight', 'clientHeight'] as const;
    const saved = props.map((p) => [p, Object.getOwnPropertyDescriptor(HTMLElement.prototype, p)] as const);

    window.matchMedia = ((query: string) => ({
      matches: true, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as any;
    window.getComputedStyle = ((el: Element) => {
      const real = originalGetComputedStyle(el);
      return new Proxy(real, {
        get(target, key) {
          if (key === 'getPropertyValue') {
            return (name: string) => (name === '-webkit-line-clamp' ? '1' : target.getPropertyValue(name));
          }
          const v = (target as any)[key];
          return typeof v === 'function' ? v.bind(target) : v;
        },
      });
    }) as any;
    const nowrap = (el: HTMLElement) => el.style.whiteSpace === 'nowrap';
    const clamped = (el: HTMLElement) => el.style.display !== 'block';
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 91 });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get() { return nowrap(this) ? 92 : 91; } });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 23 });
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() { return clamped(this) || nowrap(this) ? 23 : 42; },
    });

    try {
      vi.resetModules();
      const { TruncatedText } = await import('@/components/ui/truncated-text');
      render(<TruncatedText text="Fredrik Andits" lines={1} insideInteractive />);
      fireEvent.mouseEnter(screen.getByText('Fredrik Andits'));
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Fredrik Andits');
    } finally {
      window.matchMedia = originalMatchMedia;
      window.getComputedStyle = originalGetComputedStyle;
      for (const [p, d] of saved) if (d) Object.defineProperty(HTMLElement.prototype, p, d);
    }
  });
});
