import { Trade } from "@/types/trade";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Filter, TrendingUp, TrendingDown, Activity, CircleDot, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RecentTradesProps {
  trades: Trade[];
}

interface OpenPosition {
  id: string;
  symbol: string;
  side: string | null;
  volume: number;
  open_price: number;
  current_price: number | null;
  floating_pl: number;
  open_time: string;
  stop_loss: number | null;
  take_profit: number | null;
}

interface PendingOrder {
  id: string;
  symbol: string;
  side: string;
  size: number;
  order_type: string;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  status: string;
  created_broker_at: string | null;
}

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24, delay: i * 0.05 },
  }),
  hover: {
    x: 4,
    backgroundColor: "hsl(var(--muted) / 0.3)",
    transition: { type: "spring" as const, stiffness: 400, damping: 25 },
  },
};

export function RecentTrades({ trades }: RecentTradesProps) {
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [orders, setOrders] = useState<PendingOrder[]>([]);

  useEffect(() => {
    const fetchBrokerData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: connections } = await supabase
        .from('broker_connections')
        .select('id')
        .eq('user_id', user.id)
        .eq('connection_status', 'connected');

      if (!connections?.length) return;
      const connIds = connections.map(c => c.id);

      const [posRes, ordRes] = await Promise.all([
        supabase.from('broker_positions').select('*').in('broker_connection_id', connIds).is('closed_at', null),
        supabase.from('broker_orders').select('*').in('broker_connection_id', connIds).eq('status', 'pending'),
      ]);

      if (posRes.data) setPositions(posRes.data.map(p => ({
        id: p.id, symbol: p.symbol, side: p.side, volume: p.volume,
        open_price: Number(p.open_price), current_price: p.current_price ? Number(p.current_price) : null,
        floating_pl: Number(p.floating_pl || 0), open_time: p.open_time,
        stop_loss: p.stop_loss ? Number(p.stop_loss) : null,
        take_profit: p.take_profit ? Number(p.take_profit) : null,
      })));
      if (ordRes.data) setOrders(ordRes.data.map(o => ({
        id: o.id, symbol: o.symbol, side: o.side, size: Number(o.size),
        order_type: o.order_type, entry_price: o.entry_price ? Number(o.entry_price) : null,
        stop_loss: o.stop_loss ? Number(o.stop_loss) : null,
        take_profit: o.take_profit ? Number(o.take_profit) : null,
        status: o.status || 'pending', created_broker_at: o.created_broker_at,
      })));
    };
    fetchBrokerData();
  }, [trades]);

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
      <Tabs defaultValue="recent" className="flex flex-col flex-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <TabsList className="h-8 bg-muted/50">
              <TabsTrigger value="recent" className="text-xs px-3 py-1 h-6 gap-1.5">
                <Activity className="w-3 h-3" />
                Trades
              </TabsTrigger>
              <TabsTrigger value="positions" className="text-xs px-3 py-1 h-6 gap-1.5">
                <CircleDot className="w-3 h-3" />
                Open ({positions.length})
              </TabsTrigger>
              <TabsTrigger value="orders" className="text-xs px-3 py-1 h-6 gap-1.5">
                <ClipboardList className="w-3 h-3" />
                Orders ({orders.length})
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Recent Trades Tab */}
        <TabsContent value="recent" className="flex-1 mt-0">
          <ScrollArea className="flex-1 -mx-2 px-2">
            <AnimatePresence>
              {recentTrades.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left text-xs font-medium text-muted-foreground pb-3 pl-2">Asset</th>
                      <th className="text-left text-xs font-medium text-muted-foreground pb-3">Type</th>
                      <th className="text-left text-xs font-medium text-muted-foreground pb-3">Date</th>
                      <th className="text-right text-xs font-medium text-muted-foreground pb-3">Open</th>
                      <th className="text-right text-xs font-medium text-muted-foreground pb-3">Close</th>
                      <th className="text-right text-xs font-medium text-muted-foreground pb-3">Result</th>
                      <th className="text-center text-xs font-medium text-muted-foreground pb-3 pr-2">Status</th>
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
                          <td className="py-3 pl-2">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold",
                                isProfit ? "bg-primary/20 text-primary" : isLoss ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"
                              )}>
                                {trade.pair.slice(0, 2)}
                              </div>
                              <span className="text-sm font-semibold">{trade.pair}</span>
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1">
                              {trade.direction === 'Long' ? (
                                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                              )}
                              <span className={cn("text-xs font-medium", trade.direction === 'Long' ? "text-primary" : "text-destructive")}>
                                {trade.direction === 'Long' ? 'BUY' : 'SELL'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3">
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(trade.date), 'MMM dd')}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <span className="text-xs font-mono text-muted-foreground">
                              {trade.openPrice != null ? trade.openPrice.toFixed(trade.openPrice < 10 ? 5 : 2) : '—'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <span className="text-xs font-mono text-muted-foreground">
                              {trade.closePrice != null ? trade.closePrice.toFixed(trade.closePrice < 10 ? 5 : 2) : '—'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <span className={cn(
                              "text-xs font-mono font-semibold",
                              isProfit ? "text-primary" : isLoss ? "text-destructive" : "text-muted-foreground"
                            )}>
                              {isProfit ? '+' : ''}{trade.result.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 text-center pr-2">
                            <Badge variant="outline" className={cn(
                              "text-[10px] font-semibold border-0",
                              isProfit ? "bg-primary/15 text-primary" : isLoss ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
                            )}>
                              {isProfit ? 'Win' : isLoss ? 'Loss' : 'BE'}
                            </Badge>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <EmptyState icon={TrendingUp} title="No trades to display" subtitle="Start adding trades to see them here" />
              )}
            </AnimatePresence>
          </ScrollArea>
        </TabsContent>

        {/* Open Positions Tab */}
        <TabsContent value="positions" className="flex-1 mt-0">
          <ScrollArea className="flex-1 -mx-2 px-2">
            {positions.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left text-xs font-medium text-muted-foreground pb-3 pl-2">Symbol</th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-3">Side</th>
                    <th className="text-right text-xs font-medium text-muted-foreground pb-3">Volume</th>
                    <th className="text-right text-xs font-medium text-muted-foreground pb-3">Open</th>
                    <th className="text-right text-xs font-medium text-muted-foreground pb-3">Current</th>
                    <th className="text-right text-xs font-medium text-muted-foreground pb-3">SL</th>
                    <th className="text-right text-xs font-medium text-muted-foreground pb-3">TP</th>
                    <th className="text-right text-xs font-medium text-muted-foreground pb-3 pr-2">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos, index) => {
                    const isBuy = pos.side === 'buy';
                    const isProfit = pos.floating_pl > 0;
                    const isLoss = pos.floating_pl < 0;
                    const decimals = pos.open_price < 10 ? 5 : 2;
                    return (
                      <motion.tr
                        key={pos.id}
                        variants={rowVariants}
                        initial="hidden"
                        animate="visible"
                        whileHover="hover"
                        custom={index}
                        className="border-b border-border/20"
                      >
                        <td className="py-3 pl-2">
                          <span className="text-sm font-semibold">{pos.symbol}</span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            {isBuy ? <TrendingUp className="w-3.5 h-3.5 text-primary" /> : <TrendingDown className="w-3.5 h-3.5 text-destructive" />}
                            <span className={cn("text-xs font-medium", isBuy ? "text-primary" : "text-destructive")}>
                              {isBuy ? 'BUY' : 'SELL'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-right text-xs font-mono text-muted-foreground">{pos.volume}</td>
                        <td className="py-3 text-right text-xs font-mono text-muted-foreground">{pos.open_price.toFixed(decimals)}</td>
                        <td className="py-3 text-right text-xs font-mono text-muted-foreground">{pos.current_price?.toFixed(decimals) ?? '—'}</td>
                        <td className="py-3 text-right text-xs font-mono text-muted-foreground">{pos.stop_loss?.toFixed(decimals) ?? '—'}</td>
                        <td className="py-3 text-right text-xs font-mono text-muted-foreground">{pos.take_profit?.toFixed(decimals) ?? '—'}</td>
                        <td className="py-3 text-right pr-2">
                          <span className={cn(
                            "text-xs font-mono font-semibold",
                            isProfit ? "text-primary" : isLoss ? "text-destructive" : "text-muted-foreground"
                          )}>
                            {isProfit ? '+' : ''}{pos.floating_pl.toFixed(2)}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState icon={CircleDot} title="No open positions" subtitle="Open positions from your broker will appear here" />
            )}
          </ScrollArea>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="flex-1 mt-0">
          <ScrollArea className="flex-1 -mx-2 px-2">
            {orders.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left text-xs font-medium text-muted-foreground pb-3 pl-2">Symbol</th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-3">Side</th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-3">Type</th>
                    <th className="text-right text-xs font-medium text-muted-foreground pb-3">Size</th>
                    <th className="text-right text-xs font-medium text-muted-foreground pb-3">Price</th>
                    <th className="text-right text-xs font-medium text-muted-foreground pb-3">SL</th>
                    <th className="text-right text-xs font-medium text-muted-foreground pb-3 pr-2">TP</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((ord, index) => {
                    const isBuy = ord.side === 'buy';
                    const decimals = (ord.entry_price ?? 0) < 10 ? 5 : 2;
                    return (
                      <motion.tr
                        key={ord.id}
                        variants={rowVariants}
                        initial="hidden"
                        animate="visible"
                        whileHover="hover"
                        custom={index}
                        className="border-b border-border/20"
                      >
                        <td className="py-3 pl-2">
                          <span className="text-sm font-semibold">{ord.symbol}</span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            {isBuy ? <TrendingUp className="w-3.5 h-3.5 text-primary" /> : <TrendingDown className="w-3.5 h-3.5 text-destructive" />}
                            <span className={cn("text-xs font-medium", isBuy ? "text-primary" : "text-destructive")}>
                              {isBuy ? 'BUY' : 'SELL'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3">
                          <Badge variant="outline" className="text-[10px] border-border/50">{ord.order_type}</Badge>
                        </td>
                        <td className="py-3 text-right text-xs font-mono text-muted-foreground">{ord.size}</td>
                        <td className="py-3 text-right text-xs font-mono text-muted-foreground">{ord.entry_price?.toFixed(decimals) ?? '—'}</td>
                        <td className="py-3 text-right text-xs font-mono text-muted-foreground">{ord.stop_loss?.toFixed(decimals) ?? '—'}</td>
                        <td className="py-3 text-right pr-2 text-xs font-mono text-muted-foreground">{ord.take_profit?.toFixed(decimals) ?? '—'}</td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState icon={ClipboardList} title="No pending orders" subtitle="Pending orders from your broker will appear here" />
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
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
        <Icon className="w-8 h-8 opacity-40" />
      </motion.div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground/70">{subtitle}</p>
    </motion.div>
  );
}
