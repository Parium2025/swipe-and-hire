import { useState, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// 🚀 CRITICAL: Lazy load heavy pages for instant /auth load on mobile
// Only Auth, Landing, and lightweight pages are loaded synchronously
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import EmailConfirm from "./pages/EmailConfirm";
import EmailRedirect from "./pages/EmailRedirect";
import ResetRedirect from "./pages/ResetRedirect";
import EmailVerification from "./pages/EmailVerification";
import NotFound from "./pages/NotFound";

// Heavy pages - lazy loaded to reduce initial bundle by ~60%
const Index = lazy(() => import("./pages/Index"));
const JobApplication = lazy(() => import("./pages/JobApplication"));
const JobView = lazy(() => import("./pages/JobView"));
const CvTunnel = lazy(() => import("./pages/CvTunnel"));
const MediaMigration = lazy(() => import("./pages/MediaMigration"));

import { AuthProvider } from "@/hooks/useAuth";
import { UnsavedChangesProvider } from "@/hooks/useUnsavedChanges";
import { Header } from "@/components/Header";
import AuthTokenBridge from "./components/AuthTokenBridge";
import { useGlobalImagePreloader } from "@/hooks/useGlobalImagePreloader";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { OnlineStatusProvider } from "@/components/OnlineStatusProvider";
import { SystemHealthPanel } from "@/components/SystemHealthPanel";
import { PushNotificationProvider } from "@/components/PushNotificationProvider";
import { cleanupOldDrafts } from "@/lib/draftUtils";
import { ScrollRestoration } from "@/components/ScrollRestoration";
import { CriticalAssetPreloads } from "@/components/CriticalAssetPreloads";
import { AuthSplashScreen } from "@/components/AuthSplashScreen";

// Run draft cleanup once on app load (removes drafts older than 1 day)
// Defer to idle time to avoid blocking first paint
if (typeof window !== 'undefined') {
  const runCleanup = () => cleanupOldDrafts(24 * 60 * 60 * 1000);
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(runCleanup, { timeout: 3000 });
  } else {
    setTimeout(runCleanup, 1000);
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Längre cache-tider för bättre bildprestanda
      staleTime: 30 * 60 * 1000, // 30 minuter - data anses färsk
      gcTime: 60 * 60 * 1000, // 1 timme - behåll i minnet
      refetchOnWindowFocus: false, // Ladda inte om när man kommer tillbaka
      refetchOnMount: false, // Använd cache när möjligt
      retry: 2, // Försök 2 gånger vid fel
    },
  },
});

// Minimal loading fallback - just gradient background, no spinner
const LazyFallback = () => (
  <div className="min-h-screen bg-parium-gradient" />
);

// Routes without animations for instant navigation
const AnimatedRoutes = () => {
  return (
    <>
      <ScrollRestoration />
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/home" element={<Index />} />
          <Route path="/consent" element={<Index />} />
          <Route path="/verify" element={<EmailVerification />} />
          <Route path="/email-redirect" element={<EmailRedirect />} />
          <Route path="/confirm" element={<EmailConfirm />} />
          <Route path="/email-confirm" element={<EmailConfirm />} />
          <Route path="/profile" element={<Index />} />
          <Route path="/profile-preview" element={<Index />} />
          <Route path="/search-jobs" element={<Index />} />
          <Route path="/saved-jobs" element={<Index />} />
          <Route path="/my-applications" element={<Index />} />
          <Route path="/subscription" element={<Index />} />
          <Route path="/support" element={<Index />} />
          <Route path="/admin" element={<Index />} />
          <Route path="/settings" element={<Index />} />
          <Route path="/billing" element={<Index />} />
          <Route path="/payment" element={<Index />} />
          <Route path="/dashboard" element={<Index />} />
          <Route path="/my-jobs" element={<Index />} />
          <Route path="/candidates" element={<Index />} />
          <Route path="/messages" element={<Index />} />
          <Route path="/my-candidates" element={<Index />} />
          <Route path="/job-details/:jobId" element={<Index />} />
          <Route path="/job-view/:jobId" element={<JobView />} />
          <Route path="/company-profile" element={<Index />} />
          <Route path="/reviews" element={<Index />} />
          <Route path="/job-application/:jobId" element={<JobApplication />} />
          <Route path="/reset-redirect" element={<ResetRedirect />} />
          <Route path="/migrate-media" element={<MediaMigration />} />
          <Route path="/cv-tunnel" element={<CvTunnel />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

const App = () => {
  const showHeader = false; // Header removed for cleaner UI

  // Förladdda alla kritiska bilder globalt vid app-start.
  // Viktigt: på /auth vill vi INTE starta tunga preloads som kan konkurrera med loggans first paint.
  const preloadEnabled = typeof window !== 'undefined' ? window.location.pathname !== '/auth' : true;
  useGlobalImagePreloader(preloadEnabled);

  const [animReady, setAnimReady] = useState(false);
  useEffect(() => {
    const start = () => requestAnimationFrame(() => requestAnimationFrame(() => setAnimReady(true)));
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true } as any);
    return () => window.removeEventListener('load', start as any);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OnlineStatusProvider>
          <TooltipProvider delayDuration={0}>
            <Toaster position="top-center" />
            <OfflineIndicator />
            <SystemHealthPanel />
            <BrowserRouter>
              <UnsavedChangesProvider>
                <PushNotificationProvider />
                {/* Auth splash screen - visas vid navigering till /auth */}
                <AuthSplashScreen />
                <div className="min-h-screen safe-area-content overflow-x-hidden w-full max-w-full">
                  <CriticalAssetPreloads />
                  <div className="relative z-10">
                    {showHeader && <Header />}
                    <main className={showHeader ? "pt-16" : ""}>
                      <AuthTokenBridge />
                      <AnimatedRoutes />
                    </main>
                  </div>
                </div>
              </UnsavedChangesProvider>
            </BrowserRouter>
          </TooltipProvider>
        </OnlineStatusProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
