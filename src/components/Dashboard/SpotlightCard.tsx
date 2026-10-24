import { ReactNode, useCallback, useRef } from "react";
import { motion, useMotionValue, useTransform } from "@/lib/motion";
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
  const hover = useMotionValue(0);
  const lift = useTransform(hover, [0, 1], [0, hoverLift ? -3 : 0]);
  const spotX = useMotionValue(160);
  const spotY = useMotionValue(160);
  const spotTranslateX = useTransform(spotX, (v) => v - 160);
  const spotTranslateY = useTransform(spotY, (v) => v - 160);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    spotX.set(e.clientX - rect.left);
    spotY.set(e.clientY - rect.top);
  }, [spotX, spotY]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      onHoverStart={() => hover.set(1)}
      onHoverEnd={() => hover.set(0)}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      style={{ y: lift }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 26,
        delay: index * 0.07,
      }}
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
        "group/spot perf-contain relative h-full w-full rounded-2xl",
        // Gradient border via padded gradient wrapper
        "bg-gradient-to-br from-border/60 via-border/20 to-border/60 p-px",
        onClick && "cursor-pointer select-none",
        className,
      )}
    >
      <div aria-hidden className="hover-glow-layer rounded-2xl group-hover/spot:opacity-100" />
      <div className="relative h-full w-full overflow-hidden rounded-[calc(1rem-1px)] bg-card/60 backdrop-blur-xl">
        {/* Pre-drawn spotlight — moved with transform, faded with opacity */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-[320px] w-[320px] rounded-full opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
          style={{
            x: spotTranslateX,
            y: spotTranslateY,
            background: `radial-gradient(circle, ${spotlightColor}, transparent 70%)`,
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
