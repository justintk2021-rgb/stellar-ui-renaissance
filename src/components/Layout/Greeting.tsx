import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { loadGreetingFont, waitForPageLoad } from "@/lib/greetingFont";

interface GreetingProps {
  name?: string | null;
  /** When true, profile fetch finished — safe to build final greeting text. */
  profileReady?: boolean;
}

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function buildGreetingText(timeGreeting: string, safeName: string): string {
  return safeName ? `${timeGreeting}, ${safeName}` : timeGreeting;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function Greeting({ name, profileReady = false }: GreetingProps) {
  const [greeting, setGreeting] = useState<string>(() => getTimeGreeting());
  const [lockedText, setLockedText] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const safeName = useMemo(() => {
    const trimmed = (name || "").trim();
    if (!trimmed) return "";
    if (trimmed.includes("@")) return "";
    return trimmed;
  }, [name]);

  const nameRef = useRef(safeName);
  const greetingRef = useRef(greeting);
  const profileReadyRef = useRef(profileReady);
  nameRef.current = safeName;
  greetingRef.current = greeting;
  profileReadyRef.current = profileReady;

  useEffect(() => {
    const interval = setInterval(() => {
      const next = getTimeGreeting();
      setGreeting((prev) => (prev !== next ? next : prev));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Reveal once: after page + font + profile are ready (full line fades in together).
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await Promise.all([loadGreetingFont(), waitForPageLoad()]);
      if (cancelled) return;

      const deadline = Date.now() + 2500;
      while (Date.now() < deadline) {
        if (profileReadyRef.current) break;
        await sleep(50);
        if (cancelled) return;
      }

      if (cancelled) return;

      const text = buildGreetingText(greetingRef.current, nameRef.current);
      setLockedText(text);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setVisible(true);
        });
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="mb-2 h-9 md:h-10 select-none"
      aria-label={lockedText ?? undefined}
    >
      {lockedText ? (
        <span
          className={cn(
            "font-greeting inline-block text-3xl md:text-4xl font-semibold tracking-wide text-primary",
            "transition-opacity duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]",
            visible ? "opacity-100" : "opacity-0",
          )}
        >
          {lockedText}
        </span>
      ) : null}
    </div>
  );
}
