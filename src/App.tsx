import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Consent from "./pages/Consent";
import EmailConfirm from "./pages/EmailConfirm";
import EmailRedirect from "./pages/EmailRedirect";
import ResetRedirect from "./pages/ResetRedirect";
import EmailVerification from "./pages/EmailVerification";
import ProfilePreview from "./pages/ProfilePreview";
import JobApplication from "./pages/JobApplication";
import JobDetails from "./pages/JobDetails";
import JobView from "./pages/JobView";
import NotFound from "./pages/NotFound";
// import MyJobs from "./pages/MyJobs";
import { AuthProvider } from "@/hooks/useAuth";
import { UnsavedChangesProvider } from "@/hooks/useUnsavedChanges";
import { Header } from "@/components/Header";
import AuthTokenBridge from "./components/AuthTokenBridge";
import { useDevice } from "@/hooks/use-device";
import { useGlobalImagePreloader } from "@/hooks/useGlobalImagePreloader";
import { OfflineIndicator } from "@/components/OfflineIndicator";

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

// Routes without animations for instant navigation
const AnimatedRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/home" element={<Index />} />
      <Route path="/consent" element={<Index />} />
      <Route path="/verify" element={<EmailVerification />} />
      <Route path="/email-redirect" element={<EmailRedirect />} />
      <Route path="/confirm" element={<EmailConfirm />} />
      <Route path="/profile" element={<Index />} />
      <Route path="/profile-preview" element={<Index />} />
      <Route path="/search-jobs" element={<Index />} />
      <Route path="/subscription" element={<Index />} />
      <Route path="/support" element={<Index />} />
      <Route path="/admin" element={<Index />} />
      <Route path="/settings" element={<Index />} />
      <Route path="/billing" element={<Index />} />
      <Route path="/payment" element={<Index />} />
      <Route path="/dashboard" element={<Index />} />
      <Route path="/my-jobs" element={<Index />} />
      <Route path="/candidates" element={<Index />} />
      <Route path="/job-details/:jobId" element={<Index />} />
      <Route path="/job-view/:jobId" element={<JobView />} />
      <Route path="/company-profile" element={<Index />} />
      <Route path="/reviews" element={<Index />} />
      <Route path="/job-application/:jobId" element={<JobApplication />} />
      <Route path="/reset-redirect" element={<ResetRedirect />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  const showHeader = false; // Header removed for cleaner UI

  // Förladdda alla kritiska bilder globalt vid app-start
  useGlobalImagePreloader();

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
      <TooltipProvider>
      <Toaster />
      <OfflineIndicator />
      <BrowserRouter>
        <UnsavedChangesProvider>
          <div className="min-h-screen safe-area-content overflow-x-hidden w-full max-w-full">
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
  </AuthProvider>
</QueryClientProvider>
  );
};

export default App;
