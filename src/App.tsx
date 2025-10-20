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
import NotFound from "./pages/NotFound";
// import MyJobs from "./pages/MyJobs";
import { AuthProvider } from "@/hooks/useAuth";
import { UnsavedChangesProvider } from "@/hooks/useUnsavedChanges";
import { Header } from "@/components/Header";
import AuthTokenBridge from "./components/AuthTokenBridge";
import { useDevice } from "@/hooks/use-device";
import { AnimatedBackground } from "@/components/AnimatedBackground";

const queryClient = new QueryClient();

// Background that adapts to route and device; must live inside Router  
const RouterAwareBackground = () => {
  const location = useLocation();
  const device = useDevice();
  const isAuthRoute = location.pathname.startsWith('/auth');
  const isDesktop = device === 'desktop';
  return isAuthRoute && isDesktop ? (
    <AnimatedBackground disableDesktopShift />
  ) : (
    <AnimatedBackground />
  );
};

const App = () => {
  const showHeader = false; // Header removed for cleaner UI

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
      <BrowserRouter>
        <UnsavedChangesProvider>
          <div className="min-h-screen safe-area-content overflow-x-hidden w-full max-w-full">
            {/* Global background to avoid flicker between route transitions */}
            <RouterAwareBackground />
            
            <div className="relative z-10">
              {showHeader && <Header />}
              <main className={showHeader ? "pt-16" : ""}>
                <AuthTokenBridge />
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/home" element={<Index />} />
                  <Route path="/consent" element={<Index />} />
                  <Route path="/verify" element={<EmailVerification />} />
                  <Route path="/email-redirect" element={<EmailRedirect />} />
                  <Route path="/confirm" element={<EmailConfirm />} />
                  <Route path="/profile" element={<Index />} />
                  <Route path="/profile-preview" element={<ProfilePreview />} />
                  <Route path="/search-jobs" element={<Index />} />
                  <Route path="/subscription" element={<Index />} />
                  <Route path="/support" element={<Index />} />
                  <Route path="/admin" element={<Index />} />
                  <Route path="/settings" element={<Index />} />
                  <Route path="/billing" element={<Index />} />
                  <Route path="/payment" element={<Index />} />
                  <Route path="/dashboard" element={<Index />} />
                  <Route path="/my-jobs" element={<Index />} />
                  <Route path="/job-details/:jobId" element={<Index />} />
                  <Route path="/company-profile" element={<Index />} />
                  <Route path="/reviews" element={<Index />} />
                  <Route path="/job-application/:jobId" element={<JobApplication />} />
                  <Route path="/reset-redirect" element={<ResetRedirect />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
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
