import { cn } from "@/lib/utils";
import { motion } from "@/lib/motion";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useId, useState } from "react";

type Intensity = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
type BlurIntensity = "sm" | "md" | "lg" | "xl";

interface LiquidGlassCardProps {
  children: ReactNode;
  className?: string;
  draggable?: boolean;
  expandable?: boolean;
  width?: string;
  height?: string;
  expandedWidth?: string;
  expandedHeight?: string;
  blurIntensity?: BlurIntensity;
  shadowIntensity?: Intensity;
  borderRadius?: string;
  glowIntensity?: Intensity;
  style?: CSSProperties;
}

const blurClasses: Record<BlurIntensity, string> = {
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
};

const shadowStyles: Record<Intensity, string> = {
  none: "inset 0 0 0 0 rgba(255, 255, 255, 0)",
  xs: "inset 1px 1px 1px 0 rgba(255, 255, 255, 0.3), inset -1px -1px 1px 0 rgba(255, 255, 255, 0.3)",
  sm: "inset 2px 2px 2px 0 rgba(255, 255, 255, 0.35), inset -2px -2px 2px 0 rgba(255, 255, 255, 0.35)",
  md: "inset 3px 3px 3px 0 rgba(255, 255, 255, 0.45), inset -3px -3px 3px 0 rgba(255, 255, 255, 0.45)",
  lg: "inset 4px 4px 4px 0 rgba(255, 255, 255, 0.5), inset -4px -4px 4px 0 rgba(255, 255, 255, 0.5)",
  xl: "inset 6px 6px 6px 0 rgba(255, 255, 255, 0.55), inset -6px -6px 6px 0 rgba(255, 255, 255, 0.55)",
  "2xl":
    "inset 8px 8px 8px 0 rgba(255, 255, 255, 0.6), inset -8px -8px 8px 0 rgba(255, 255, 255, 0.6)",
};

const glowStyles: Record<Intensity, string> = {
  none: "0 4px 4px rgba(0, 0, 0, 0.05), 0 0 12px rgba(0, 0, 0, 0.05)",
  xs: "0 4px 4px rgba(0, 0, 0, 0.15), 0 0 12px rgba(0, 0, 0, 0.08), 0 0 16px rgba(255, 255, 255, 0.05)",
  sm: "0 4px 4px rgba(0, 0, 0, 0.15), 0 0 12px rgba(0, 0, 0, 0.08), 0 0 24px rgba(255, 255, 255, 0.1)",
  md: "0 4px 4px rgba(0, 0, 0, 0.15), 0 0 12px rgba(0, 0, 0, 0.08), 0 0 32px rgba(255, 255, 255, 0.15)",
  lg: "0 4px 4px rgba(0, 0, 0, 0.15), 0 0 12px rgba(0, 0, 0, 0.08), 0 0 40px rgba(255, 255, 255, 0.2)",
  xl: "0 4px 4px rgba(0, 0, 0, 0.15), 0 0 12px rgba(0, 0, 0, 0.08), 0 0 48px rgba(255, 255, 255, 0.25)",
  "2xl":
    "0 4px 4px rgba(0, 0, 0, 0.15), 0 0 12px rgba(0, 0, 0, 0.08), 0 0 60px rgba(255, 255, 255, 0.3)",
};

export function LiquidGlassCard({
  children,
  className = "",
  draggable = false,
  expandable = false,
  width,
  height,
  expandedWidth,
  expandedHeight,
  blurIntensity = "xl",
  borderRadius = "32px",
  glowIntensity = "sm",
  shadowIntensity = "md",
  style,
  ...props
}: LiquidGlassCardProps) {
  const filterId = useId().replace(/:/g, "");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleExpansion = (event: MouseEvent<HTMLDivElement>) => {
    if (!expandable) return;
    if ((event.target as HTMLElement).closest("a, button, input, select, textarea")) return;
    setIsExpanded((open) => !open);
  };

  const containerVariants = expandable
    ? {
        collapsed: {
          width: width || "auto",
          height: height || "auto",
          transition: { duration: 0.4, ease: [0.5, 1.5, 0.5, 1] as const },
        },
        expanded: {
          width: expandedWidth || "auto",
          height: expandedHeight || "auto",
          transition: { duration: 0.4, ease: [0.5, 1.5, 0.5, 1] as const },
        },
      }
    : undefined;

  const shellStyle: CSSProperties = {
    borderRadius,
    ...(width && !expandable ? { width } : null),
    ...(height && !expandable ? { height } : null),
    ...style,
  };

  const layers = (
    <>
      <div
        className={cn("absolute inset-0 z-0", blurClasses[blurIntensity])}
        style={{ borderRadius, filter: `url(#${filterId})` }}
      />
      <div
        className="absolute inset-0 z-10"
        style={{ borderRadius, boxShadow: glowStyles[glowIntensity] }}
      />
      <div
        className="absolute inset-0 z-20"
        style={{ borderRadius, boxShadow: shadowStyles[shadowIntensity] }}
      />
      <div className="relative z-30 h-full min-h-0">{children}</div>
    </>
  );

  return (
    <>
      <svg className="pointer-events-none absolute h-0 w-0" aria-hidden>
        <defs>
          <filter
            id={filterId}
            x="0"
            y="0"
            width="100%"
            height="100%"
            filterUnits="objectBoundingBox"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.003 0.007"
              numOctaves="1"
              result="turbulence"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale="120"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {draggable || expandable ? (
        <motion.div
          className={cn(
            "relative",
            draggable && "cursor-grab active:cursor-grabbing",
            expandable && "cursor-pointer",
            className,
          )}
          style={shellStyle}
          variants={containerVariants}
          animate={expandable ? (isExpanded ? "expanded" : "collapsed") : undefined}
          onClick={expandable ? handleToggleExpansion : undefined}
          drag={draggable || false}
          dragConstraints={draggable ? { left: 0, right: 0, top: 0, bottom: 0 } : undefined}
          dragElastic={draggable ? 0.3 : undefined}
          dragTransition={
            draggable
              ? { bounceStiffness: 300, bounceDamping: 10, power: 0.3 }
              : undefined
          }
          whileDrag={draggable ? { scale: 1.02 } : undefined}
          whileHover={draggable || expandable ? { scale: 1.01 } : undefined}
          whileTap={draggable || expandable ? { scale: 0.98 } : undefined}
          {...props}
        >
          {layers}
        </motion.div>
      ) : (
        <div className={cn("relative", className)} style={shellStyle} {...props}>
          {layers}
        </div>
      )}
    </>
  );
}
