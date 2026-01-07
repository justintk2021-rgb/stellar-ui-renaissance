import { useRef, useMemo, Suspense } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sphere, Stars } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  BarChart3, 
  BookOpen, 
  Shield, 
  Zap, 
  Target,
  ChevronRight,
  Sparkles,
  LineChart,
  PieChart,
  Calendar
} from "lucide-react";
import logo from "@/assets/logo-3d.png";

// Animated 3D Blob Component - Now with white/silver color
function AnimatedBlob() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.1;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.15;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.5} floatIntensity={2}>
      <Sphere ref={meshRef} args={[2.5, 128, 128]} scale={1.5}>
        <MeshDistortMaterial
          color="#e5e5e5"
          attach="material"
          distort={0.4}
          speed={2}
          roughness={0.1}
          metalness={0.9}
        />
      </Sphere>
    </Float>
  );
}

// Floating Particles - White/gray particles
function Particles() {
  const count = 200;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return pos;
  }, []);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
      pointsRef.current.rotation.x = state.clock.elapsedTime * 0.01;
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
        size={0.03}
        color="#ffffff"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

// 3D Scene - Black and white lighting
function Scene() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-10, -10, -10]} intensity={0.6} color="#888888" />
      <AnimatedBlob />
      <Particles />
      <Stars radius={100} depth={50} count={3000} factor={4} fade speed={1} />
    </>
  );
}

// Floating Stat Card Component
function FloatingCard({ 
  children, 
  className = "", 
  delay = 0,
  x = 0,
  y = 0
}: { 
  children: React.ReactNode; 
  className?: string;
  delay?: number;
  x?: number;
  y?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ 
        duration: 0.8, 
        delay,
        type: "spring",
        stiffness: 100 
      }}
      className={`absolute backdrop-blur-xl bg-white/5 border border-white/20 rounded-2xl p-4 shadow-2xl ${className}`}
      style={{ x, y }}
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// Feature Card - Black and white theme
function FeatureCard({ 
  icon: Icon, 
  title, 
  description, 
  index 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group relative p-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl overflow-hidden"
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/10 via-transparent to-white/5" />
      
      <motion.div
        whileHover={{ rotate: 360, scale: 1.1 }}
        transition={{ duration: 0.5 }}
        className="relative w-14 h-14 rounded-2xl bg-white text-black flex items-center justify-center mb-4 shadow-lg"
      >
        <Icon className="w-7 h-7" />
      </motion.div>
      
      <h3 className="relative text-xl font-bold mb-2 text-white">{title}</h3>
      <p className="relative text-white/60 text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}

export default function Landing() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.3], [1, 0.95]);

  const features = [
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Deep insights into your trading performance with comprehensive metrics and visualizations."
    },
    {
      icon: BookOpen,
      title: "Smart Journal",
      description: "Document every trade with rich notes, screenshots, and automatic performance tracking."
    },
    {
      icon: Target,
      title: "Strategy Playbook",
      description: "Build and refine your trading strategies with customizable checklists and rules."
    },
    {
      icon: Calendar,
      title: "Economic Calendar",
      description: "Stay ahead with real-time economic events and market-moving news integration."
    },
    {
      icon: LineChart,
      title: "Interactive Charts",
      description: "Professional charting tools with drawing capabilities and technical analysis."
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your data is encrypted and stored securely. Only you have access to your trading journal."
    }
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-black overflow-x-hidden">
      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, type: "spring" }}
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <motion.div 
            className="flex items-center gap-3"
            whileHover={{ scale: 1.05 }}
          >
            <img src={logo} alt="NSYNC" className="w-10 h-10 rounded-xl" />
            <span className="text-xl font-bold text-white">
              NSYNC Journal
            </span>
          </motion.div>
          
          <div className="hidden md:flex items-center gap-8">
            <motion.a 
              href="#features" 
              className="text-white/60 hover:text-white transition-colors"
              whileHover={{ y: -2 }}
            >
              Features
            </motion.a>
            <motion.a 
              href="#pricing" 
              className="text-white/60 hover:text-white transition-colors"
              whileHover={{ y: -2 }}
            >
              Pricing
            </motion.a>
          </div>
          
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10">
                Login
              </Button>
            </Link>
            <Link to="/auth">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button className="bg-white text-black hover:bg-white/90 shadow-lg">
                  Sign Up
                  <Sparkles className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <motion.section 
        style={{ opacity, scale }}
        className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
      >
        {/* 3D Canvas Background */}
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
            <Suspense fallback={null}>
              <Scene />
            </Suspense>
          </Canvas>
        </div>
        
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50 z-10" />

        {/* Hero Content */}
        <div className="relative z-20 text-center px-6 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-medium mb-6"
            >
              <Zap className="w-4 h-4" />
              Elevate Your Trading Game
            </motion.div>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight"
          >
            <span className="text-white">
              Master Your
            </span>
            <br />
            <span className="bg-gradient-to-r from-white via-white/80 to-white/60 bg-clip-text text-transparent">
              Trading Journey
            </span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10"
          >
            The ultimate trading journal to track, analyze, and improve your trading performance. 
            Built for serious traders who want to level up.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/auth">
              <motion.div 
                whileHover={{ scale: 1.05, boxShadow: "0 20px 40px -10px rgba(255, 255, 255, 0.3)" }} 
                whileTap={{ scale: 0.95 }}
              >
                <Button size="lg" className="text-lg px-8 py-6 bg-white text-black hover:bg-white/90 shadow-2xl rounded-2xl font-semibold">
                  Start Journaling
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>
            </Link>
            
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button 
                variant="outline" 
                size="lg" 
                className="text-lg px-8 py-6 rounded-2xl border-white/30 bg-transparent text-white hover:bg-white/10 hover:border-white/50"
              >
                Watch Demo
              </Button>
            </motion.div>
          </motion.div>
        </div>

        {/* Floating Stat Cards */}
        <FloatingCard className="left-[5%] top-[30%] hidden lg:block" delay={1.2}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-white/50">Win Rate</p>
              <p className="text-2xl font-bold text-white">72%</p>
            </div>
          </div>
        </FloatingCard>

        <FloatingCard className="right-[8%] top-[25%] hidden lg:block" delay={1.4}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <PieChart className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-white/50">Trading Pairs</p>
              <p className="text-lg font-semibold text-white">Unparalleled<br/>Market Access</p>
            </div>
          </div>
        </FloatingCard>

        <FloatingCard className="right-[15%] bottom-[20%] hidden lg:block" delay={1.6}>
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs text-white/50">Profit Factor</p>
              <p className="text-3xl font-bold text-white">2.4x</p>
            </div>
          </div>
        </FloatingCard>

        <FloatingCard className="left-[10%] bottom-[25%] hidden lg:block" delay={1.8}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-white/50">Monthly ROI</p>
              <p className="text-xl font-bold text-white">+18.5%</p>
            </div>
          </div>
        </FloatingCard>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-2"
          >
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-white"
            />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Features Section */}
      <section id="features" className="relative py-32 px-6 bg-black">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-medium mb-6"
            >
              <Sparkles className="w-4 h-4" />
              Powerful Features
            </motion.div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-white">
                Everything You Need to
              </span>
              <br />
              <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                Trade Smarter
              </span>
            </h2>
            <p className="text-white/50 max-w-2xl mx-auto text-lg">
              A comprehensive suite of tools designed to help you analyze, learn, and improve your trading consistently.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <FeatureCard key={feature.title} {...feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 px-6 overflow-hidden bg-black">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5" />
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative max-w-4xl mx-auto text-center"
        >
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            <span className="text-white">
              Ready to Transform
            </span>
            <br />
            <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              Your Trading?
            </span>
          </h2>
          <p className="text-white/50 text-lg mb-10 max-w-2xl mx-auto">
            Join thousands of traders who have already improved their performance with NSYNC Journal.
          </p>
          
          <Link to="/auth">
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              className="inline-block"
            >
              <Button size="lg" className="text-lg px-10 py-7 bg-white text-black hover:bg-white/90 shadow-2xl rounded-2xl font-semibold">
                Get Started Free
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6 bg-black">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="NSYNC" className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-bold text-white">NSYNC Journal</span>
          </div>
          <p className="text-white/40 text-sm">
            © 2025 NSYNC Journal. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
