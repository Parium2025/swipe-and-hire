import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Touch tooltips require a deliberate hold; short taps retain the parent action.
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

  afterEach(() => vi.useRealTimers());

  it('visar hela texten först under långtryck och stänger vid nästa korta tryck', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const { TruncatedText } = await import('@/components/ui/truncated-text');
    render(<TruncatedText text="Fredrik Andersson Långnamn" />);
    const trigger = screen.getByText('Fredrik Andersson Långnamn');

    await act(async () => {
      fireEvent.touchStart(trigger);
      fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      vi.advanceTimersByTime(499);
    });
    expect(trigger).toHaveAttribute('data-state', 'closed');
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(trigger.getAttribute('data-state')).toMatch(/open/);
    await act(async () => {
      fireEvent.touchEnd(trigger);
      fireEvent.pointerUp(trigger, { pointerType: 'touch' });
      fireEvent.click(trigger);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Fredrik Andersson Långnamn');
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
  it('ignorerar emulerade musrörelser och låter korta tryck nå föräldern utan tooltip', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const { TruncatedText } = await import('@/components/ui/truncated-text');
    const parentClick = vi.fn();
    render(<div onClick={parentClick}><TruncatedText text="Fredrik Andits Långnamn" /></div>);
    const trigger = screen.getByText('Fredrik Andits Långnamn');

    await act(async () => {
      fireEvent.pointerMove(trigger, { pointerType: 'mouse' });
      vi.advanceTimersByTime(1000);
    });
    expect(trigger).toHaveAttribute('data-state', 'closed');

    await act(async () => {
      fireEvent.touchStart(trigger);
      fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      vi.advanceTimersByTime(100);
      fireEvent.touchEnd(trigger);
      fireEvent.pointerUp(trigger, { pointerType: 'touch' });
      fireEvent.click(trigger);
    });
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(trigger).toHaveAttribute('data-state', 'closed');
    expect(parentClick).toHaveBeenCalledTimes(1);
  });

  it.each(['touchMove', 'touchCancel'] as const)('avbryter långtryck vid %s', async (event) => {
    vi.resetModules();
    vi.useFakeTimers();
    const { TruncatedText } = await import('@/components/ui/truncated-text');
    render(<TruncatedText text="Ett långt kandidatsteg" />);
    const trigger = screen.getByText('Ett långt kandidatsteg');
    await act(async () => {
      fireEvent.touchStart(trigger);
      vi.advanceTimersByTime(200);
      fireEvent[event](trigger);
      vi.advanceTimersByTime(1000);
    });
    expect(trigger).toHaveAttribute('data-state', 'closed');
  });

  it('hindrar långtryckets efterföljande klick från att öppna förälderns meny', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const { TruncatedText } = await import('@/components/ui/truncated-text');
    const parentClick = vi.fn();
    render(<div onClick={parentClick}><TruncatedText text="Ett långt steg med meny" /></div>);
    const trigger = screen.getByText('Ett långt steg med meny');
    await act(async () => {
      fireEvent.touchStart(trigger);
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      fireEvent.touchEnd(trigger);
      fireEvent.click(trigger);
    });
    expect(trigger.getAttribute('data-state')).toMatch(/open/);
    expect(parentClick).not.toHaveBeenCalled();
  });

  // Nyhetskortet och karriärtipset delar beteende: ett kort tryck öppnar
  // artikeln (förälderns åtgärd) och ett långtryck visar tooltipen.
  it('låter korta tryck öppna artikeln och långtryck visa tooltipen', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const { TruncatedText } = await import('@/components/TruncatedText');
    const openArticle = vi.fn();
    render(
      <div onClick={openArticle}>
        <TruncatedText text="Nordnet rekryterar ny Sverigechef" />
      </div>
    );
    const trigger = screen.getByText('Nordnet rekryterar ny Sverigechef');

    // Kort tryck → artikeln öppnas, ingen tooltip.
    await act(async () => {
      fireEvent.touchStart(trigger);
      fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      vi.advanceTimersByTime(100);
      fireEvent.touchEnd(trigger);
      fireEvent.pointerUp(trigger, { pointerType: 'touch' });
      fireEvent.click(trigger);
    });
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(openArticle).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('tooltip')).toBeNull();

    // Långtryck → tooltipen visas, artikeln öppnas inte igen.
    await act(async () => {
      fireEvent.touchStart(trigger);
      fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      vi.advanceTimersByTime(500);
      fireEvent.touchEnd(trigger);
      fireEvent.pointerUp(trigger, { pointerType: 'touch' });
      fireEvent.click(trigger);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Nordnet rekryterar ny Sverigechef');
    expect(openArticle).toHaveBeenCalledTimes(1);
  });
});

