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
import Settings from "./pages/Settings";

const queryClient = new QueryClient();

const App = () => {
  // Konfigurera statusbaren för mobila appar
  useStatusBar();
  const device = useDevice();
  const showHeader = device !== 'mobile';

  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <UnsavedChangesProvider>
          <div className="min-h-screen bg-gradient-parium">
            {/* Static animated background - identical to WelcomeTunnel */}
            <div className="fixed inset-0 pointer-events-none z-0">
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary-dark"></div>
              
              {/* Soft fade at bottom to prevent hard edges */}
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary-dark via-primary-dark/80 to-transparent"></div>
              
              {/* Animated floating elements */}
              <div className="fixed top-20 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2s' }}></div>
              <div className="fixed top-32 left-16 w-2 h-2 bg-accent/40 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.5s' }}></div>
              <div className="fixed top-24 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '3s' }}></div>
              
              <div className="fixed bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.2s' }}></div>
              <div className="fixed bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.8s' }}></div>
              <div className="fixed bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.3s' }}></div>
              
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
