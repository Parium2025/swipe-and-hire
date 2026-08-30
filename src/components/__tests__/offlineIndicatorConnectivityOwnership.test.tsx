/**
 * RED: OfflineIndicator får inte äga nätverkskontroller.
 *
 * Bevisat fel: komponenten anropar forceConnectivityCheck direkt och varje
 * sekund offline (setInterval 1000 ms) — en andra scheduler som kringgår
 * connectivityManagers single-flight/backoff. connectivityManager ska ensam
 * äga nätverkskontrollerna; OfflineIndicator ska bara vara en ren UI-timer.
 *
 * Denna svit bevisar:
 *  - noll direkta forceConnectivityCheck-anrop (omedelbart, 1 s, 10 s, 60 s),
 *  - inget setInterval(...,1000),
 *  - 900 ms fade-in / 300 ms fade-out och svenska texter bevarade,
 *  - "Återansluter..." exakt från 10 s, ny period vid flapping,
 *  - alla komponentägda timers rensade vid unmount.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import React from 'react';

let mockOnline = true;
let connectivityListeners: Array<(online: boolean) => void> = [];
const forceCheckSpy = vi.fn(async () => mockOnline);

vi.mock('@/lib/connectivityManager', () => ({
  getIsOnline: () => mockOnline,
  onConnectivityChange: (listener: (online: boolean) => void) => {
    connectivityListeners.push(listener);
    return () => {
      connectivityListeners = connectivityListeners.filter((l) => l !== listener);
    };
  },
  forceConnectivityCheck: () => forceCheckSpy(),
}));

let mockDraftTime: string | null = null;
vi.mock('@/lib/draftUtils', () => ({
  getLatestDraftTime: () => mockDraftTime,
}));

import { OfflineIndicator } from '../OfflineIndicator';

const emitConnectivity = (online: boolean) => {
  mockOnline = online;
  act(() => {
    connectivityListeners.forEach((l) => l(online));
  });
};

let intervalSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  // Spionera EFTER att fake timers ersatt globala setInterval, annars ser spionen inget.
  intervalSpy = vi.spyOn(globalThis, 'setInterval');
  mockOnline = true;
  mockDraftTime = null;
  connectivityListeners = [];
  forceCheckSpy.mockClear();
  intervalSpy.mockClear();
});

afterEach(() => {
  intervalSpy.mockRestore();
  cleanup();
  vi.useRealTimers();
});

describe('OfflineIndicator — connectivity ownership', () => {
  it('anropar aldrig forceConnectivityCheck direkt (0 s, 1 s, 10 s, 60 s offline)', () => {
    render(<OfflineIndicator />);
    emitConnectivity(false);
    expect(forceCheckSpy).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(forceCheckSpy).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(9000); });
    expect(forceCheckSpy).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(50000); });
    expect(forceCheckSpy).not.toHaveBeenCalled();
  });

  it('registrerar inget setInterval(...,1000)', () => {
    render(<OfflineIndicator />);
    emitConnectivity(false);
    act(() => { vi.advanceTimersByTime(5000); });
    const oneSecondIntervals = intervalSpy.mock.calls.filter(
      (args) => args[1] === 1000
    );
    expect(oneSecondIntervals).toHaveLength(0);
  });

  it('visar ingen banner före 900 ms men offline-banner från 900 ms', () => {
    const { queryByText, getByText } = render(<OfflineIndicator />);
    emitConnectivity(false);
    act(() => { vi.advanceTimersByTime(899); });
    expect(queryByText(/Offline/)).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(getByText(/Offline/)).toBeTruthy();
  });

  it('visar inte "Återansluter..." före 10 s, men exakt från 10 s med spinner', () => {
    const { queryByText, getByText, container } = render(<OfflineIndicator />);
    emitConnectivity(false);
    act(() => { vi.advanceTimersByTime(9999); });
    expect(queryByText(/Återansluter/)).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(getByText(/Återansluter/)).toBeTruthy();
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('visar draft-suffix i återanslutningsläget', () => {
    mockDraftTime = '14:32';
    const { getByText } = render(<OfflineIndicator />);
    emitConnectivity(false);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(getByText(/Återansluter\.\.\. – sparat 14:32/)).toBeTruthy();
  });

  it('online rensar 10 s-timern, behåller 300 ms fade-out och bannern återkommer inte', () => {
    const { queryByText, getByText } = render(<OfflineIndicator />);
    emitConnectivity(false);
    act(() => { vi.advanceTimersByTime(5000); });
    emitConnectivity(true);
    act(() => { vi.advanceTimersByTime(299); });
    // Fortfarande renderad under fade-out (300 ms)
    expect(getByText(/Offline/)).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1); });
    expect(queryByText(/Offline/)).toBeNull();
    // Gammal 10 s-timer får inte slå till senare
    act(() => { vi.advanceTimersByTime(30000); });
    expect(queryByText(/Återansluter/)).toBeNull();
    expect(queryByText(/Offline/)).toBeNull();
  });

  it('offline→online före 900 ms visar aldrig banner', () => {
    const { queryByText } = render(<OfflineIndicator />);
    emitConnectivity(false);
    act(() => { vi.advanceTimersByTime(500); });
    emitConnectivity(true);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(queryByText(/Offline/)).toBeNull();
  });

  it('flapping: första perioden når 10 s med reconnecting, kort onlinepaus resettar, ny period kräver helt nya 10 s', () => {
    const { queryByText, getByText } = render(<OfflineIndicator />);
    // Första offlineperioden når EXAKT 10 s → reconnecting-läget är aktivt
    emitConnectivity(false);
    act(() => { vi.advanceTimersByTime(9999); });
    expect(queryByText(/Återansluter/)).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(getByText(/Återansluter/)).toBeTruthy();
    // Online bara ~100 ms — kortare än 300 ms fade-out, bannern renderas fortfarande
    emitConnectivity(true);
    act(() => { vi.advanceTimersByTime(100); });
    // Offline igen: reconnecting måste vara resettat OMEDELBART i nya perioden
    emitConnectivity(false);
    expect(queryByText(/Återansluter/)).toBeNull();
    // ...och får inte återkomma förrän en HELT NY 10 s-period passerat
    act(() => { vi.advanceTimersByTime(9999); });
    expect(queryByText(/Återansluter/)).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(getByText(/Återansluter/)).toBeTruthy();
  });

  it('unmount rensar komponentägda 900 ms/10 s-timers (bevisat via timer-räknare)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(<OfflineIndicator />);
    emitConnectivity(false);
    // Före unmount: komponenten äger exakt två pending timers (900 ms fade-in + 10 s reconnecting)
    expect(vi.getTimerCount()).toBe(2);
    // Låt 900 ms-timern gå ut — då återstår bara 10 s-timern
    act(() => { vi.advanceTimersByTime(2000); });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    // Direkt efter unmount: alla komponentägda timers rensade
    expect(vi.getTimerCount()).toBe(0);
    // Efterföljande timeradvance får inte trigga state-uppdateringar/varningar
    act(() => { vi.advanceTimersByTime(60000); });
    expect(vi.getTimerCount()).toBe(0);
    const stateWarnings = errorSpy.mock.calls.filter((args) =>
      String(args[0]).includes('unmounted component') ||
      String(args[0]).includes('not wrapped in act')
    );
    expect(stateWarnings).toHaveLength(0);
    errorSpy.mockRestore();
  });
});
