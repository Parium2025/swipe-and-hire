import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileMyCandidatesView } from '@/components/candidates/MobileMyCandidatesView';

vi.mock('@/hooks/useInputCapability', () => ({ useTouchCapable: () => true }));
vi.mock('@/hooks/useDragScroll', () => ({ useDragScroll: () => () => {} }));
vi.mock('@/hooks/useSwipeGesture', () => ({ useSwipeGesture: () => ({}), useHorizontalSwipeLock: () => () => {} }));
vi.mock('@/components/CreateStageDialog', () => ({ CreateStageDialog: () => null }));
vi.mock('@/components/StageSettingsMenu', () => ({
  StageSettingsMenu: ({ open, onOpenChange, onTriggerPointerDown }: {
    open: boolean; onOpenChange: (open: boolean) => void; onTriggerPointerDown: () => void;
  }) => <button aria-label="Stegmeny" onPointerDown={onTriggerPointerDown} onClick={() => onOpenChange(!open)}>{open ? 'Meny öppen' : 'Meny stängd'}</button>,
}));

const label = 'Ett mycket långt kandidatsteg';
const setup = () => {
  render(<MobileMyCandidatesView candidates={[]} stages={['custom']} stageConfig={{ custom: { label, color: '#123456', iconName: 'inbox' } }} onOpenProfile={vi.fn()} onMoveToStage={vi.fn()} />);
  const text = screen.getByText(label);
  const tab = text.closest('[data-stage-tab]');
  if (!tab) throw new Error('Stage tab missing');
  return { text, tab, menu: screen.getByRole('button', { name: 'Stegmeny' }) };
};

// JSDOM lacks PointerEvent.pointerType; supply the real touch discriminator.
const press = (element: Element) => {
  const event = new Event('pointerdown', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  fireEvent(element, event);
};

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Mobile candidate stage tooltip and menu', () => {
  it('does not open the tooltip on a short tap', async () => {
    vi.useFakeTimers();
    const { text, tab } = setup();
    await act(async () => { press(tab); vi.advanceTimersByTime(100); fireEvent.pointerUp(tab); fireEvent.click(tab); vi.advanceTimersByTime(800); });
    expect(text).toHaveAttribute('data-state', 'closed');
  });

  it('shows the tooltip while held, then closes it when the menu is pressed', async () => {
    vi.useFakeTimers();
    const { text, tab, menu } = setup();
    await act(async () => { press(tab); vi.advanceTimersByTime(500); });
    expect(text).toHaveAttribute('data-state', 'delayed-open');
    await act(async () => { fireEvent.pointerUp(tab); press(menu); fireEvent.click(menu); });
    expect(text).toHaveAttribute('data-state', 'closed');
    expect(menu).toHaveTextContent('Meny öppen');
  });

  it('never starts a label long press from the ellipsis menu', async () => {
    vi.useFakeTimers();
    const { text, menu } = setup();
    await act(async () => { press(menu); vi.advanceTimersByTime(800); fireEvent.click(menu); });
    expect(text).toHaveAttribute('data-state', 'closed');
    expect(menu).toHaveTextContent('Meny öppen');
  });
});