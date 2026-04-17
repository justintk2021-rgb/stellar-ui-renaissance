import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";

interface GreetingProps {
  name?: string | null;
}

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function Greeting({ name }: GreetingProps) {
  const [greeting, setGreeting] = useState<string>(() => getTimeGreeting());

  useEffect(() => {
    const interval = setInterval(() => {
      const next = getTimeGreeting();
      setGreeting((prev) => (prev !== next ? next : prev));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const fullText = useMemo(() => {
    const trimmed = (name || "").trim();
    return trimmed ? `${greeting}, ${trimmed}` : greeting;
  }, [greeting, name]);

  // Re-trigger animation whenever the displayed text changes
  const animKey = fullText;

  return (
    <motion.p
      key={animKey}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="font-serif italic text-base sm:text-lg text-muted-foreground/90 mb-1 select-none"
      style={{ fontFamily: "'Lora', 'Georgia', serif" }}
      aria-label={fullText}
    >
      {fullText.split("").map((char, i) => (
        <motion.span
          key={`${animKey}-${i}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.045, duration: 0.25, ease: "easeOut" }}
          style={{ display: "inline-block", whiteSpace: "pre" }}
        >
          {char}
        </motion.span>
      ))}
      <motion.span
        aria-hidden
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        className="inline-block ml-0.5 w-[1px] h-[1em] align-middle bg-foreground/60"
      />
    </motion.p>
  );
}
