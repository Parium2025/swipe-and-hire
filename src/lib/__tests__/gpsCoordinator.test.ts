import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAccuratePosition = vi.fn();
const wasLastPositionDenied = vi.fn(() => false);
const checkGpsPermission = vi.fn<() => Promise<'granted' | 'denied' | 'prompt'>>(
  async () => 'granted',
);

vi.mock('@/lib/gpsUtils', () => ({
  getAccuratePosition: () => getAccuratePosition(),
  wasLastPositionDenied: () => wasLastPositionDenied(),
  checkGpsPermission: () => checkGpsPermission(),
}));

import {
  resolvePosition,
  notePermissionGranted,
  notePermissionRevoked,
  resetPreciseLocationConsent,
  subscribeToPreciseLocationPermission,
  isPositionBlocked,
  resetGpsCoordinator,
} from '@/lib/gpsCoordinator';

describe('gpsCoordinator', () => {
  beforeEach(() => {
    resetGpsCoordinator();
    getAccuratePosition.mockReset();
    wasLastPositionDenied.mockReset();
    wasLastPositionDenied.mockReturnValue(false);
    checkGpsPermission.mockReset();
    checkGpsPermission.mockResolvedValue('granted');
  });

  it.each(['prompt', 'denied'] as const)(
    'does not touch precise GPS while permission is %s',
    async (permission) => {
      checkGpsPermission.mockResolvedValue(permission);
      getAccuratePosition.mockResolvedValue({ lat: 59.33, lon: 18.07, accuracy: 10 });

      await expect(resolvePosition()).resolves.toBeNull();

      expect(getAccuratePosition).not.toHaveBeenCalled();
    },
  );

  it('does not auto-start precise GPS after reload just because OS permission is already granted', async () => {
    checkGpsPermission.mockResolvedValue('granted');
    getAccuratePosition.mockResolvedValue({ lat: 59.33, lon: 18.07, accuracy: 10 });

    await expect(resolvePosition()).resolves.toBeNull();

    expect(getAccuratePosition).not.toHaveBeenCalled();
  });

  it('emits a fail-closed reset at an account boundary even when consent is already idle', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToPreciseLocationPermission(listener);

    // Reload/account hydration starts with no explicit consent and no request
    // in flight. The account boundary must still invalidate mounted consumers
    // that may hold GPS-derived cache from the previous owner.
    resetPreciseLocationConsent();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(false);
    unsubscribe();
  });

  it('allows a deliberate in-session opt-in even when the Permissions API still reports prompt', async () => {
    checkGpsPermission.mockResolvedValue('prompt');
    getAccuratePosition.mockResolvedValue({ lat: 59.33, lon: 18.07, accuracy: 10 });

    notePermissionGranted();

    await expect(resolvePosition()).resolves.toEqual({ lat: 59.33, lon: 18.07, accuracy: 10 });
    expect(getAccuratePosition).toHaveBeenCalledTimes(1);
  });

  it('fails closed when permission is denied after an in-session grant', async () => {
    notePermissionGranted();
    checkGpsPermission.mockResolvedValue('denied');
    getAccuratePosition.mockResolvedValue({ lat: 59.33, lon: 18.07, accuracy: 10 });

    await expect(resolvePosition()).resolves.toBeNull();

    expect(getAccuratePosition).not.toHaveBeenCalled();
  });

  it('discards a deferred exact fix that settles after consent is revoked', async () => {
    notePermissionGranted();
    let settleFix: (fix: { lat: number; lon: number; accuracy: number }) => void = () => {};
    getAccuratePosition.mockImplementation(
      () => new Promise((resolve) => { settleFix = resolve; }),
    );

    const pending = resolvePosition();
    await vi.waitFor(() => expect(getAccuratePosition).toHaveBeenCalledTimes(1));
    notePermissionRevoked();
    settleFix({ lat: 59.33, lon: 18.07, accuracy: 10 });

    await expect(pending).resolves.toBeNull();
  });

  it('collapses concurrent calls into a single GPS request', async () => {
    notePermissionGranted();
    let resolveFix: (v: unknown) => void = () => {};
    getAccuratePosition.mockImplementation(
      () => new Promise((res) => { resolveFix = res; }),
    );

    const a = resolvePosition();
    const b = resolvePosition();
    await vi.waitFor(() => expect(getAccuratePosition).toHaveBeenCalledTimes(1));
    resolveFix({ lat: 1, lon: 2, accuracy: 10 });

    const [ra, rb] = await Promise.all([a, b]);
    expect(getAccuratePosition).toHaveBeenCalledTimes(1);
    expect(ra).toEqual({ lat: 1, lon: 2, accuracy: 10 });
    expect(rb).toEqual(ra);
  });

  it('stops calling GPS after a denied permission', async () => {
    notePermissionGranted();
    getAccuratePosition.mockResolvedValue(null);
    wasLastPositionDenied.mockReturnValue(true);

    expect(await resolvePosition()).toBeNull();
    expect(isPositionBlocked()).toBe(true);

    expect(await resolvePosition()).toBeNull();
    expect(getAccuratePosition).toHaveBeenCalledTimes(1);
  });

  it('resumes immediately when permission is granted', async () => {
    notePermissionGranted();
    getAccuratePosition.mockResolvedValue(null);
    wasLastPositionDenied.mockReturnValue(true);
    await resolvePosition();
    expect(isPositionBlocked()).toBe(true);

    notePermissionGranted();
    expect(isPositionBlocked()).toBe(false);

    wasLastPositionDenied.mockReturnValue(false);
    getAccuratePosition.mockResolvedValue({ lat: 5, lon: 6, accuracy: 20 });
    expect(await resolvePosition()).toEqual({ lat: 5, lon: 6, accuracy: 20 });
    expect(getAccuratePosition).toHaveBeenCalledTimes(2);
  });

  it('does not block when a normal (non-denied) failure occurs', async () => {
    notePermissionGranted();
    getAccuratePosition.mockResolvedValue(null);
    wasLastPositionDenied.mockReturnValue(false);

    await resolvePosition();
    expect(isPositionBlocked()).toBe(false);
    await resolvePosition();
    expect(getAccuratePosition).toHaveBeenCalledTimes(2);
  });
});
