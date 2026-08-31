import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  installServiceWorkerBuildHandshake,
  installLimitedHomeServiceWorkerRetry,
  registerServiceWorkerForHome,
  activateWaitingServiceWorker,
  clearImageCache,
  registerServiceWorker,
} from '@/lib/serviceWorkerManager';

const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
const originalCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches');

const replyToWorkerProtocol = (
  message: unknown,
  transfer: Transferable[] | undefined,
  accepted = true,
): boolean => {
  const port = transfer?.[0] as MessagePort | undefined;
  const type = (message as { type?: string } | null)?.type;
  if (type === 'PARIUM_SW_ACTIVATION_PROBE') {
    port?.postMessage({
      type: 'PARIUM_SW_ACTIVATION_READY',
      protocol: 'parium-safe-shell-v1',
    });
    return false;
  }
  if (type !== 'SKIP_WAITING') return false;
  port?.postMessage({
    type: 'PARIUM_SW_ACTIVATION_RESULT',
    protocol: 'parium-safe-shell-v1',
    accepted,
  });
  return accepted;
};

const flushMessageChannelTask = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      channel.port2.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
};

const restoreProperty = (
  target: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
) => {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
  } else {
    Reflect.deleteProperty(target, key);
  }
};

describe('serviceWorkerManager offline-shell contract', () => {
  afterEach(() => {
    restoreProperty(navigator, 'serviceWorker', originalServiceWorker);
    restoreProperty(globalThis, 'caches', originalCaches);
    vi.restoreAllMocks();
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it('registers /sw.js at root scope without using a cached worker script', async () => {
    const registration = { scope: 'https://www.parium.se/' } as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    });

    const result = await registerServiceWorker();

    expect(register).toHaveBeenCalledOnce();
    expect(register).toHaveBeenCalledWith('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    expect(result).toBe(registration);
  });

  it('clearImageCache never deletes the protected parium-shell cache', async () => {
    const deleteCache = vi.fn().mockResolvedValue(true);
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: {
        keys: vi.fn().mockResolvedValue([
          'parium-shell-build-123',
          'parium-image-cache',
          'unrelated-cache',
        ]),
        delete: deleteCache,
      },
    });

    await clearImageCache();

    expect(deleteCache).toHaveBeenCalledWith('parium-image-cache');
    expect(deleteCache).not.toHaveBeenCalledWith('parium-shell-build-123');
    expect(deleteCache).not.toHaveBeenCalledWith('unrelated-cache');
  });

  it('waits for an installing update before activating it for a controlled reload', async () => {
    let stateListener: (() => void) | undefined;
    let controllerListener: (() => void) | undefined;
    let waitingWorker: ServiceWorker | null = null;
    const worker = {
      state: 'installing',
      addEventListener: vi.fn((_type: string, listener: () => void) => {
        stateListener = listener;
      }),
      removeEventListener: vi.fn(),
      postMessage: vi.fn((message: unknown, transfer?: Transferable[]) => {
        if (replyToWorkerProtocol(message, transfer)) controllerListener?.();
      }),
    } as unknown as ServiceWorker;
    const registration = {
      get waiting() {
        return waitingWorker;
      },
      get installing() {
        return worker;
      },
      update: vi.fn().mockImplementation(async () => {
        setTimeout(() => {
          Object.defineProperty(worker, 'state', { configurable: true, value: 'installed' });
          waitingWorker = worker;
          stateListener?.();
        }, 0);
      }),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue(registration),
        addEventListener: vi.fn((_type: string, listener: () => void) => {
          controllerListener = listener;
        }),
      },
    });

    await activateWaitingServiceWorker();

    expect(registration.update).toHaveBeenCalledOnce();
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
      protocol: 'parium-safe-shell-v1',
    }, expect.any(Array));
  });

  it('activates a waiting legacy worker once on controlled Home and suppresses a reload loop', async () => {
    let controllerListener: (() => void) | undefined;
    const worker = {
      state: 'installed',
      postMessage: vi.fn((message: unknown, transfer?: Transferable[]) => {
        if (replyToWorkerProtocol(message, transfer)) controllerListener?.();
      }),
    } as unknown as ServiceWorker;
    const registration = {
      waiting: worker,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: { scriptURL: 'https://www.parium.se/legacy-sw.js' },
        register,
        addEventListener: vi.fn((_type: string, listener: () => void) => {
          controllerListener = listener;
        }),
      },
    });

    await expect(registerServiceWorkerForHome()).resolves.toBe(true);
    await expect(registerServiceWorkerForHome()).resolves.toBe(false);

    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
      protocol: 'parium-safe-shell-v1',
    }, expect.any(Array));
  });

  it('never forces activation or reload during a first service-worker install', async () => {
    const worker = {
      state: 'installed',
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    const registration = {
      waiting: worker,
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: null,
        register: vi.fn().mockResolvedValue(registration),
        addEventListener: vi.fn(),
      },
    });

    await expect(registerServiceWorkerForHome()).resolves.toBe(false);
    expect(worker.postMessage).not.toHaveBeenCalled();
  });

  it('does not activate or reload when the waiting worker rejects the client preflight', async () => {
    let controllerListener: (() => void) | undefined;
    const worker = {
      state: 'installed',
      postMessage: vi.fn((message: unknown, transfer?: Transferable[]) => {
        const port = transfer?.[0] as MessagePort | undefined;
        if (!port) {
          controllerListener?.();
          return;
        }
        replyToWorkerProtocol(message, transfer, false);
      }),
    } as unknown as ServiceWorker;
    const registration = {
      waiting: worker,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: { scriptURL: 'https://www.parium.se/legacy-sw.js' },
        register: vi.fn().mockResolvedValue(registration),
        addEventListener: vi.fn((_type: string, listener: () => void) => {
          controllerListener = listener;
        }),
        removeEventListener: vi.fn(),
      },
    });

    await expect(registerServiceWorkerForHome()).resolves.toBe(false);
    expect(controllerListener).toBeDefined();
  });

  it('settles safely without sending SKIP_WAITING to a legacy worker that cannot probe', async () => {
    vi.useFakeTimers();
    const worker = {
      state: 'installed',
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    const registration = {
      waiting: worker,
      installing: null,
      update: vi.fn().mockRejectedValue(new Error('offline')),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: { scriptURL: 'https://www.parium.se/legacy-sw.js' },
        register: vi.fn().mockResolvedValue(registration),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    const activation = registerServiceWorkerForHome();
    let settled = false;
    void activation.finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(10_500);

    expect(settled).toBe(true);
    await expect(activation).resolves.toBe(false);
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'PARIUM_SW_ACTIVATION_PROBE',
      protocol: 'parium-safe-shell-v1',
    }, expect.any(Array));
  });

  it('keeps listening past the former five-second timeout and activates after a slow install', async () => {
    vi.useFakeTimers();
    let stateListener: (() => void) | undefined;
    let controllerListener: (() => void) | undefined;
    let waitingWorker: ServiceWorker | null = null;
    const worker = {
      state: 'installing',
      addEventListener: vi.fn((_type: string, listener: () => void) => {
        stateListener = listener;
      }),
      removeEventListener: vi.fn(),
      postMessage: vi.fn((message: unknown, transfer?: Transferable[]) => {
        if (replyToWorkerProtocol(message, transfer)) controllerListener?.();
      }),
    } as unknown as ServiceWorker;
    const registration = {
      get waiting() {
        return waitingWorker;
      },
      get installing() {
        return worker;
      },
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: { scriptURL: 'https://www.parium.se/legacy-sw.js' },
        register: vi.fn().mockResolvedValue(registration),
        addEventListener: vi.fn((_type: string, listener: () => void) => {
          controllerListener = listener;
        }),
      },
    });

    const activation = registerServiceWorkerForHome();
    await vi.advanceTimersByTimeAsync(10_000);
    let settled = false;
    void activation.finally(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    Object.defineProperty(worker, 'state', { configurable: true, value: 'installed' });
    waitingWorker = worker;
    stateListener?.();
    await expect(activation).resolves.toBe(true);
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
      protocol: 'parium-safe-shell-v1',
    }, expect.any(Array));
  });

  it('settles within the total deadline when activation is accepted but never completes', async () => {
    vi.useFakeTimers();
    const postMessage = vi.fn((message: unknown, transfer?: Transferable[]) => {
      replyToWorkerProtocol(message, transfer);
    });
    const worker = {
      state: 'installed',
      postMessage,
    } as unknown as ServiceWorker;
    const registration = {
      waiting: worker,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: { scriptURL: 'https://www.parium.se/legacy-sw.js' },
        register: vi.fn().mockResolvedValue(registration),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    const activation = registerServiceWorkerForHome();
    for (let attempt = 0; attempt < 10 && postMessage.mock.calls.length === 0; attempt += 1) {
      await Promise.resolve();
    }
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'PARIUM_SW_ACTIVATION_PROBE',
      protocol: 'parium-safe-shell-v1',
    }, expect.any(Array));
    await flushMessageChannelTask();
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
      protocol: 'parium-safe-shell-v1',
    }, expect.any(Array));

    let settled = false;
    void activation.finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(15_000);

    expect(settled).toBe(true);
    await expect(activation).resolves.toBe(false);
    expect(sessionStorage.getItem('parium_home_sw_update_reload_at')).toBeNull();
  });

  it('times out a silent SKIP_WAITING acknowledgement and frees in-flight retry state', async () => {
    vi.useFakeTimers();
    const postMessage = vi.fn((message: unknown, transfer?: Transferable[]) => {
      const type = (message as { type?: string } | null)?.type;
      if (type === 'PARIUM_SW_ACTIVATION_PROBE') {
        replyToWorkerProtocol(message, transfer);
      }
      // Deliberately never acknowledge SKIP_WAITING.
    });
    const worker = {
      state: 'installed',
      postMessage,
    } as unknown as ServiceWorker;
    const registration = {
      waiting: worker,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: { scriptURL: 'https://www.parium.se/legacy-sw.js' },
        register: vi.fn().mockResolvedValue(registration),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    let inFlight = false;
    const registerShell = (): boolean => {
      if (inFlight) return false;
      inFlight = true;
      void registerServiceWorkerForHome().finally(() => {
        inFlight = false;
      });
      return true;
    };

    expect(registerShell()).toBe(true);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(inFlight).toBe(false);
    expect(sessionStorage.getItem('parium_home_sw_update_reload_at')).toBeNull();

    const callsAfterFirstAttempt = postMessage.mock.calls.length;
    const disposeRetry = installLimitedHomeServiceWorkerRetry(registerShell);
    await vi.advanceTimersByTimeAsync(60_000);
    window.dispatchEvent(new Event('focus'));
    expect(inFlight).toBe(true);
    for (let attempt = 0; attempt < 10 && postMessage.mock.calls.length === callsAfterFirstAttempt; attempt += 1) {
      await Promise.resolve();
    }
    expect(postMessage.mock.calls.length).toBeGreaterThan(callsAfterFirstAttempt);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(inFlight).toBe(false);

    disposeRetry();
  });

  it('accepts a delayed side-effect-free probe response before activation commit', async () => {
    vi.useFakeTimers();
    let controllerListener: (() => void) | undefined;
    const worker = {
      state: 'installed',
      postMessage: vi.fn((message: unknown, transfer?: Transferable[]) => {
        const port = transfer?.[0] as MessagePort | undefined;
        const type = (message as { type?: string } | null)?.type;
        if (type === 'PARIUM_SW_ACTIVATION_PROBE') {
          setTimeout(() => {
            port?.postMessage({
              type: 'PARIUM_SW_ACTIVATION_READY',
              protocol: 'parium-safe-shell-v1',
            });
          }, 8_000);
          return;
        }
        if (replyToWorkerProtocol(message, transfer)) controllerListener?.();
      }),
    } as unknown as ServiceWorker;
    const registration = {
      waiting: worker,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: { scriptURL: 'https://www.parium.se/legacy-sw.js' },
        register: vi.fn().mockResolvedValue(registration),
        addEventListener: vi.fn((_type: string, listener: () => void) => {
          controllerListener = listener;
        }),
        removeEventListener: vi.fn(),
      },
    });

    const activation = registerServiceWorkerForHome();
    await vi.advanceTimersByTimeAsync(8_500);
    await expect(activation).resolves.toBe(true);
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
      protocol: 'parium-safe-shell-v1',
    }, expect.any(Array));
  });

  it('settles when another tab wins the activation race before controllerchange is observed', async () => {
    let stateListener: (() => void) | undefined;
    const worker = {
      state: 'installed',
      addEventListener: vi.fn((_type: string, listener: () => void) => {
        stateListener = listener;
      }),
      removeEventListener: vi.fn(),
      postMessage: vi.fn((message: unknown, transfer?: Transferable[]) => {
        replyToWorkerProtocol(message, transfer);
      }),
    } as unknown as ServiceWorker;
    const registration = {
      waiting: worker,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: { scriptURL: 'https://www.parium.se/legacy-sw.js' },
        register: vi.fn().mockResolvedValue(registration),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    const activation = registerServiceWorkerForHome();
    await Promise.resolve();
    await Promise.resolve();
    Object.defineProperty(worker, 'state', { configurable: true, value: 'activated' });
    stateListener?.();

    await expect(activation).resolves.toBe(true);
  });

  it('installs one build-handshake responder for the service-worker legacy migration', () => {
    let messageListener: ((event: MessageEvent) => void) | undefined;
    const addEventListener = vi.fn((_type: string, listener: (event: MessageEvent) => void) => {
      messageListener = listener;
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { addEventListener },
    });
    const reply = vi.fn();

    installServiceWorkerBuildHandshake();
    installServiceWorkerBuildHandshake();
    messageListener?.({
      data: {
        type: 'PARIUM_SW_BUILD_HANDSHAKE',
        protocol: 'parium-safe-shell-v1',
      },
      ports: [{ postMessage: reply }],
    } as unknown as MessageEvent);

    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledWith({
      type: 'PARIUM_SW_BUILD_ACK',
      protocol: 'parium-safe-shell-v1',
    });
  });

  it('retries a deferred Home shell registration only on spaced focus/online events', () => {
    vi.useFakeTimers();
    const retry = vi.fn().mockReturnValue(true);
    const dispose = installLimitedHomeServiceWorkerRetry(retry);

    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    expect(retry).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);
    window.dispatchEvent(new Event('focus'));
    expect(retry).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    window.dispatchEvent(new Event('online'));
    expect(retry).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(60_000);
    window.dispatchEvent(new Event('focus'));
    expect(retry).toHaveBeenCalledTimes(2);

    dispose();
  });

  it('uses a visible-page transition as a bounded retry signal', () => {
    vi.useFakeTimers();
    const retry = vi.fn().mockReturnValue(true);
    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    const dispose = installLimitedHomeServiceWorkerRetry(retry);

    vi.advanceTimersByTime(60_000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(retry).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(retry).toHaveBeenCalledTimes(1);

    dispose();
    restoreProperty(document, 'visibilityState', originalVisibilityState);
  });

  it('does not consume retry budget while a Home registration is already in flight', () => {
    vi.useFakeTimers();
    const retry = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    const dispose = installLimitedHomeServiceWorkerRetry(retry);

    vi.advanceTimersByTime(60_000);
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(60_000);
    window.dispatchEvent(new Event('online'));
    vi.advanceTimersByTime(60_000);
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(60_000);
    window.dispatchEvent(new Event('online'));

    expect(retry).toHaveBeenCalledTimes(4);
    dispose();
  });
});
