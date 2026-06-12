import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useApplyGlobalSettings } from "./hooks/useApplyGlobalSettings";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { isSupabaseConfigured } from "./integrations/supabase/client";

// Lazy-load route pages so visitors only download the JS they actually need.
// Landing visitors no longer pay for the entire authenticated dashboard bundle.
const Index = lazy(() => import("./pages/Index"));
const Landing = lazy(() => import("./pages/Landing"));
const AuthPage = lazy(() => import("./pages/Auth").then((m) => ({ default: m.AuthPage })));
const NotFound = lazy(() => import("./pages/NotFound"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 1 minute so navigating between tabs doesn't trigger refetches
      staleTime: 60_000,
      // Don't refetch every time the user tabs back to the window — Supabase realtime keeps us fresh
      refetchOnWindowFocus: false,
      // Retry once on failure (instead of the default 3) so users see errors faster
      retry: 1,
    },
  },
});

const GlobalSettingsApplier = () => {
  useApplyGlobalSettings();
  return null;
};

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/20 border-t-primary animate-spin" />
  </div>
);

const ConfigMissing = () => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
    <div className="max-w-md text-center space-y-3">
      <h1 className="text-xl font-semibold">App configuration missing</h1>
      <p className="text-sm text-muted-foreground">
        Set <code className="text-xs">VITE_SUPABASE_URL</code> and{" "}
        <code className="text-xs">VITE_SUPABASE_PUBLISHABLE_KEY</code> in your{" "}
        <code className="text-xs">.env</code> file (local) or Vercel environment
        variables (production), then rebuild.
      </p>
    </div>
  </div>
);

const App = () => {
  if (!isSupabaseConfigured) {
    return <ConfigMissing />;
  }

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GlobalSettingsApplier />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
