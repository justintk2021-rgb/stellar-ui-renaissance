import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { motion, useReducedMotion } from "@/lib/motion";
import { TextEffect } from "@/components/core/text-effect";
import { loadGreetingFont } from "@/lib/greetingFont";

export const DASHBOARD_LOCK_KEY = "nsync-dashboard-locked";

const MIN_ENTRY_MS = 3000;
const MAX_ENTRY_MS = 5000;

export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

export function dashboardDisplayName(
  profile: { first_name?: string | null; last_name?: string | null; email?: string | null } | null,
  user: User | null,
): string {
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;

  const meta = user?.user_metadata ?? {};
  const metaName = [meta.full_name, meta.name]
    .find((value) => typeof value === "string" && value.trim() && !value.includes("@"));
  if (typeof metaName === "string") return metaName.trim();

  const username = [meta.username, meta.user_name, meta.preferred_username]
    .find((value) => typeof value === "string" && value.trim());
  if (typeof username === "string" && username.trim()) return username.trim();

  const email = profile?.email || user?.email || "";
  const handle = email.split("@")[0]?.trim();
  return handle || "";
}

interface DashboardGreetingProps {
  variant: "entry" | "lock";
  name: string;
  /** Profile lookup finished, so `name` is the final display name. */
  nameReady?: boolean;
  dataReady: boolean;
  /** Stay on the spinner. Used while the session itself is still resolving. */
  hold?: boolean;
  onDismiss: () => void;
}

export function DashboardGreeting({
  variant,
  name,
  nameReady = true,
  dataReady,
  hold = false,
  onDismiss,
}: DashboardGreetingProps) {
  const reduceMotion = useReducedMotion();
  const [minElapsed, setMinElapsed] = useState(variant === "lock");
  const [maxElapsed, setMaxElapsed] = useState(variant === "lock");
  const [fontReady, setFontReady] = useState(false);
  const greeting = greetingForHour(new Date().getHours());
  const line = name ? `${greeting}, ${name}` : greeting;
  const canEnter = !hold && (variant === "lock" || (minElapsed && (dataReady || maxElapsed)));
  const playGreeting = fontReady && nameReady && !hold;

  useEffect(() => {
    let cancelled = false;
    void loadGreetingFont().then(() => {
      if (!cancelled) setFontReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (variant !== "entry" || hold) return;
    const minTimer = window.setTimeout(() => setMinElapsed(true), MIN_ENTRY_MS);
    const maxTimer = window.setTimeout(() => setMaxElapsed(true), MAX_ENTRY_MS);
    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
    };
  }, [hold, variant]);

  useEffect(() => {
    if (!canEnter) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEnter, onDismiss]);

  return (
    <motion.div
      key={variant}
      role="dialog"
      aria-modal="true"
      aria-label={line}
      initial={{ opacity: reduceMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.5, ease: "easeOut" } }}
      transition={{ duration: reduceMotion ? 0 : 0.45, ease: "easeOut" }}
      onClick={() => {
        if (canEnter) onDismiss();
      }}
      className="fixed inset-0 z-[100] flex cursor-default flex-col items-center justify-center gap-8 bg-black/70 backdrop-blur-md"
    >
      <div className="px-6 text-center">
        {playGreeting && (
          reduceMotion ? (
            <h1 className="font-greeting inline-block text-3xl font-semibold text-primary md:text-4xl">
              {line}
            </h1>
          ) : (
            <TextEffect
              key={line}
              per="char"
              preset="fade"
              as="h1"
              delay={0.5}
              speedReveal={0.5}
              segmentTransition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="font-greeting inline-block text-3xl font-semibold text-primary md:text-4xl"
            >
              {line}
            </TextEffect>
          )
        )}
      </div>
      {canEnter ? (
        <motion.p
          initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.35 }}
          className="text-sm tracking-wide text-white/70"
        >
          Click anywhere to enter
        </motion.p>
      ) : (
        <div className="relative" aria-hidden>
          <div className="boot-spinner" />
          <div className="boot-spinnerin" />
        </div>
      )}
    </motion.div>
  );
}
