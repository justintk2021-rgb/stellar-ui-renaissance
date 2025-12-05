import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { UserProfile } from "@/types/user";
import Index from "./pages/Index";
import { AuthPage } from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const [userProfile, setUserProfile] = useLocalStorage<UserProfile | null>('atp_user_profile', null);

  const handleSignUp = (profile: UserProfile) => {
    setUserProfile(profile);
  };

  const handleLogout = () => {
    setUserProfile(null);
  };

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          userProfile ? (
            <Index userProfile={userProfile} onLogout={handleLogout} />
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/auth" 
        element={
          userProfile ? (
            <Navigate to="/" replace />
          ) : (
            <AuthPage onSignUp={handleSignUp} existingUser={userProfile} />
          )
        } 
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
