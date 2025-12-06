import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2, Sparkles, TrendingUp, Target, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Trade } from "@/types/trade";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface TradingAssistantProps {
  trades: Trade[];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trading-assistant`;

const QUICK_PROMPTS = [
  { icon: TrendingUp, label: "Analyze my performance", prompt: "Analyze my overall trading performance and give me key insights." },
  { icon: Target, label: "Find my edge", prompt: "What patterns do you see in my winning trades? Help me identify my trading edge." },
  { icon: Lightbulb, label: "Improvement tips", prompt: "Based on my trades, what are 3 specific things I should improve?" },
];

export function TradingAssistant({ trades }: TradingAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build trade context for AI
  const buildTradeContext = () => {
    if (trades.length === 0) return null;
    
    const wins = trades.filter(t => t.result > 0);
    const losses = trades.filter(t => t.result < 0);
    const totalPnL = trades.reduce((sum, t) => sum + t.result, 0);
    const winRate = (wins.length / trades.length) * 100;
    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.result, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.result, 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? (wins.reduce((sum, t) => sum + t.result, 0) / Math.abs(losses.reduce((sum, t) => sum + t.result, 0))) : 0;
    
    // Get unique values
    const pairs = [...new Set(trades.map(t => t.pair))];
    const sessions = [...new Set(trades.map(t => t.session).filter(Boolean))];
    const strategies = [...new Set(trades.map(t => t.strategy).filter(Boolean))];
    
    // Recent trades (last 10)
    const recentTrades = trades.slice(-10).map(t => ({
      date: t.date,
      pair: t.pair,
      direction: t.direction,
      result: t.result,
      strategy: t.strategy,
      session: t.session,
    }));

    return {
      summary: {
        totalTrades: trades.length,
        wins: wins.length,
        losses: losses.length,
        winRate: winRate.toFixed(1) + "%",
        totalPnL: "$" + totalPnL.toFixed(2),
        avgWin: "$" + avgWin.toFixed(2),
        avgLoss: "$" + avgLoss.toFixed(2),
        profitFactor: profitFactor.toFixed(2),
      },
      tradedPairs: pairs,
      sessions: sessions,
      strategies: strategies,
      recentTrades: recentTrades,
    };
  };

  const streamChat = async (userMessage: string) => {
    const tradeContext = buildTradeContext();
    
    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        messages: [...messages, { role: "user", content: userMessage }],
        tradeContext,
      }),
    });

    if (!response.ok || !response.body) {
      const errorData = await response.json().catch(() => ({ error: "Failed to connect" }));
      throw new Error(errorData.error || "Failed to get response");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            assistantContent += content;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
              }
              return [...prev, { role: "assistant", content: assistantContent }];
            });
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }
  };

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      await streamChat(text);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg",
          "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70",
          "transition-all duration-300 hover:scale-110",
          isOpen && "hidden"
        )}
      >
        <Bot className="w-6 h-6" />
      </Button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] max-h-[80vh] flex flex-col glass rounded-2xl border border-border/50 shadow-2xl overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/30 bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Trading Assistant</h3>
                <p className="text-xs text-muted-foreground">AI-powered insights</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="text-center py-6">
                  <Bot className="w-12 h-12 mx-auto text-primary/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Hi! I'm your trading assistant. I can analyze your trades and provide insights.
                  </p>
                  {trades.length === 0 && (
                    <p className="text-xs text-muted-foreground/70 mt-2">
                      Add some trades to get personalized analysis!
                    </p>
                  )}
                </div>
                
                {/* Quick Prompts */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground text-center">Quick actions:</p>
                  {QUICK_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(prompt.prompt)}
                      disabled={isLoading || trades.length === 0}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border/30 transition-colors text-left disabled:opacity-50"
                    >
                      <prompt.icon className="w-4 h-4 text-primary" />
                      <span className="text-sm">{prompt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted/50 border border-border/30 rounded-bl-md"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex justify-start">
                    <div className="bg-muted/50 border border-border/30 rounded-2xl rounded-bl-md px-4 py-2.5">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-border/30">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your trades..."
                disabled={isLoading}
                className="flex-1 bg-muted/30 border-border/30"
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
