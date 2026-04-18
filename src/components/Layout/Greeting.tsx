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

  // Sanitize: never display an email address. If name looks like an email,
  // fall back to the local-part before "@" only if it's clearly a real name
  // (no digits/dots), otherwise show greeting alone.
  const safeName = useMemo(() => {
    const trimmed = (name || "").trim();
    if (!trimmed) return "";
    if (trimmed.includes("@")) return "";
    return trimmed;
  }, [name]);

  const fullText = useMemo(() => {
    return safeName ? `${greeting}, ${safeName}` : greeting;
  }, [greeting, safeName]);

  // Keep animation key stable across name hydration to avoid re-flash glitches
  const animKey = safeName ? "with-name" : "no-name";

  return (
    <div className="mb-2 select-none" aria-label={fullText}>
      <span
        key={animKey}
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
