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
import { Header } from "@/components/Header";
import AuthTokenBridge from "./components/AuthTokenBridge";
import { useStatusBar } from "@/hooks/useStatusBar";

const queryClient = new QueryClient();

const App = () => {
  // Konfigurera statusbaren för mobila appar
  useStatusBar();

  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen">
            <Header />
            <main className="pt-16">
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
                <Route path="/settings" element={<Index />} />
                <Route path="/billing" element={<Index />} />
                <Route path="/payment" element={<Index />} />
                <Route path="/reset-redirect" element={<ResetRedirect />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
