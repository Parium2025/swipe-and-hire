import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { useCloseOnRouteChange } from '../useCloseOnRouteChange';

let nav: (to: string) => void = () => {};
function Probe({ open, onClose }: { open: boolean; onClose: () => void }) {
  nav = useNavigate();
  useCloseOnRouteChange(open, onClose);
  return null;
}

describe('useCloseOnRouteChange', () => {
  it('stänger ett öppet lager vid sidbyte', () => {
    const onClose = vi.fn();
    render(<MemoryRouter initialEntries={['/my-candidates']}><Probe open onClose={onClose} /></MemoryRouter>);
    expect(onClose).not.toHaveBeenCalled();
    act(() => nav('/messages'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('gör inget när lagret är stängt', () => {
    const onClose = vi.fn();
    render(<MemoryRouter initialEntries={['/a']}><Probe open={false} onClose={onClose} /></MemoryRouter>);
    act(() => nav('/b'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('öppnat på en ny sida stängs inte direkt', () => {
    const onClose = vi.fn();
    const { rerender } = render(<MemoryRouter initialEntries={['/a']}><Probe open={false} onClose={onClose} /></MemoryRouter>);
    act(() => nav('/b'));
    rerender(<MemoryRouter initialEntries={['/a']}><Probe open onClose={onClose} /></MemoryRouter>);
    expect(onClose).not.toHaveBeenCalled();
  });
});
