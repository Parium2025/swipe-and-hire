import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Consent from "./pages/Consent";
import EmailConfirm from "./pages/EmailConfirm";
import EmailRedirect from "./pages/EmailRedirect";
import ResetRedirect from "./pages/ResetRedirect";
import EmailVerification from "./pages/EmailVerification";
import ProfilePreview from "./pages/ProfilePreview";
import JobApplication from "./pages/JobApplication";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "@/hooks/useAuth";
import { UnsavedChangesProvider } from "@/hooks/useUnsavedChanges";
import { Header } from "@/components/Header";
import AuthTokenBridge from "./components/AuthTokenBridge";

const queryClient = new QueryClient();

const BubblesLayer: React.FC = () => {
  const [start, setStart] = React.useState(false);

  React.useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        setStart(true);
      });
    });

    const onPageShow = () => {
      setStart(false);
      requestAnimationFrame(() => setStart(true));
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setStart(false);
        requestAnimationFrame(() => setStart(true));
      }
    };

    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf1);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {/* Animated floating elements */}
      <div data-animated-bubble className={`fixed top-20 left-10 w-4 h-4 bg-secondary/30 rounded-full transform-gpu will-change-transform ${start ? 'animate-bounce' : 'animate-none'} pointer-events-none z-[1]`} style={{ animationDuration: '2s' }} />
      <div data-animated-bubble className={`fixed top-32 left-16 w-2 h-2 bg-accent/40 rounded-full transform-gpu will-change-transform ${start ? 'animate-bounce' : 'animate-none'} pointer-events-none z-[1]`} style={{ animationDuration: '2.5s' }} />
      <div data-animated-bubble className={`fixed top-24 left-20 w-3 h-3 bg-secondary/20 rounded-full transform-gpu will-change-transform ${start ? 'animate-bounce' : 'animate-none'} pointer-events-none z-[1]`} style={{ animationDuration: '3s' }} />

      {/* Decorative glow effect in bottom right corner */}
      <div className="fixed -bottom-32 -right-32 w-96 h-96 pointer-events-none z-[1] hidden md:block">
        <div className="absolute inset-0 bg-primary-glow/40 rounded-full blur-[120px]" />
        <div className="absolute inset-4 bg-primary-glow/30 rounded-full blur-[100px]" />
        <div className="absolute inset-8 bg-primary-glow/25 rounded-full blur-[80px]" />
      </div>

      <div data-animated-bubble className={`fixed bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full ${start ? 'animate-bounce' : 'animate-none'} pointer-events-none z-[1]`} style={{ animationDuration: '2.2s' }} />
      <div data-animated-bubble className={`fixed bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full ${start ? 'animate-bounce' : 'animate-none'} pointer-events-none z-[1]`} style={{ animationDuration: '2.8s' }} />
      <div data-animated-bubble className={`fixed bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full ${start ? 'animate-bounce' : 'animate-none'} pointer-events-none z-[1]`} style={{ animationDuration: '2.3s' }} />

      {/* Pulsing lights */}
      <div className="fixed top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse pointer-events-none z-[1]" style={{ animationDuration: '1.5s' }} />
      <div className="fixed top-16 right-20 w-2 h-2 bg-accent/30 rounded-full animate-pulse pointer-events-none z-[1]" style={{ animationDuration: '2s' }} />
      <div className="fixed top-12 left-8 w-3 h-3 bg-accent/40 rounded-full animate-pulse pointer-events-none z-[1]" style={{ animationDuration: '1.8s' }} />

      {/* Small stars */}
      <div className="fixed top-1/4 left-1/3 w-1 h-1 bg-accent/60 rounded-full animate-pulse pointer-events-none z-[1]" style={{ animationDuration: '3s' }}>
        <div className="absolute inset-0 bg-accent/40 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
      </div>
      <div className="fixed top-1/3 right-1/3 w-1 h-1 bg-secondary/60 rounded-full animate-pulse pointer-events-none z-[1]" style={{ animationDuration: '2.5s' }}>
        <div className="absolute inset-0 bg-secondary/40 rounded-full animate-ping" style={{ animationDuration: '2.5s' }} />
      </div>
    </div>
  );
};

const RoutedContent: React.FC = () => {
  const showHeader = false;

  return (
    <UnsavedChangesProvider>
      <div className="min-h-screen safe-area-content overflow-x-hidden w-full max-w-full">
        {/* Static animated background - identical to WelcomeTunnel */}
        <BubblesLayer />
        
        <div className="relative z-10">
          {showHeader && <Header />}
          <main className={showHeader ? "pt-16" : ""}>
            <AuthTokenBridge />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
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
              <Route path="/job-application/:jobId" element={<JobApplication />} />
              <Route path="/company-profile" element={<Index />} />
              <Route path="/reset-redirect" element={<ResetRedirect />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
    </UnsavedChangesProvider>
  );
};

const App = () => {
  const showHeader = false; // Header removed for cleaner UI

  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <RoutedContent />
      </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
