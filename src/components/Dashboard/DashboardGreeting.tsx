import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { motion, useReducedMotion } from "@/lib/motion";
import { TextAnimate } from "@/registry/magicui/text-animate";

const ANIMATION_MS = 2000;
const READY_DELAY_MS = 2400;

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

export function DashboardGreeting({
  name,
  onDismiss,
}: {
  name: string;
  onDismiss: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [canDismiss, setCanDismiss] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const greeting = greetingForHour(new Date().getHours());
  const line = name ? `${greeting}, ${name}` : greeting;
  const durationSec = reduceMotion ? 0 : ANIMATION_MS / 1000;

  const requestDismiss = useCallback(() => {
    if (!canDismiss || leaving) return;
    if (reduceMotion) {
      onDismiss();
      return;
    }
    setLeaving(true);
  }, [canDismiss, leaving, onDismiss, reduceMotion]);

  useEffect(() => {
    setCanDismiss(false);
    const delay = reduceMotion ? 0 : READY_DELAY_MS;
    const timer = window.setTimeout(() => setCanDismiss(true), delay);
    return () => window.clearTimeout(timer);
  }, [line, reduceMotion]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onDismiss, 450);
    return () => window.clearTimeout(timer);
  }, [leaving, onDismiss]);

  useEffect(() => {
    if (!canDismiss) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      requestDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canDismiss, requestDismiss]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={line}
      initial={{ opacity: 1 }}
      animate={leaving ? { opacity: 0 } : { opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      onClick={requestDismiss}
      className="fixed inset-0 z-[100] flex cursor-default flex-col items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="px-6 text-center">
        <TextAnimate
          key={line}
          animation="blurIn"
          as="h1"
          by="text"
          startOnView={false}
          duration={durationSec}
          delay={reduceMotion ? 0 : 0.15}
          variants={{
            hidden: { opacity: 0, filter: "blur(14px)" },
            show: {
              opacity: 1,
              filter: "blur(0px)",
              transition: {
                duration: durationSec,
                ease: [0.22, 1, 0.36, 1],
              },
            },
            exit: {
              opacity: 0,
              filter: "blur(10px)",
              transition: { duration: reduceMotion ? 0 : 0.35 },
            },
          }}
          className="font-greeting inline-block text-3xl font-semibold text-primary md:text-4xl"
        >
          {line}
        </TextAnimate>
      </div>
    </motion.div>
  );
}
