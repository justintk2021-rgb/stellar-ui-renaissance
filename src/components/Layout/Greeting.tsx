import { useEffect, useMemo, useState } from "react";

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

  return (
    <div className="mb-2 select-none" aria-label={fullText}>
      <span
        key={fullText}
        className="inline-block animate-fade-in text-3xl md:text-4xl italic font-semibold tracking-wide"
        style={{
          fontFamily: "'Dancing Script', 'Lora', 'Georgia', cursive",
          color: "hsl(var(--primary))",
          opacity: 0.95,
        }}
      >
        {fullText}
      </span>
    </div>
  );
}
