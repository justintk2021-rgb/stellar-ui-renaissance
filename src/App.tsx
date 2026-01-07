import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import { AuthPage } from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

// Component to handle session clearing on browser close
function SessionManager() {
  useEffect(() => {
    // Mark session as active when page loads
    sessionStorage.setItem('session-active', 'true');
    
    // Check if this is a fresh browser session (no session marker)
    const wasSessionActive = sessionStorage.getItem('session-active');
    
    // If sessionStorage doesn't have our marker on first load, clear auth
    // This happens when browser was closed and reopened
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Mark that we might be closing
        localStorage.setItem('tab-closing', Date.now().toString());
      }
    };

    // Clear session on page unload (browser/tab close)
    const handleBeforeUnload = () => {
      // Set a flag that indicates the page is unloading
      localStorage.setItem('page-unloading', 'true');
    };

    // On page load, check if session should be cleared
    const checkAndClearSession = () => {
      const pageUnloading = localStorage.getItem('page-unloading');
      if (pageUnloading === 'true') {
        // Clear the flag
        localStorage.removeItem('page-unloading');
        // Sign out to clear session
        supabase.auth.signOut();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Check on mount
    checkAndClearSession();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SessionManager />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Index />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
