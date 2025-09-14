import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import EmailConfirm from "./pages/EmailConfirm";
import EmailRedirect from "./pages/EmailRedirect";
import ResetRedirect from "./pages/ResetRedirect";
import EmailVerification from "./pages/EmailVerification";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "@/hooks/useAuth";
import { UnsavedChangesProvider } from "@/hooks/useUnsavedChanges";
import { Header } from "@/components/Header";
import AuthTokenBridge from "./components/AuthTokenBridge";
import { useStatusBar } from "@/hooks/useStatusBar";
import { useDevice } from "@/hooks/use-device";

const queryClient = new QueryClient();

const App = () => {
  // Konfigurera statusbaren för mobila appar
  useStatusBar();
  const device = useDevice();
  const showHeader = device !== 'mobile';

  // Debug mobilproblem
  useEffect(() => {
    console.log('📱 APP DEBUG - Device info:', {
      device,
      showHeader,
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight
    });
  }, [device, showHeader]);

  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <UnsavedChangesProvider>
          <div className="min-h-screen bg-gradient-parium">
            {/* Förenklad bakgrund för mobildebugging - ta bort animationer */}
            <div className="fixed inset-0 pointer-events-none z-0">
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary-dark"></div>
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary-dark via-primary-dark/80 to-transparent"></div>
            </div>
            
            <div className="relative z-10">
              {showHeader && <Header />}
              <main className={showHeader ? "pt-16" : ""}>
                <AuthTokenBridge />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/verify" element={<EmailVerification />} />
                  <Route path="/email-redirect" element={<EmailRedirect />} />
                  <Route path="/confirm" element={<EmailConfirm />} />
                  <Route path="/profile" element={<Index />} />
                  <Route path="/search-jobs" element={<Index />} />
                  <Route path="/subscription" element={<Index />} />
                  <Route path="/support" element={<Index />} />
                  <Route path="/admin" element={<Index />} />
                  <Route path="/settings" element={<Index />} />
                  <Route path="/billing" element={<Index />} />
                  <Route path="/payment" element={<Index />} />
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
