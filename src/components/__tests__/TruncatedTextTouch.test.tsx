import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Regression: på mobil öppnade ett tryck tooltipen och Radix stängde den i
// samma klick, så hela namnet (t.ex. i Team) syntes aldrig.
describe('TruncatedText på touchskärm', () => {
  const originalMatchMedia = window.matchMedia;
  const scrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
  const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

  beforeAll(() => {
    (window as any).ontouchstart = null;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as any;
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 400 });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 100 });
  });

  afterAll(() => {
    delete (window as any).ontouchstart;
    window.matchMedia = originalMatchMedia;
    if (scrollWidth) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', scrollWidth);
    if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
  });

  it('visar hela texten när man trycker på ett kapat namn, och stänger vid nästa tryck', async () => {
    vi.resetModules();
    const { TruncatedText } = await import('@/components/ui/truncated-text');
    render(<TruncatedText text="Fredrik Andersson Långnamn" />);
    const trigger = screen.getByText('Fredrik Andersson Långnamn');

    await act(async () => {
      fireEvent.touchStart(trigger);
      fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      fireEvent.pointerUp(trigger, { pointerType: 'touch' });
      fireEvent.click(trigger);
    });
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Fredrik Andersson Långnamn');
    expect(trigger.getAttribute('data-state')).toMatch(/open/);

    await act(async () => {
      fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      fireEvent.pointerUp(trigger, { pointerType: 'touch' });
      fireEvent.click(trigger);
    });
    expect(trigger).toHaveAttribute('data-state', 'closed');
  });

  // Regression: Safari skickar emulerade mus-rörelser efter ett tryck (t.ex.
  // när en panel fälls ut under fingret). Radix öppnade då rutan i smyg och
  // användarens tryck stängde den i stället — namnet syntes aldrig.
  it('ignorerar emulerade musrörelser och öppnar på första riktiga trycket', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const { TruncatedText } = await import('@/components/ui/truncated-text');
    render(<TruncatedText text="Fredrik Andits Långnamn" />);
    const trigger = screen.getByText('Fredrik Andits Långnamn');

    await act(async () => {
      fireEvent.pointerMove(trigger, { pointerType: 'mouse' });
      vi.advanceTimersByTime(1000);
    });
    expect(trigger).toHaveAttribute('data-state', 'closed');
    vi.useRealTimers();

    await act(async () => {
      fireEvent.touchStart(trigger);
      fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      fireEvent.pointerUp(trigger, { pointerType: 'touch' });
      fireEvent.click(trigger);
    });
    expect(trigger.getAttribute('data-state')).toMatch(/open/);
  });
});

