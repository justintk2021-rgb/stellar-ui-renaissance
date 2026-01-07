import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TrendingUp, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

// Zod schemas for form validation
const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address").max(255, "Email is too long"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long"),
});

const signupSchema = loginSchema.extend({
  firstName: z.string().trim().min(1, "First name is required").max(50, "First name is too long"),
  lastName: z.string().trim().min(1, "Last name is required").max(50, "Last name is too long"),
});

export function AuthPage() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Apply theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('atp_theme');
    const savedAccent = localStorage.getItem('atp_accent_color');
    
    // Parse and apply theme
    const theme = savedTheme ? JSON.parse(savedTheme) : 'dark';
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    
    // Parse and apply accent color
    const accent = savedAccent ? JSON.parse(savedAccent) : 'emerald';
    const accentClasses = ['accent-emerald', 'accent-blue', 'accent-purple', 'accent-pink', 'accent-red', 'accent-orange', 'accent-yellow', 'accent-cyan'];
    accentClasses.forEach(cls => document.documentElement.classList.remove(cls));
    document.documentElement.classList.add(`accent-${accent}`);
  }, []);

  useEffect(() => {
    // Check if already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    // Validate form data with Zod
    const schema = isLogin ? loginSchema : signupSchema;
    const result = schema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: { [key: string]: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      toast.error(result.error.errors[0]?.message || "Please fix the form errors");
      setIsLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Welcome back!");
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              first_name: formData.firstName,
              last_name: formData.lastName,
            },
          },
        });
        
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Account created successfully!");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 bg-background">
      {/* Blurred Line Graph Background */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-background">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1200 800"
          preserveAspectRatio="xMidYMid slice"
          style={{ filter: "blur(3px)" }}
        >
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
              <stop offset="50%" stopColor="hsl(var(--secondary))" stopOpacity="0.8" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Area fill under the line */}
          <path
            d="M0 600 L0 450 Q100 400, 200 420 T400 380 T600 350 T800 300 T1000 320 T1200 280 L1200 600 Z"
            fill="url(#areaGradient)"
          />
          
          {/* Main line */}
          <path
            d="M0 450 Q100 400, 200 420 T400 380 T600 350 T800 300 T1000 320 T1200 280"
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          
          {/* Secondary line (lower) */}
          <path
            d="M0 520 Q150 480, 300 500 T500 460 T700 440 T900 400 T1100 420 T1200 380"
            fill="none"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="1.5"
            strokeOpacity="0.3"
            strokeLinecap="round"
          />
          
          {/* Grid lines */}
          <g stroke="hsl(var(--border))" strokeOpacity="0.2" strokeWidth="1">
            <line x1="0" y1="200" x2="1200" y2="200" />
            <line x1="0" y1="400" x2="1200" y2="400" />
            <line x1="0" y1="600" x2="1200" y2="600" />
            <line x1="300" y1="0" x2="300" y2="800" />
            <line x1="600" y1="0" x2="600" y2="800" />
            <line x1="900" y1="0" x2="900" y2="800" />
          </g>
          
          {/* Glow dots on the line */}
          <circle cx="200" cy="420" r="6" fill="hsl(var(--primary))" opacity="0.8">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="600" cy="350" r="6" fill="hsl(var(--primary))" opacity="0.8">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="1000" cy="320" r="6" fill="hsl(var(--primary))" opacity="0.8">
            <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" />
          </circle>
        </svg>
        <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/70 to-background/90" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
      </div>

      {/* Auth Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="glass-strong rounded-3xl p-8 border border-border/40 backdrop-blur-xl shadow-2xl bg-card/95">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center glow-primary">
              <TrendingUp className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {isLogin
                ? "Sign in to access your trading journal"
                : "Enter your details to create an account"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">First Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="John"
                      value={formData.firstName}
                      onChange={(e) => {
                        setFormData({ ...formData, firstName: e.target.value });
                        if (errors.firstName) setErrors({ ...errors, firstName: '' });
                      }}
                      className={`pl-10 bg-background/50 border-border/50 focus:border-primary/50 ${errors.firstName ? 'border-destructive' : ''}`}
                      disabled={isLoading}
                      maxLength={50}
                    />
                  </div>
                  {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Last Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e) => {
                        setFormData({ ...formData, lastName: e.target.value });
                        if (errors.lastName) setErrors({ ...errors, lastName: '' });
                      }}
                      className={`pl-10 bg-background/50 border-border/50 focus:border-primary/50 ${errors.lastName ? 'border-destructive' : ''}`}
                      disabled={isLoading}
                      maxLength={50}
                    />
                  </div>
                  {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (errors.email) setErrors({ ...errors, email: '' });
                  }}
                  className={`pl-10 bg-background/50 border-border/50 focus:border-primary/50 ${errors.email ? 'border-destructive' : ''}`}
                  disabled={isLoading}
                  maxLength={255}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    if (errors.password) setErrors({ ...errors, password: '' });
                  }}
                  className={`pl-10 pr-10 bg-background/50 border-border/50 focus:border-primary/50 ${errors.password ? 'border-destructive' : ''}`}
                  disabled={isLoading}
                  maxLength={128}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              {!isLogin && <p className="text-xs text-muted-foreground">Minimum 8 characters</p>}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90 shadow-glow-sm font-semibold h-11"
            >
              {isLoading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
            </Button>
          </form>


          {/* Toggle */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline font-medium"
              disabled={isLoading}
            >
              {isLogin ? "Sign Up" : "Login here"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
