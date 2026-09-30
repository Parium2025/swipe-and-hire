import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Regression (Team, iPhone): "Fredrik Andits" klamras till en rad. Namnet bryts
// vid mellanslaget och rad två döljs — bredden svämmar bara över 1 px. Mätningen
// satte nowrap innan höjden mättes, såg "får plats" och rutan öppnades aldrig.
describe('TruncatedText: klamrad rad som bryts vid mellanslag', () => {
  const originalMatchMedia = window.matchMedia;
  const originalGetComputedStyle = window.getComputedStyle;
  const props = ['scrollWidth', 'clientWidth', 'scrollHeight', 'clientHeight'] as const;
  const saved = props.map((p) => [p, Object.getOwnPropertyDescriptor(HTMLElement.prototype, p)] as const);

  beforeAll(() => {
    (window as any).ontouchstart = null;
    window.matchMedia = ((query: string) => ({
      matches: false, media: query, onchange: null,
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
  });

  afterAll(() => {
    delete (window as any).ontouchstart;
    window.matchMedia = originalMatchMedia;
    window.getComputedStyle = originalGetComputedStyle;
    for (const [p, d] of saved) if (d) Object.defineProperty(HTMLElement.prototype, p, d);
  });

  it('öppnar rutan med hela namnet vid tryck', async () => {
    vi.resetModules();
    const { TruncatedText } = await import('@/components/ui/truncated-text');
    render(<TruncatedText text="Fredrik Andits" />);
    const trigger = screen.getByText('Fredrik Andits');

    await act(async () => {
      fireEvent.touchStart(trigger);
      fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      fireEvent.pointerUp(trigger, { pointerType: 'touch' });
      fireEvent.click(trigger);
    });
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Fredrik Andits');
  });
});
