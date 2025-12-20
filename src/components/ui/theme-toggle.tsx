import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ThemeToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  size?: "sm" | "default" | "lg";
}

const ThemeToggle = React.forwardRef<HTMLButtonElement, ThemeToggleProps>(
  ({ checked, onCheckedChange, className, size = "default" }, ref) => {
    const sizeClasses = {
      sm: "w-12 h-6",
      default: "w-14 h-7",
      lg: "w-16 h-8",
    };

    const thumbSizes = {
      sm: "w-5 h-5",
      default: "w-6 h-6",
      lg: "w-7 h-7",
    };

    const iconSizes = {
      sm: "w-3 h-3",
      default: "w-3.5 h-3.5",
      lg: "w-4 h-4",
    };

    const translateX = {
      sm: checked ? 24 : 2,
      default: checked ? 28 : 2,
      lg: checked ? 32 : 2,
    };

    return (
      <button
        ref={ref}
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5",
          "bg-gradient-to-r transition-all duration-300 ease-out",
          checked
            ? "from-indigo-500/20 via-purple-500/20 to-pink-500/20"
            : "from-amber-500/20 via-orange-500/20 to-yellow-500/20",
          "hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          sizeClasses[size],
          className
        )}
      >
        {/* Background glow effect */}
        <motion.div
          className={cn(
            "absolute inset-0 rounded-full opacity-50 blur-md",
            checked
              ? "bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-pink-500/30"
              : "bg-gradient-to-r from-amber-500/30 via-orange-500/30 to-yellow-500/30"
          )}
          animate={{ opacity: checked ? 0.4 : 0.3 }}
          transition={{ duration: 0.3 }}
        />

        {/* Track background */}
        <div
          className={cn(
            "absolute inset-0 rounded-full transition-colors duration-300",
            checked ? "bg-muted/80" : "bg-muted/60"
          )}
        />

        {/* Animated thumb */}
        <motion.div
          className={cn(
            "relative flex items-center justify-center rounded-full shadow-md",
            "bg-gradient-to-br transition-shadow duration-300",
            checked
              ? "from-indigo-400 to-purple-500 shadow-purple-500/30"
              : "from-amber-400 to-orange-500 shadow-orange-500/30",
            thumbSizes[size]
          )}
          animate={{ x: translateX[size] }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 30,
          }}
        >
          {/* Icon container with rotation */}
          <motion.div
            animate={{ rotate: checked ? 360 : 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            {checked ? (
              <Moon className={cn(iconSizes[size], "text-white")} />
            ) : (
              <Sun className={cn(iconSizes[size], "text-white")} />
            )}
          </motion.div>
        </motion.div>
      </button>
    );
  }
);

ThemeToggle.displayName = "ThemeToggle";

export { ThemeToggle };
