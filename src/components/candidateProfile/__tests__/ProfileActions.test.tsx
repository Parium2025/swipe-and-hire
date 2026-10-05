import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileActions } from '../ProfileActions';

afterEach(cleanup);

describe('ProfileActions list action', () => {
  const defaults = {
    variant: 'all-candidates' as const,
    hasTeam: true,
    onSendMessage: vi.fn(),
    onBookInterview: vi.fn(),
    onShare: vi.fn(),
  };

  it('uses the supplied add handler and changes from plus to check', () => {
    const onAddToList = vi.fn();
    const { rerender } = render(<ProfileActions {...defaults} onAddToList={onAddToList} isAddedToList={false} />);
    const add = screen.getByRole('button', { name: 'Lägg till i kandidatlista' });
    expect(add.querySelector('.lucide-user-plus')).not.toBeNull();
    fireEvent.click(add);
    expect(onAddToList).toHaveBeenCalledTimes(1);
    rerender(<ProfileActions {...defaults} onAddToList={onAddToList} isAddedToList />);
    const saved = screen.getByRole('button', { name: 'Kandidaten finns i din lista – öppna listväljaren' });
    expect(saved.querySelector('.lucide-user-check')).not.toBeNull();
    fireEvent.click(saved);
    expect(onAddToList).toHaveBeenCalledTimes(2);
  });

  it('prevents actions while membership or a save is pending', () => {
    const onAddToList = vi.fn();
    render(<ProfileActions {...defaults} onAddToList={onAddToList} isAddedToList={false} isListActionPending />);
    fireEvent.click(screen.getByRole('button', { name: 'Lägg till i kandidatlista' }));
    expect(onAddToList).not.toHaveBeenCalled();
  });

  it('does not add a control when no handler is supplied', () => {
    render(<ProfileActions {...defaults} />);
    expect(screen.queryByRole('button', { name: 'Lägg till i kandidatlista' })).toBeNull();
  });
});