import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAccuratePosition = vi.fn();
const wasLastPositionDenied = vi.fn(() => false);

vi.mock('@/lib/gpsUtils', () => ({
  getAccuratePosition: () => getAccuratePosition(),
  wasLastPositionDenied: () => wasLastPositionDenied(),
}));

import {
  resolvePosition,
  notePermissionGranted,
  isPositionBlocked,
  resetGpsCoordinator,
} from '@/lib/gpsCoordinator';

describe('gpsCoordinator', () => {
  beforeEach(() => {
    resetGpsCoordinator();
    getAccuratePosition.mockReset();
    wasLastPositionDenied.mockReset();
    wasLastPositionDenied.mockReturnValue(false);
  });

  it('collapses concurrent calls into a single GPS request', async () => {
    let resolveFix: (v: unknown) => void = () => {};
    getAccuratePosition.mockImplementation(
      () => new Promise((res) => { resolveFix = res; }),
    );

    const a = resolvePosition();
    const b = resolvePosition();
    resolveFix({ lat: 1, lon: 2, accuracy: 10 });

    const [ra, rb] = await Promise.all([a, b]);
    expect(getAccuratePosition).toHaveBeenCalledTimes(1);
    expect(ra).toEqual({ lat: 1, lon: 2, accuracy: 10 });
    expect(rb).toEqual(ra);
  });

  it('stops calling GPS after a denied permission', async () => {
    getAccuratePosition.mockResolvedValue(null);
    wasLastPositionDenied.mockReturnValue(true);

    expect(await resolvePosition()).toBeNull();
    expect(isPositionBlocked()).toBe(true);

    expect(await resolvePosition()).toBeNull();
    expect(getAccuratePosition).toHaveBeenCalledTimes(1);
  });

  it('resumes immediately when permission is granted', async () => {
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
    getAccuratePosition.mockResolvedValue(null);
    wasLastPositionDenied.mockReturnValue(false);

    await resolvePosition();
    expect(isPositionBlocked()).toBe(false);
    await resolvePosition();
    expect(getAccuratePosition).toHaveBeenCalledTimes(2);
  });
});
