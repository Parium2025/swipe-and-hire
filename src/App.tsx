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
import { useDevice } from "@/hooks/use-device";

const queryClient = new QueryClient();

const App = () => {
  const device = useDevice();
  const showHeader = false; // Header removed for cleaner UI

  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <UnsavedChangesProvider>
          <div className="min-h-screen safe-area-content overflow-x-hidden w-full max-w-full">
            {/* Static animated background - identical to WelcomeTunnel */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
              
              {/* Decorative glow effect in bottom right corner */}
              <div className="fixed -bottom-32 -right-32 w-96 h-96 pointer-events-none z-[1] hidden md:block">
                <div className="absolute inset-0 bg-primary-glow/40 rounded-full blur-[120px]"></div>
                <div className="absolute inset-4 bg-primary-glow/30 rounded-full blur-[100px]"></div>
                <div className="absolute inset-8 bg-primary-glow/25 rounded-full blur-[80px]"></div>
              </div>
              
              {/* Bottom bubbles only */}
              <div className="fixed bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.2s' }}></div>
              <div className="fixed bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.8s' }}></div>
              <div className="fixed bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.3s' }}></div>
            </div>
            
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
      </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
