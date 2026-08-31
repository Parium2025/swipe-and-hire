/**
 * GpsPrompt ägs av Home. När Home är dold (KeepAlive) får ingen GPS-koll,
 * 10s-timer, permission-lyssnare eller portal leva vidare på /index.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';

const checkGpsPermission = vi.fn();
vi.mock('@/lib/gpsUtils', () => ({
  checkGpsPermission: (...args: unknown[]) => checkGpsPermission(...args),
  requestGpsPermission: vi.fn(),
  isNativeApp: () => false,
}));

vi.mock('@/lib/gpsCoordinator', () => ({ notePermissionGranted: vi.fn() }));

vi.mock('@/components/GpsHelpModal', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="gps-help" /> : null),
}));

import GpsPrompt from '@/components/GpsPrompt';

const addEventListener = vi.fn();
const removeEventListener = vi.fn();

describe('GpsPrompt är Home-scopad', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    checkGpsPermission.mockReset();
    checkGpsPermission.mockResolvedValue('prompt');
    addEventListener.mockClear();
    removeEventListener.mockClear();
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: 'prompt', addEventListener, removeEventListener }),
      },
    });
  });

  afterEach(() => { vi.useRealTimers(); });

  it('active=false skapar ingen koll, timer, lyssnare eller UI', async () => {
    render(<GpsPrompt active={false} />);
    await act(async () => { await Promise.resolve(); });
    expect(checkGpsPermission).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(screen.queryByTestId('gps-help')).toBeNull();
    expect(document.body.textContent).not.toContain('Aktivera plats');
  });

  it('inaktivering städar lyssnare och sena promises kan inte visa UI', async () => {
    const { rerender } = render(<GpsPrompt active={true} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(checkGpsPermission).toHaveBeenCalledTimes(1);

    rerender(<GpsPrompt active={false} />);
    expect(removeEventListener).toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(30_000); await Promise.resolve(); });
    expect(document.body.textContent).not.toContain('Aktivera plats');
  });

  it('återaktivering startar exakt en ny koll och lyssnare', async () => {
    const { rerender } = render(<GpsPrompt active={true} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    rerender(<GpsPrompt active={false} />);
    checkGpsPermission.mockClear();
    addEventListener.mockClear();
    rerender(<GpsPrompt active={true} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(checkGpsPermission).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledTimes(1);
  });
});
