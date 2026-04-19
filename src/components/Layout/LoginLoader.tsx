import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface LoginLoaderProps {
  /** Called when the loader animation finishes and the app should mount the dashboard. */
  onComplete: () => void;
  /** Display name shown in the welcome line. */
  name?: string;
  /** Total duration in ms before onComplete fires. */
  duration?: number;
}

const PHASES = [
  "Authenticating session",
  "Loading market intelligence",
  "Syncing trade journal",
  "Calibrating dashboard",
];

export function LoginLoader({
  onComplete,
  name,
  duration = 2200,
}: LoginLoaderProps) {
  const [progress, setProgress] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setProgress(p);
      const idx = Math.min(PHASES.length - 1, Math.floor(p * PHASES.length));
      setPhaseIdx(idx);
      if (p < 1) raf = requestAnimationFrame(tick);
      else onComplete();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(12px)" }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black"
    >
      {/* Concentric expanding rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: [0, 4], opacity: [0.4, 0] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.6,
              ease: "easeOut",
            }}
            className="absolute w-64 h-64 rounded-full border border-primary/30"
          />
        ))}
      </div>

      {/* Rotating conic gradient */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute w-[140vmax] h-[140vmax] opacity-[0.07]"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0%, hsl(var(--primary)) 25%, transparent 50%, hsl(var(--primary)) 75%, transparent 100%)",
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,black_85%)] pointer-events-none" />

      {/* Center stack */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6">
        {/* Logo / mark */}
        <motion.div
          initial={{ scale: 0.4, opacity: 0, rotate: -90 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-2xl border border-primary/40"
            style={{ boxShadow: "0 0 60px hsl(var(--primary) / 0.35)" }}
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-3 rounded-3xl border border-primary/15"
          />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent backdrop-blur-xl flex items-center justify-center">
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-2xl font-black tracking-tighter text-foreground"
            >
              N
            </motion.span>
          </div>
        </motion.div>

        {/* Wordmark */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="text-center"
        >
          <div className="text-[11px] tracking-[0.45em] text-muted-foreground uppercase mb-2">
            {name ? `Welcome back, ${name}` : "Welcome back"}
          </div>
          <div className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
            NSYNC <span className="text-primary">JOURNAL</span>
          </div>
        </motion.div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0.6 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="w-[280px] sm:w-[340px] flex flex-col gap-3"
        >
          <div className="h-[2px] w-full rounded-full bg-foreground/10 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary"
              style={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.1, ease: "linear" }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] tracking-[0.3em] uppercase">
            <motion.span
              key={phaseIdx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-muted-foreground"
            >
              {PHASES[phaseIdx]}
            </motion.span>
            <span className="text-primary font-mono">
              {Math.floor(progress * 100).toString().padStart(2, "0")}%
            </span>
          </div>
        </motion.div>
      </div>

      {/* Scanning line */}
      <motion.div
        initial={{ y: "-100%" }}
        animate={{ y: "100vh" }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/60 to-transparent pointer-events-none"
      />
    </motion.div>
  );
}
