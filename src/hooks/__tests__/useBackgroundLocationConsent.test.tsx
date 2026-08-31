import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  preciseAllowed: false,
  permissionListener: null as ((allowed: boolean) => void) | null,
  addWatcher: vi.fn(async (..._args: unknown[]) => 'native-watcher-1'),
  removeWatcher: vi.fn(async (..._args: unknown[]) => undefined),
  openSettings: vi.fn(async (..._args: unknown[]) => undefined),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({
    addWatcher: (...args: unknown[]) => h.addWatcher(...args),
    removeWatcher: (...args: unknown[]) => h.removeWatcher(...args),
    openSettings: (...args: unknown[]) => h.openSettings(...args),
  }),
}));

vi.mock('@/lib/gpsCoordinator', () => ({
  canUsePreciseLocation: vi.fn(async () => h.preciseAllowed),
  subscribeToPreciseLocationPermission: (listener: (allowed: boolean) => void) => {
    h.permissionListener = listener;
    return () => {
      if (h.permissionListener === listener) h.permissionListener = null;
    };
  },
}));

import { useBackgroundLocation } from '@/hooks/useBackgroundLocation';

describe('useBackgroundLocation in-app consent', () => {
  beforeEach(() => {
    h.preciseAllowed = false;
    h.permissionListener = null;
    h.addWatcher.mockClear();
    h.removeWatcher.mockClear();
    h.openSettings.mockClear();
  });

  it('does not auto-start native exact tracking and follows explicit grant/revoke', async () => {
    renderHook(() => useBackgroundLocation({ enabled: true }));

    await act(async () => { await Promise.resolve(); });
    expect(h.addWatcher).not.toHaveBeenCalled();

    h.preciseAllowed = true;
    act(() => h.permissionListener?.(true));
    await waitFor(() => expect(h.addWatcher).toHaveBeenCalledTimes(1));

    h.preciseAllowed = false;
    act(() => h.permissionListener?.(false));
    await waitFor(() => expect(h.removeWatcher).toHaveBeenCalledWith({ id: 'native-watcher-1' }));
  });
});
