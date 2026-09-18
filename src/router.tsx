import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { isSlowConnection } from "@/hooks/useNetworkAwareFetch";
import { initConnectivityManager } from "@/lib/connectivityManager";

export const getRouter = () => {
  // Ported from the original App.tsx — permanent cache + realtime-driven updates.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: "always",
        retry: 3,
        retryDelay: (attemptIndex) => {
          const base = Math.min(1000 * 2 ** attemptIndex, 15000);
          return isSlowConnection() ? base * 2 : base;
        },
      },
      mutations: {
        retry: 2,
        retryDelay: (attemptIndex) => {
          const base = Math.min(1000 * 2 ** attemptIndex, 10000);
          return isSlowConnection() ? base * 2 : base;
        },
      },
    },
  });

  // Ping-based connectivity detection wired into React Query's onlineManager.
  if (typeof window !== "undefined") {
    initConnectivityManager(queryClient);
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // The app ships its own ScrollRestoration component — keep the built-in off.
    scrollRestoration: false,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
