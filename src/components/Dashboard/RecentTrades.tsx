import { Trade } from "@/types/trade";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Filter, MoreVertical, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RecentTradesProps {
  trades: Trade[];
}

export function RecentTrades({ trades }: RecentTradesProps) {
  // Get recent trades sorted by date (newest first)
  const recentTrades = [...trades]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="lg:col-span-2 glass rounded-2xl p-6 border border-border/40 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Recent Trades</h3>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-2">
          Add filter
          <Filter className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Table */}
      <ScrollArea className="h-[320px]">
        {recentTrades.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-xs font-medium text-muted-foreground pb-3">Asset</th>
                <th className="text-left text-xs font-medium text-muted-foreground pb-3">Type</th>
                <th className="text-left text-xs font-medium text-muted-foreground pb-3">Date</th>
                <th className="text-right text-xs font-medium text-muted-foreground pb-3">Result</th>
                <th className="text-center text-xs font-medium text-muted-foreground pb-3">Status</th>
                <th className="text-right text-xs font-medium text-muted-foreground pb-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.map((trade, index) => {
                const isProfit = trade.result > 0;
                const isLoss = trade.result < 0;
                
                return (
                  <motion.tr
                    key={trade.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                  >
                    {/* Asset */}
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                          isProfit ? "bg-primary/20 text-primary" : isLoss ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"
                        )}>
                          {trade.pair.slice(0, 2)}
                        </div>
                        <span className="text-sm font-medium">{trade.pair}</span>
                      </div>
                    </td>
                    
                    {/* Type */}
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        {trade.direction === 'Long' ? (
                          <TrendingUp className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                        )}
                        <span className={cn(
                          "text-sm",
                          trade.direction === 'Long' ? "text-primary" : "text-destructive"
                        )}>
                          {trade.direction === 'Long' ? 'BUY' : 'SELL'}
                        </span>
                      </div>
                    </td>
                    
                    {/* Date */}
                    <td className="py-3">
                      <span className="text-sm text-muted-foreground">
                        {format(parseISO(trade.date), 'MMM dd, yyyy')}
                      </span>
                    </td>
                    
                    {/* Result */}
                    <td className="py-3 text-right">
                      <span className={cn(
                        "text-sm font-mono font-medium",
                        isProfit ? "text-primary" : isLoss ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {isProfit ? '+' : ''}{trade.result.toFixed(2)}
                      </span>
                    </td>
                    
                    {/* Status */}
                    <td className="py-3 text-center">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs font-medium border-0",
                          isProfit ? "bg-primary/15 text-primary" : isLoss ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {isProfit ? 'Win' : isLoss ? 'Loss' : 'BE'}
                      </Badge>
                    </td>
                    
                    {/* Action */}
                    <td className="py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 py-12">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 opacity-50" />
            </div>
            <p className="text-sm">No trades to display</p>
          </div>
        )}
      </ScrollArea>
    </motion.div>
  );
}
