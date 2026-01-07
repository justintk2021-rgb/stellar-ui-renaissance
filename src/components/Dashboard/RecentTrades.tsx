import { Trade } from "@/types/trade";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Filter, MoreVertical, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RecentTradesProps {
  trades: Trade[];
}

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
      delay: i * 0.05,
    },
  }),
  hover: {
    x: 4,
    backgroundColor: "hsl(var(--muted) / 0.3)",
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
    },
  },
};

const iconVariants = {
  initial: { scale: 1 },
  hover: { scale: 1.2, rotate: 5 },
};

export function RecentTrades({ trades }: RecentTradesProps) {
  // Get recent trades sorted by date (newest first)
  const recentTrades = [...trades]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3, type: "spring" as const, stiffness: 200 }}
      className="relative rounded-2xl p-6 overflow-hidden bg-card/40 backdrop-blur-xl border border-border/30 shadow-xl flex flex-col min-h-[340px]"
    >
      
      {/* Header */}
      <div className="relative flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <motion.div
            variants={iconVariants}
            initial="initial"
            whileHover="hover"
            className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"
          >
            <Activity className="w-4 h-4 text-primary" />
          </motion.div>
          <h3 className="text-sm font-semibold">Recent Trades</h3>
        </div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-2 hover:text-foreground">
            Add filter
            <Filter className="w-3.5 h-3.5" />
          </Button>
        </motion.div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1 -mx-2 px-2">
        <AnimatePresence>
          {recentTrades.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left text-xs font-medium text-muted-foreground pb-3 pl-2">Asset</th>
                  <th className="text-left text-xs font-medium text-muted-foreground pb-3">Type</th>
                  <th className="text-left text-xs font-medium text-muted-foreground pb-3">Date</th>
                  <th className="text-right text-xs font-medium text-muted-foreground pb-3">Result</th>
                  <th className="text-center text-xs font-medium text-muted-foreground pb-3">Status</th>
                  <th className="text-right text-xs font-medium text-muted-foreground pb-3 pr-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((trade, index) => {
                  const isProfit = trade.result > 0;
                  const isLoss = trade.result < 0;
                  
                  return (
                    <motion.tr
                      key={trade.id}
                      variants={rowVariants}
                      initial="hidden"
                      animate="visible"
                      whileHover="hover"
                      custom={index}
                      className="border-b border-border/20 cursor-pointer rounded-lg"
                    >
                      {/* Asset */}
                      <td className="py-3.5 pl-2">
                        <div className="flex items-center gap-3">
                          <motion.div 
                            variants={iconVariants}
                            initial="initial"
                            whileHover="hover"
                            className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shadow-lg",
                              isProfit ? "bg-primary/20 text-primary shadow-primary/20" : isLoss ? "bg-destructive/20 text-destructive shadow-destructive/20" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {trade.pair.slice(0, 2)}
                          </motion.div>
                          <span className="text-sm font-semibold">{trade.pair}</span>
                        </div>
                      </td>
                      
                      {/* Type */}
                      <td className="py-3.5">
                        <div className="flex items-center gap-1.5">
                          {trade.direction === 'Long' ? (
                            <TrendingUp className="w-4 h-4 text-primary" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-destructive" />
                          )}
                          <span className={cn(
                            "text-sm font-medium",
                            trade.direction === 'Long' ? "text-primary" : "text-destructive"
                          )}>
                            {trade.direction === 'Long' ? 'BUY' : 'SELL'}
                          </span>
                        </div>
                      </td>
                      
                      {/* Date */}
                      <td className="py-3.5">
                        <span className="text-sm text-muted-foreground">
                          {format(parseISO(trade.date), 'MMM dd, yyyy')}
                        </span>
                      </td>
                      
                      {/* Result */}
                      <td className="py-3.5 text-right">
                        <motion.span 
                          className={cn(
                            "text-sm font-mono font-semibold",
                            isProfit ? "text-primary" : isLoss ? "text-destructive" : "text-muted-foreground"
                          )}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05 + 0.2 }}
                        >
                          {isProfit ? '+' : ''}{trade.result.toFixed(2)}
                        </motion.span>
                      </td>
                      
                      {/* Status */}
                      <td className="py-3.5 text-center">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05 + 0.3 }}
                        >
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs font-semibold border-0 shadow-sm",
                              isProfit 
                                ? "bg-primary/15 text-primary shadow-primary/20" 
                                : isLoss 
                                  ? "bg-destructive/15 text-destructive shadow-destructive/20" 
                                  : "bg-muted text-muted-foreground"
                            )}
                          >
                            {isProfit ? 'Win' : isLoss ? 'Loss' : 'BE'}
                          </Badge>
                        </motion.div>
                      </td>
                      
                      {/* Action */}
                      <td className="py-3.5 text-right pr-2">
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </motion.div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 py-16"
            >
              <motion.div 
                className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <TrendingUp className="w-8 h-8 opacity-40" />
              </motion.div>
              <p className="text-sm font-medium">No trades to display</p>
              <p className="text-xs text-muted-foreground/70">Start adding trades to see them here</p>
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </motion.div>
  );
}
