import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
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

const queryClient = new QueryClient();

// Wrapper component for animated routes
const AnimatedRoutes = () => {
  const location = useLocation();
  const device = useDevice();
  const isMobile = device === 'mobile';

  const PageWrapper = ({ children }: { children: React.ReactNode }) => {
    if (!isMobile) return <>{children}</>;
    
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    );
  };

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/home" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/consent" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/verify" element={<EmailVerification />} />
        <Route path="/email-redirect" element={<EmailRedirect />} />
        <Route path="/confirm" element={<EmailConfirm />} />
        <Route path="/profile" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/profile-preview" element={<ProfilePreview />} />
        <Route path="/search-jobs" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/subscription" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/support" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/admin" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/settings" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/billing" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/payment" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/dashboard" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/my-jobs" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/candidates" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/job-details/:jobId" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/company-profile" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/reviews" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/job-application/:jobId" element={<JobApplication />} />
        <Route path="/reset-redirect" element={<ResetRedirect />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
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
