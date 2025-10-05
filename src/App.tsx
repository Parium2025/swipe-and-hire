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
  const [ready, setReady] = React.useState(false);

  // Restart animation helper (Safari-friendly)
  const restart = React.useCallback(() => {
    const nodes = document.querySelectorAll('[data-animated-bubble]');
    nodes.forEach((n) => {
      const el = n as HTMLElement;
      // Temporarily disable animation, force reflow, then restore
      const prev = el.style.animation;
      el.style.animation = 'none';
      // Force reflow
      void el.offsetHeight;
      // Clear inline animation to allow the class (animate-bounce) to re-apply
      el.style.animation = prev || '';
      if (!prev) {
        // If there was no inline animation, removing the override is enough
        el.style.removeProperty('animation');
      }
    });
  }, []);

  React.useEffect(() => {
    // Wait for styles to be applied fully, then kick animations
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        // Tiny timeout is more reliable on iOS Safari than RAF-only
        setTimeout(() => {
          void document.body.offsetHeight;
          setReady(true);
          // Immediately restart to ensure first frame is correct
          restart();
        }, 0);
      });
    });
    return () => cancelAnimationFrame(raf1);
  }, [restart]);

  // Handle Safari-specific page lifecycle events
  React.useEffect(() => {
    const onPageShow = () => restart();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') restart();
    };
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('load', onPageShow, { once: true } as any);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [restart]);

  if (!ready) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {/* Animated floating elements */}
      <div data-animated-bubble className="fixed top-20 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2s' }}></div>
      <div data-animated-bubble className="fixed top-32 left-16 w-2 h-2 bg-accent/40 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.5s' }}></div>
      <div data-animated-bubble className="fixed top-24 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '3s' }}></div>

      {/* Decorative glow effect in bottom right corner */}
      <div className="fixed -bottom-32 -right-32 w-96 h-96 pointer-events-none z-[1] hidden md:block">
        <div className="absolute inset-0 bg-primary-glow/40 rounded-full blur-[120px]"></div>
        <div className="absolute inset-4 bg-primary-glow/30 rounded-full blur-[100px]"></div>
        <div className="absolute inset-8 bg-primary-glow/25 rounded-full blur-[80px]"></div>
      </div>

      <div data-animated-bubble className="fixed bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.2s' }}></div>
      <div data-animated-bubble className="fixed bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.8s' }}></div>
      <div data-animated-bubble className="fixed bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.3s' }}></div>

      {/* Pulsing lights */}
      <div className="fixed top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse pointer-events-none z-[1]" style={{ animationDuration: '1.5s' }}></div>
      <div className="fixed top-16 right-20 w-2 h-2 bg-accent/30 rounded-full animate-pulse pointer-events-none z-[1]" style={{ animationDuration: '2s' }}></div>
      <div className="fixed top-12 left-8 w-3 h-3 bg-accent/40 rounded-full animate-pulse pointer-events-none z-[1]" style={{ animationDuration: '1.8s' }}></div>

      {/* Small stars */}
      <div className="fixed top-1/4 left-1/3 w-1 h-1 bg-accent/60 rounded-full animate-pulse pointer-events-none z-[1]" style={{ animationDuration: '3s' }}>
        <div className="absolute inset-0 bg-accent/40 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
      </div>
      <div className="fixed top-1/3 right-1/3 w-1 h-1 bg-secondary/60 rounded-full animate-pulse pointer-events-none z-[1]" style={{ animationDuration: '2.5s' }}>
        <div className="absolute inset-0 bg-secondary/40 rounded-full animate-ping" style={{ animationDuration: '2.5s' }}></div>
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
