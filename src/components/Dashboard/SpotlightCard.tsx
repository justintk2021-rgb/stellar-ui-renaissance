import { ReactNode, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  /** Inner padding container class (defaults to p-4). Pass "" to control padding yourself. */
  contentClassName?: string;
  /** Spotlight tint. Defaults to the theme primary. */
  spotlightColor?: string;
  index?: number;
  hoverLift?: boolean;
  onClick?: () => void;
}

/**
 * 21st.dev-style card: mouse-tracking spotlight, gradient border that
 * brightens on hover, and a soft entrance animation.
 */
export function SpotlightCard({
  children,
  className,
  contentClassName = "p-4",
  spotlightColor = "hsl(var(--primary) / 0.14)",
  index = 0,
  hoverLift = true,
  onClick,
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 26,
        delay: index * 0.07,
      }}
      whileHover={hoverLift ? { y: -3 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "group/spot relative h-full w-full rounded-2xl",
        // Gradient border via padded gradient wrapper
        "bg-gradient-to-br from-border/60 via-border/20 to-border/60 p-px",
        "transition-shadow duration-300",
        "hover:shadow-[0_0_30px_-8px_hsl(var(--primary)/0.35)]",
        onClick && "cursor-pointer select-none",
        className,
      )}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[calc(1rem-1px)] bg-card/60 backdrop-blur-xl">
        {/* Mouse-tracking spotlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
          style={{
            background: `radial-gradient(320px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${spotlightColor}, transparent 70%)`,
          }}
        />
        {/* Top edge shine */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
        />
        <div className={cn("relative h-full w-full", contentClassName)}>{children}</div>
      </div>
    </motion.div>
  );
}
