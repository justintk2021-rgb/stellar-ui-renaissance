import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, Sparkles, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sphere, Stars } from "@react-three/drei";
import * as THREE from "three";
import logo from "@/assets/logo-3d.png";

// Zod schemas for form validation
const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address").max(255, "Email is too long"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long"),
});

const signupSchema = loginSchema.extend({
  firstName: z.string().trim().min(1, "First name is required").max(50, "First name is too long"),
  lastName: z.string().trim().min(1, "Last name is required").max(50, "Last name is too long"),
});

// 3D Animated Blob
function AnimatedBlob() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.08;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.12;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.4} floatIntensity={1.5}>
      <Sphere ref={meshRef} args={[2, 128, 128]} scale={1.2}>
        <MeshDistortMaterial
          color="#8b5cf6"
          attach="material"
          distort={0.35}
          speed={1.5}
          roughness={0.2}
          metalness={0.8}
        />
      </Sphere>
    </Float>
  );
}

// Floating Particles
function Particles() {
  const count = 150;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 15;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 15;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 15;
    }
    return pos;
  }, []);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.015;
      pointsRef.current.rotation.x = state.clock.elapsedTime * 0.008;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.025}
        color="#a855f7"
        transparent
        opacity={0.7}
        sizeAttenuation
      />
    </points>
  );
}

// 3D Scene
function Scene() {
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} color="#c4b5fd" />
      <pointLight position={[-10, -10, -10]} intensity={0.4} color="#8b5cf6" />
      <AnimatedBlob />
      <Particles />
      <Stars radius={80} depth={40} count={2000} factor={3} fade speed={0.8} />
    </>
  );
}

// Page transition variants
const pageVariants = {
  initial: { 
    opacity: 0, 
    scale: 0.95,
    y: 20
  },
  animate: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94] as const
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    y: -20,
    transition: {
      duration: 0.3
    }
  }
};

const formVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24
    }
  }
};

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
    
    const theme = savedTheme ? JSON.parse(savedTheme) : 'dark';
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    
    const accent = savedAccent ? JSON.parse(savedAccent) : 'emerald';
    const accentClasses = ['accent-emerald', 'accent-blue', 'accent-purple', 'accent-pink', 'accent-red', 'accent-orange', 'accent-yellow', 'accent-cyan'];
    accentClasses.forEach(cls => document.documentElement.classList.remove(cls));
    document.documentElement.classList.add(`accent-${accent}`);
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkSession();

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
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen relative overflow-hidden flex items-center justify-center bg-background"
    >
      {/* 3D Canvas Background */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </div>

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/50 to-background/90 z-10" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60 z-10" />

      {/* Back to Home Button */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="absolute top-6 left-6 z-30"
      >
        <Link to="/">
          <motion.div whileHover={{ scale: 1.05, x: -5 }} whileTap={{ scale: 0.95 }}>
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground backdrop-blur-sm bg-white/5 border border-white/10">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </motion.div>
        </Link>
      </motion.div>

      {/* Auth Card */}
      <div className="relative z-20 w-full max-w-md px-4">
        <motion.div
          variants={formVariants}
          initial="hidden"
          animate="visible"
          className="relative rounded-3xl p-8 overflow-hidden"
        >
          {/* Glassmorphism card background */}
          <div className="absolute inset-0 bg-gradient-to-br from-card/80 via-card/60 to-card/40 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl" />
          
          {/* Animated border glow */}
          <motion.div
            className="absolute inset-0 rounded-3xl opacity-50"
            style={{
              background: "linear-gradient(135deg, transparent 40%, rgba(139, 92, 246, 0.3) 50%, transparent 60%)",
              backgroundSize: "200% 200%",
            }}
            animate={{
              backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          />

          <div className="relative">
            {/* Header */}
            <motion.div variants={itemVariants} className="text-center mb-8">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-primary/30"
              >
                <img src={logo} alt="NSYNC" className="w-12 h-12 rounded-xl" />
              </motion.div>
              
              <motion.h1 
                className="text-3xl font-bold mb-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <span className="bg-gradient-to-r from-foreground via-primary to-purple-500 bg-clip-text text-transparent">
                  {isLogin ? "Welcome Back" : "Create Account"}
                </span>
              </motion.h1>
              
              <motion.p 
                className="text-sm text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {isLogin
                  ? "Sign in to access your trading journal"
                  : "Start your journey to better trading"}
              </motion.p>
            </motion.div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div
                    key="name-fields"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-2 gap-4"
                  >
                    <motion.div variants={itemVariants} className="space-y-2">
                      <Label className="text-xs text-muted-foreground font-medium">First Name</Label>
                      <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          placeholder="John"
                          value={formData.firstName}
                          onChange={(e) => {
                            setFormData({ ...formData, firstName: e.target.value });
                            if (errors.firstName) setErrors({ ...errors, firstName: '' });
                          }}
                          className={`pl-10 bg-white/5 border-white/10 focus:border-primary/50 focus:bg-white/10 transition-all duration-300 rounded-xl h-12 ${errors.firstName ? 'border-destructive' : ''}`}
                          disabled={isLoading}
                          maxLength={50}
                        />
                      </div>
                      {errors.firstName && (
                        <motion.p
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-destructive"
                        >
                          {errors.firstName}
                        </motion.p>
                      )}
                    </motion.div>
                    
                    <motion.div variants={itemVariants} className="space-y-2">
                      <Label className="text-xs text-muted-foreground font-medium">Last Name</Label>
                      <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          placeholder="Doe"
                          value={formData.lastName}
                          onChange={(e) => {
                            setFormData({ ...formData, lastName: e.target.value });
                            if (errors.lastName) setErrors({ ...errors, lastName: '' });
                          }}
                          className={`pl-10 bg-white/5 border-white/10 focus:border-primary/50 focus:bg-white/10 transition-all duration-300 rounded-xl h-12 ${errors.lastName ? 'border-destructive' : ''}`}
                          disabled={isLoading}
                          maxLength={50}
                        />
                      </div>
                      {errors.lastName && (
                        <motion.p
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-destructive"
                        >
                          {errors.lastName}
                        </motion.p>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div variants={itemVariants} className="space-y-2">
                <Label className="text-xs text-muted-foreground font-medium">Email Address</Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (errors.email) setErrors({ ...errors, email: '' });
                    }}
                    className={`pl-10 bg-white/5 border-white/10 focus:border-primary/50 focus:bg-white/10 transition-all duration-300 rounded-xl h-12 ${errors.email ? 'border-destructive' : ''}`}
                    disabled={isLoading}
                    maxLength={255}
                  />
                </div>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-destructive"
                  >
                    {errors.email}
                  </motion.p>
                )}
              </motion.div>

              <motion.div variants={itemVariants} className="space-y-2">
                <Label className="text-xs text-muted-foreground font-medium">Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      if (errors.password) setErrors({ ...errors, password: '' });
                    }}
                    className={`pl-10 pr-10 bg-white/5 border-white/10 focus:border-primary/50 focus:bg-white/10 transition-all duration-300 rounded-xl h-12 ${errors.password ? 'border-destructive' : ''}`}
                    disabled={isLoading}
                    maxLength={128}
                  />
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </motion.button>
                </div>
                {errors.password && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-destructive"
                  >
                    {errors.password}
                  </motion.p>
                )}
                {!isLogin && (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-muted-foreground"
                  >
                    Minimum 8 characters
                  </motion.p>
                )}
              </motion.div>

              <motion.div variants={itemVariants}>
                <motion.div
                  whileHover={{ scale: 1.02, boxShadow: "0 20px 40px -10px rgba(139, 92, 246, 0.4)" }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary via-purple-500 to-pink-500 hover:from-primary/90 hover:via-purple-500/90 hover:to-pink-500/90 text-white shadow-xl shadow-primary/30 rounded-xl transition-all duration-300"
                  >
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : (
                      <>
                        {isLogin ? "Sign In" : "Create Account"}
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </motion.div>
              </motion.div>
            </form>

            {/* Toggle */}
            <motion.div 
              variants={itemVariants}
              className="mt-6 text-center"
            >
              <p className="text-sm text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-primary hover:text-primary/80 font-semibold transition-colors inline-flex items-center gap-1"
                  disabled={isLoading}
                >
                  {isLogin ? (
                    <>
                      Sign Up
                      <Sparkles className="w-3 h-3" />
                    </>
                  ) : (
                    "Login here"
                  )}
                </motion.button>
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* Footer text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-xs text-muted-foreground/60 mt-6"
        >
          By continuing, you agree to our Terms of Service
        </motion.p>
      </div>
    </motion.div>
  );
}
