import { LucideIcon, TrendingDown, TrendingUp, Info } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SpotlightCard } from "./SpotlightCard";
import { Sparkline } from "./Sparkline";

interface StatCardProProps {
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
  extra?: string;
  index?: number;
  sparkData?: number[];
  /** Vertical centered layout for narrow sidebar columns. */
  compact?: boolean;
  onClick?: () => void;
}

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
    <span className={cn(className, "transition-transform duration-200", isAnimating && "scale-[1.03]")}>
      {formattedValue}
    </span>
  );
}

/** Modern dashboard stat tile: spotlight hover, count-up value, sparkline. */
export function StatCardPro({
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
  extra,
  index = 0,
  sparkData,
  compact = false,
  onClick,
}: StatCardProProps) {
  const valueColor = isPositive ? "text-primary" : "text-destructive";
  const iconBg = isPositive ? "bg-primary/10" : "bg-destructive/10";
  const spotlight = isPositive
    ? "hsl(var(--primary) / 0.14)"
    : "hsl(var(--destructive) / 0.12)";

  if (compact) {
    return (
      <SpotlightCard
        index={index}
        spotlightColor={spotlight}
        onClick={onClick}
        contentClassName="px-3 py-4 flex flex-col items-center justify-center text-center gap-2"
      >
        <motion.div
          whileHover={{ rotate: 8, scale: 1.12 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", iconBg)}
        >
          <Icon className={cn("w-4 h-4", valueColor)} />
        </motion.div>

        <div className="flex items-center justify-center gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          {tooltip && (
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger className="shrink-0">
                  <Info className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[200px]">{tooltip}</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5">
          {displayInfinity ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={cn("text-3xl font-bold font-mono tracking-tight", valueColor)}
            >
              ∞
            </motion.span>
          ) : (
            <AnimatedNumber
              value={value}
              decimals={decimals}
              prefix={prefix}
              suffix={suffix}
              className={cn("text-3xl font-bold font-mono tracking-tight", valueColor)}
            />
          )}
          {showTrend && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
            >
              {isPositive ? (
                <TrendingUp className="w-5 h-5 text-primary" />
              ) : (
                <TrendingDown className="w-5 h-5 text-destructive" />
              )}
            </motion.div>
          )}
        </div>

        {sparkData && sparkData.length > 1 && (
          <Sparkline data={sparkData} positive={isPositive} width={120} height={28} className="opacity-90" />
        )}

        {extra && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="text-sm text-muted-foreground"
          >
            {extra}
          </motion.p>
        )}
      </SpotlightCard>
    );
  }

  return (
    <SpotlightCard index={index} spotlightColor={spotlight} onClick={onClick} contentClassName="p-4 flex flex-col justify-between gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <motion.div
            whileHover={{ rotate: 8, scale: 1.12 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", iconBg)}
          >
            <Icon className={cn("w-4 h-4", valueColor)} />
          </motion.div>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </span>
        </div>
        {tooltip && (
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger className="shrink-0 mt-1">
                <Info className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-[200px]">{tooltip}</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="flex items-end justify-between gap-2 min-h-[40px]">
        <div className="flex items-center gap-1.5 min-w-0">
          {displayInfinity ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={cn("text-2xl xl:text-[1.7rem] font-bold font-mono tracking-tight", valueColor)}
            >
              ∞
            </motion.span>
          ) : (
            <AnimatedNumber
              value={value}
              decimals={decimals}
              prefix={prefix}
              suffix={suffix}
              className={cn("text-2xl xl:text-[1.7rem] font-bold font-mono tracking-tight", valueColor)}
            />
          )}
          {showTrend && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
            >
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-primary" />
              ) : (
                <TrendingDown className="w-4 h-4 text-destructive" />
              )}
            </motion.div>
          )}
        </div>
        {sparkData && sparkData.length > 1 && (
          <Sparkline data={sparkData} positive={isPositive} width={104} height={34} className="shrink-0 opacity-90" />
        )}
      </div>

      {extra && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="text-[11px] text-muted-foreground"
        >
          {extra}
        </motion.p>
      )}
    </SpotlightCard>
  );
}
