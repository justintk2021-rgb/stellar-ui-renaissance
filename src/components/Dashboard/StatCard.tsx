import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Info, LucideIcon } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  tooltip?: string;
  icon: LucideIcon;
  isPositive: boolean;
  showTrend?: boolean;
  displayInfinity?: boolean;
  colorClass: string;
  bgClass: string;
  highlight?: boolean;
  highlightColor?: "primary" | "destructive";
  extra?: string;
  index?: number;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
      delay: i * 0.06,
    },
  }),
  hover: {
    y: -3,
    scale: 1.015,
    transition: { type: "spring" as const, stiffness: 400, damping: 20 },
  },
};

const iconVariants = {
  initial: { rotate: 0, scale: 1 },
  hover: { rotate: 10, scale: 1.15 },
};

function AnimatedNumber({
  value,
  decimals = 2,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const { formattedValue, isAnimating } = useCountUp({
    end: value,
    duration: 1200,
    decimals,
    prefix,
    suffix,
  });
  return (
    <span className={cn(className, "transition-all duration-200", isAnimating && "scale-105")}>
      {formattedValue}
    </span>
  );
}

function InfoTooltip({ content }: { content: string }) {
  return (
    <TooltipProvider>
      <UITooltip>
        <TooltipTrigger>
          <Info className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs max-w-[200px]">{content}</p>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}

export function StatCard({
  label,
  value,
  prefix = "",
  suffix = "",
  decimals = 2,
  tooltip,
  icon: Icon,
  isPositive,
  showTrend = false,
  displayInfinity = false,
  colorClass,
  bgClass,
  highlight = false,
  highlightColor = "primary",
  extra,
  index = 0,
}: StatCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      custom={index}
      className={cn(
        "relative rounded-2xl p-5 overflow-hidden bg-card/40 backdrop-blur-xl border shadow-xl",
        highlight
          ? highlightColor === "primary"
            ? "border-primary/40"
            : "border-destructive/40"
          : "border-border/30"
      )}
    >
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <motion.div
            variants={iconVariants}
            initial="initial"
            whileHover="hover"
            className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", bgClass)}
          >
            <Icon className={cn("w-4 h-4", colorClass)} />
          </motion.div>
          <span className="text-sm text-muted-foreground truncate">{label}</span>
          {tooltip && <InfoTooltip content={tooltip} />}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {displayInfinity ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-2xl font-bold font-mono text-primary"
            >
              ∞
            </motion.span>
          ) : (
            <AnimatedNumber
              value={value}
              decimals={decimals}
              prefix={prefix}
              suffix={suffix}
              className={cn("text-2xl font-bold font-mono", colorClass)}
            />
          )}
          {showTrend && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-primary" />
              ) : (
                <TrendingDown className="w-4 h-4 text-destructive" />
              )}
            </motion.div>
          )}
        </div>

        {extra && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xs text-muted-foreground mt-2"
          >
            {extra}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
