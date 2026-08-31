import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const checkGpsPermission = vi.fn();
const notePermissionGranted = vi.fn();
const notePermissionRevoked = vi.fn();

vi.mock('@/lib/gpsUtils', () => ({
  checkGpsPermission: (...args: unknown[]) => checkGpsPermission(...args),
  requestGpsPermission: vi.fn(),
  isNativeApp: () => false,
}));

vi.mock('@/lib/gpsCoordinator', () => ({
  notePermissionGranted: (...args: unknown[]) => notePermissionGranted(...args),
  notePermissionRevoked: (...args: unknown[]) => notePermissionRevoked(...args),
  canUsePreciseLocation: vi.fn(async () => false),
}));

vi.mock('@/components/GpsHelpModal', () => ({
  default: () => null,
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    button: ({ children, onClick, className, 'aria-label': ariaLabel }: Record<string, unknown>) => (
      <button onClick={onClick as () => void} className={className as string} aria-label={ariaLabel as string}>
        {children as React.ReactNode}
      </button>
    ),
    div: ({ children, className }: Record<string, unknown>) => (
      <div className={className as string}>{children as React.ReactNode}</div>
    ),
  },
}));

import GpsPrompt from '@/components/GpsPrompt';

describe('GpsPrompt precise-location opt-in', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    checkGpsPermission.mockReset();
    checkGpsPermission.mockResolvedValue('prompt');
    notePermissionGranted.mockReset();
    notePermissionRevoked.mockReset();

    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({
          state: 'prompt',
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (navigator as { geolocation?: unknown }).geolocation;
  });

  it('keeps the existing opt-in reachable when coarse IP weather is already available', async () => {
    let success: (() => void) | undefined;
    const getCurrentPosition = vi.fn((onSuccess: () => void) => {
      success = onSuccess;
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<GpsPrompt weatherAvailable keepOptInReachableWhenWeatherAvailable active />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(10_001);
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Visa platsinformation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aktivera' }));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    act(() => success?.());
    expect(notePermissionGranted).toHaveBeenCalledTimes(1);
  });

  it('keeps Jobseeker opt-in reachable when OS permission is already granted', async () => {
    checkGpsPermission.mockResolvedValue('granted');
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: vi.fn() },
    });

    render(<GpsPrompt weatherAvailable keepOptInReachableWhenWeatherAvailable active />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(10_001);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Visa platsinformation' })).toBeTruthy();
    expect(notePermissionGranted).not.toHaveBeenCalled();
  });

  it('preserves Employer suppression when coarse weather is already available', async () => {
    render(<GpsPrompt weatherAvailable active />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(10_001);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByRole('button', { name: 'Visa platsinformation' })).toBeNull();
  });

  it.each([2, 3])('keeps transient geolocation error code %s retryable without revoking consent', async (code) => {
    let failure: PositionErrorCallback | undefined;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((_success: PositionCallback, onError: PositionErrorCallback) => {
          failure = onError;
        }),
      },
    });

    render(<GpsPrompt keepOptInReachableWhenWeatherAvailable active />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(10_001);
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Visa platsinformation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aktivera' }));

    act(() => failure?.({ code, message: 'transient geolocation error' } as GeolocationPositionError));

    expect(notePermissionRevoked).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Aktivera' })).toBeTruthy();
    expect(screen.queryByText('Plats är blockerad')).toBeNull();
  });

  it('treats only a permission-denied geolocation error as revocation', async () => {
    let failure: PositionErrorCallback | undefined;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((_success: PositionCallback, onError: PositionErrorCallback) => {
          failure = onError;
        }),
      },
    });

    render(<GpsPrompt keepOptInReachableWhenWeatherAvailable active />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(10_001);
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Visa platsinformation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aktivera' }));

    act(() => failure?.({ code: 1, message: 'permission denied' } as GeolocationPositionError));

    expect(notePermissionRevoked).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Plats är blockerad')).toBeTruthy();
  });
});
