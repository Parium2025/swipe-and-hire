/// <reference lib="webworker" />

import { cacheNames as workboxCacheNames, setCacheNameDetails } from 'workbox-core';
import { PrecacheController } from 'workbox-precaching';
import {
  classifyServiceWorkerRequest,
  createShellBuildSuffix,
  isLegacyPrivateCacheName,
  isRetainedShellCacheName,
  selectExpiredShellCacheNames,
  SERVICE_WORKER_ACTIVATION_PROBE,
  SERVICE_WORKER_ACTIVATION_READY,
  SERVICE_WORKER_ACTIVATION_RESULT,
  SERVICE_WORKER_BUILD_ACK,
  SERVICE_WORKER_BUILD_HANDSHAKE,
  SERVICE_WORKER_BUILD_PROTOCOL,
  shouldActivateShellWorker,
  shouldUseOfflineNavigationFallback,
} from './lib/serviceWorkerPolicy';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision?: string | null }>;
};

const manifest = self.__WB_MANIFEST;

setCacheNameDetails({
  prefix: 'parium',
  precache: 'shell',
  suffix: createShellBuildSuffix(manifest),
});

const shellUrls = manifest.map((entry) =>
  typeof entry === 'string' ? entry : entry.url,
);
const NAVIGATION_TIMEOUT_MS = 8_000;
const LEGACY_CLIENT_HANDSHAKE_TIMEOUT_MS = 1_500;

const precacheController = new PrecacheController();
precacheController.addToCacheList(manifest);

const matchRetainedShellAsset = async (
  request: Request,
): Promise<Response | undefined> => {
  const cacheNames = (await caches.keys()).filter(isRetainedShellCacheName);
  for (const cacheName of cacheNames) {
    const response = await (await caches.open(cacheName)).match(request);
    if (response) return response;
  }
  return undefined;
};

const acknowledgesSafeBuild = async (client: WindowClient): Promise<boolean> =>
  await new Promise<boolean>((resolve) => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = (acknowledged: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      channel.port1.close();
      resolve(acknowledged);
    };
    const timeoutId = setTimeout(
      () => finish(false),
      LEGACY_CLIENT_HANDSHAKE_TIMEOUT_MS,
    );
    channel.port1.onmessage = (event: MessageEvent) => {
      finish(
        event.data?.type === SERVICE_WORKER_BUILD_ACK
        && event.data?.protocol === SERVICE_WORKER_BUILD_PROTOCOL,
      );
    };
    channel.port1.onmessageerror = () => finish(false);

    try {
      client.postMessage({
        type: SERVICE_WORKER_BUILD_HANDSHAKE,
        protocol: SERVICE_WORKER_BUILD_PROTOCOL,
      }, [channel.port2]);
    } catch {
      finish(false);
    }
  });

const allOpenWindowClientsAcknowledgeSafeBuild = async (): Promise<boolean> => {
  const windowClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  const acknowledgements = await Promise.all(windowClients.map(async (client) => {
    let clientUrl: URL;
    try {
      clientUrl = new URL(client.url);
    } catch {
      return true;
    }
    if (clientUrl.origin !== self.location.origin) return true;
    return await acknowledgesSafeBuild(client);
  }));

  return shouldActivateShellWorker(acknowledgements);
};

self.addEventListener('install', (event: ExtendableEvent) => {
  // Keep the install event alive while every open tab proves it runs the safe
  // build. Workbox must not create the new shell cache before this gate passes.
  event.waitUntil((async () => {
    if (!await allOpenWindowClientsAcknowledgeSafeBuild()) {
      throw new Error('unsafe-open-client');
    }
    await precacheController.install(event);
  })());
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil((async () => {
    await precacheController.activate(event);
    // The pre-skip gate owns promotion safety. This final check only guards
    // cleanup: if tab state changed meanwhile, leave all incumbent caches intact.
    if (!await allOpenWindowClientsAcknowledgeSafeBuild()) return;

    const cacheNames = await caches.keys();
    const expiredShellCaches = selectExpiredShellCacheNames(
      cacheNames,
      workboxCacheNames.precache,
    );
    await Promise.allSettled(
      [
        ...cacheNames.filter(isLegacyPrivateCacheName),
        ...expiredShellCaches,
      ]
        .map((cacheName) => caches.delete(cacheName)),
    );

    // Deliberately do not claim already-open pages. The requesting safe Home
    // reloads after activation; other tabs move over on their next navigation.
  })());
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const request = event.request;
  const policy = classifyServiceWorkerRequest({
    request: {
      url: request.url,
      method: request.method,
      mode: request.mode,
    },
    appOrigin: self.location.origin,
    shellUrls,
  });

  if (policy === 'navigation-network-first') {
    event.respondWith((async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS);
      try {
        const response = await fetch(new Request(request, {
          cache: 'no-store',
          signal: controller.signal,
        }));
        if (shouldUseOfflineNavigationFallback(response.status)) {
          return (await precacheController.matchPrecache('/index.html')) ?? response;
        }
        return response;
      } catch {
        return (await precacheController.matchPrecache('/index.html')) ?? Response.error();
      } finally {
        clearTimeout(timeoutId);
      }
    })());
    return;
  }

  if (policy === 'shell-cache-first') {
    event.respondWith((async () => {
      const cached = await precacheController.matchPrecache(request.url);
      return cached ?? fetch(request);
    })());
    return;
  }

  if (policy === 'retained-shell-network-fallback') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) return response;
        return (await matchRetainedShellAsset(request)) ?? response;
      } catch {
        return (await matchRetainedShellAsset(request)) ?? Response.error();
      }
    })());
  }
  // network-only deliberately has no respondWith and no runtime cache write.
});

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === SERVICE_WORKER_ACTIVATION_PROBE) {
    event.ports?.[0]?.postMessage({
      type: SERVICE_WORKER_ACTIVATION_READY,
      protocol: SERVICE_WORKER_BUILD_PROTOCOL,
    });
    event.ports?.[0]?.close();
    return;
  }

  if (event.data?.type === 'SKIP_WAITING') {
    const responsePort = event.ports?.[0];
    event.waitUntil((async () => {
      const accepted = Boolean(responsePort)
        && await allOpenWindowClientsAcknowledgeSafeBuild();
      if (accepted) await self.skipWaiting();
      responsePort?.postMessage({
        type: SERVICE_WORKER_ACTIVATION_RESULT,
        protocol: SERVICE_WORKER_BUILD_PROTOCOL,
        accepted,
      });
      responsePort?.close();
    })());
  }
});

export {};
