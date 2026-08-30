/**
 * RED: GpsPrompts effekt-promises är skyddade, men handleEnableGps har
 * asynkrona fortsättningar (native requestGpsPermission samt webbens
 * getCurrentPosition success/error) som kan resolva efter active=false och
 * mutera stale state eller anropa onEnableGps.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';

const checkGpsPermission = vi.fn();
const requestGpsPermission = vi.fn();
let native = false;
vi.mock('@/lib/gpsUtils', () => ({
  checkGpsPermission: (...args: unknown[]) => checkGpsPermission(...args),
  requestGpsPermission: (...args: unknown[]) => requestGpsPermission(...args),
  isNativeApp: () => native,
}));

vi.mock('@/lib/gpsCoordinator', () => ({ notePermissionGranted: vi.fn() }));

vi.mock('@/components/GpsHelpModal', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="gps-help" /> : null),
}));

let GpsPrompt: typeof import('@/components/GpsPrompt').default;

async function renderVisiblePrompt(active = true, onEnableGps?: () => void) {
  const utils = render(<GpsPrompt active={active} onEnableGps={onEnableGps} />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  await act(async () => { vi.advanceTimersByTime(11_000); await Promise.resolve(); await Promise.resolve(); });
  // Prompten renderas minimerad — expandera för att nå Aktivera-knappen.
  const mini = screen.queryByRole('button', { name: 'Visa platsinformation' });
  if (mini) fireEvent.click(mini);
  return utils;
}

describe('GpsPrompt: asynkrona fortsättningar efter inaktivering är döda', () => {
  beforeEach(async () => {
    vi.resetModules();
    GpsPrompt = (await import('@/components/GpsPrompt')).default;
    vi.useFakeTimers();
    native = false;
    checkGpsPermission.mockReset();
    checkGpsPermission.mockResolvedValue('prompt');
    requestGpsPermission.mockReset();
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: vi.fn().mockResolvedValue({ state: 'prompt', addEventListener: vi.fn(), removeEventListener: vi.fn() }) },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (navigator as { geolocation?: unknown }).geolocation;
  });

  it('native requestGpsPermission som resolvar efter active=false anropar inte onEnableGps och muterar inte state', async () => {
    native = true;
    let resolvePermission: (v: boolean) => void = () => {};
    requestGpsPermission.mockReturnValue(new Promise<boolean>((res) => { resolvePermission = res; }));
    const onEnableGps = vi.fn();

    const { rerender } = await renderVisiblePrompt(true, onEnableGps);
    expect(document.body.textContent).toContain('Aktivera plats');

    fireEvent.click(screen.getByRole('button', { name: 'Aktivera' }));
    expect(requestGpsPermission).toHaveBeenCalledTimes(1);

    // Navigera bort innan native-dialogen svarar
    rerender(<GpsPrompt active={false} onEnableGps={onEnableGps} />);
    await act(async () => { resolvePermission(true); await Promise.resolve(); });

    expect(onEnableGps).not.toHaveBeenCalled();

    // Återaktivering: en helt ny koll, inget stale 'granted'-läge kvar
    checkGpsPermission.mockClear();
    rerender(<GpsPrompt active={true} onEnableGps={onEnableGps} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(checkGpsPermission).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(11_000); await Promise.resolve(); await Promise.resolve(); });
    expect(document.body.textContent).toContain('Aktivera plats');
  });

  it('web success-callback efter active=false anropar inte onEnableGps och muterar inte state', async () => {
    let successCb: (() => void) | null = null;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: vi.fn((ok: () => void) => { successCb = ok; }) },
    });
    const onEnableGps = vi.fn();

    const { rerender } = await renderVisiblePrompt(true, onEnableGps);
    fireEvent.click(screen.getByRole('button', { name: 'Aktivera' }));
    expect(successCb).not.toBeNull();

    rerender(<GpsPrompt active={false} onEnableGps={onEnableGps} />);
    act(() => { successCb!(); });

    expect(onEnableGps).not.toHaveBeenCalled();

    // Återaktivering startar från normal färsk koll — inte ett stale 'granted'
    checkGpsPermission.mockClear();
    rerender(<GpsPrompt active={true} onEnableGps={onEnableGps} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(checkGpsPermission).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(11_000); await Promise.resolve(); await Promise.resolve(); });
    expect(document.body.textContent).toContain('Aktivera plats');
  });

  it('web error-callback efter active=false visar inte UI vid återaktivering utan färsk koll', async () => {
    let errorCb: ((e: GeolocationPositionError) => void) | null = null;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: vi.fn((_ok: () => void, err: (e: GeolocationPositionError) => void) => { errorCb = err; }) },
    });
    const onEnableGps = vi.fn();

    const { rerender } = await renderVisiblePrompt(true, onEnableGps);
    fireEvent.click(screen.getByRole('button', { name: 'Aktivera' }));
    expect(errorCb).not.toBeNull();

    rerender(<GpsPrompt active={false} onEnableGps={onEnableGps} />);
    act(() => { errorCb!({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); });

    expect(onEnableGps).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('Plats är blockerad');

    // Återaktivering: status kommer från färsk checkPermission ('prompt'),
    // inte från den stale error-callbacken ('denied' → hjälp-knapp).
    rerender(<GpsPrompt active={true} onEnableGps={onEnableGps} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(11_000); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.queryByTestId('gps-help')).toBeNull();
    expect(document.body.textContent).toContain('Aktivera plats');
    expect(document.body.textContent).not.toContain('Plats är blockerad');
  });
});
