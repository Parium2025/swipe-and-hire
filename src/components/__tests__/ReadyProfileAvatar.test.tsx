import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadyProfileAvatar } from '../ReadyProfileAvatar';

const pending: Array<{ resolve: () => void; reject: () => void }> = [];
class DeferredImage {
  naturalWidth = 32;
  src = '';
  onload = null;
  onerror = null;
  decode() {
    return new Promise<void>((resolve, reject) => pending.push({ resolve, reject }));
  }
}
afterEach(() => { vi.unstubAllGlobals(); pending.length = 0; });

describe('ready header portrait', () => {
  it('keeps skeleton and blocks clicks until decoding finishes', async () => {
    vi.stubGlobal('Image', DeferredImage);
    const onClick = vi.fn();
    const { container } = render(<ReadyProfileAvatar src="first" accountId="a" profileReady onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Min profil' });
    expect(button).toBeDisabled();
    expect(container.querySelector('[data-profile-avatar-skeleton]')).not.toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    await act(async () => pending[0]?.resolve());
    expect(button).not.toBeDisabled();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'first');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows skeleton for a replacement and discards delayed previous-account media', async () => {
    vi.stubGlobal('Image', DeferredImage);
    const onClick = vi.fn();
    const { rerender } = render(<ReadyProfileAvatar src="first" accountId="a" profileReady onClick={onClick} />);
    await act(async () => pending[0]?.resolve());
    rerender(<ReadyProfileAvatar src="second" accountId="a" profileReady onClick={onClick} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('button', { name: 'Min profil' })).toBeDisabled();
    rerender(<ReadyProfileAvatar src="third" accountId="b" profileReady onClick={onClick} />);
    expect(screen.queryByRole('img')).toBeNull();
    await act(async () => pending[1]?.resolve());
    expect(screen.queryByRole('img')).toBeNull();
    await act(async () => pending[2]?.resolve());
    expect(screen.getByRole('img')).toHaveAttribute('src', 'third');
  });

  it('allows profile access after failed loading without showing initials', async () => {
    vi.stubGlobal('Image', DeferredImage);
    render(<ReadyProfileAvatar src="broken" accountId="a" profileReady onClick={() => {}} />);
    await act(async () => pending[0]?.reject());
    expect(screen.getByRole('button', { name: 'Min profil' })).not.toBeDisabled();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('never decodes or displays media while account profile is unknown', async () => {
    vi.stubGlobal('Image', DeferredImage);
    const { rerender } = render(<ReadyProfileAvatar src="cached" accountId="a" profileReady={false} onClick={() => {}} />);
    expect(pending).toHaveLength(0);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('button', { name: 'Min profil' })).toBeDisabled();
    rerender(<ReadyProfileAvatar src="current" accountId="a" profileReady onClick={() => {}} />);
    await act(async () => pending[0]?.resolve());
    expect(screen.getByRole('img')).toHaveAttribute('src', 'current');
    rerender(<ReadyProfileAvatar src="current" accountId="a" profileReady={false} onClick={() => {}} />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('does not reuse failed loading for the same URL on a different account', async () => {
    vi.stubGlobal('Image', DeferredImage);
    const { rerender } = render(<ReadyProfileAvatar src="same" accountId="a" profileReady onClick={() => {}} />);
    await act(async () => pending[0]?.reject());
    rerender(<ReadyProfileAvatar src="same" accountId="b" profileReady onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Min profil' })).toBeDisabled();
    await act(async () => pending[1]?.resolve());
    expect(screen.getByRole('img')).toHaveAttribute('src', 'same');
  });
});