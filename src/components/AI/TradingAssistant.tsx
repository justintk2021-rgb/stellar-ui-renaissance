import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Sparkles, Plus, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trade } from "@/types/trade";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface TradingAssistantProps {
  trades: Trade[];
  onAddTrade: (trade: Omit<Trade, "id">) => Promise<Trade | null | void>;
}

// Check for browser speech recognition support
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const TradingAssistant = ({ trades, onAddTrade }: TradingAssistantProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingTrade, setPendingTrade] = useState<Omit<Trade, "id"> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize speech recognition
  useEffect(() => {
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          sendMessage(transcript);
        }
        setIsRecording(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          toast.error(`Voice error: ${event.error}`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  const getTradeContext = () => {
    if (trades.length === 0) return null;

    const wins = trades.filter(t => t.result > 0);
    const losses = trades.filter(t => t.result < 0);
    const totalPnL = trades.reduce((sum, t) => sum + t.result, 0);
    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.result, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.result, 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : 0;

    const pairCounts: Record<string, number> = {};
    const sessionCounts: Record<string, number> = {};
    
    trades.forEach(t => {
      pairCounts[t.pair] = (pairCounts[t.pair] || 0) + 1;
      if (t.session) sessionCounts[t.session] = (sessionCounts[t.session] || 0) + 1;
    });

    const topPairs = Object.entries(pairCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p).join(", ") || "None";
    const topSessions = Object.entries(sessionCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s).join(", ") || "None";

    const recentTrades = trades.slice(0, 5).map(t => 
      `${t.date}: ${t.pair} ${t.direction} $${t.result > 0 ? '+' : ''}${t.result.toFixed(2)}`
    ).join("; ");

    return {
      totalTrades: trades.length,
      winRate: ((wins.length / trades.length) * 100).toFixed(1),
      totalPnL: totalPnL.toFixed(2),
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      profitFactor: profitFactor.toFixed(2),
      topPairs,
      topSessions,
      recentTrades: recentTrades || "No recent trades"
    };
  };

  const speak = (text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Clean text for speech (remove markdown symbols)
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/\n/g, ' ')
      .replace(/[📊📅💰⏰📈✅]/g, '');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const startRecording = () => {
    if (!SpeechRecognition) {
      toast.error("Voice input not supported in this browser");
      return;
    }

    try {
      recognitionRef.current?.start();
      setIsRecording(true);
      toast.info("Listening... Speak now");
    } catch (error) {
      console.error("Error starting recognition:", error);
      toast.error("Could not start voice input");
    }
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = { role: "user", content };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please log in to use the trading assistant");
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "You need to be logged in to use the trading assistant. Please sign in first."
        }]);
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trading-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage].map(m => ({
              role: m.role,
              content: m.content
            })),
            tradeContext: getTradeContext()
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get response");
      }

      const data = await response.json();
      
      if (data.type === "tool_call" && data.tool === "add_trade") {
        const tradeData: Omit<Trade, "id"> = {
          date: data.data.date,
          pair: data.data.pair,
          direction: data.data.direction,
          result: data.data.result,
          session: data.data.session || "",
          notes: data.data.notes || "",
        };
        setPendingTrade(tradeData);
        
        const assistantMessage = `I can add this trade for you:\n\n📊 **${tradeData.pair}** - ${tradeData.direction}\n📅 Date: ${tradeData.date}\n💰 Result: $${tradeData.result > 0 ? '+' : ''}${tradeData.result}\n${tradeData.session ? `⏰ Session: ${tradeData.session}\n` : ''}\nShould I add this trade?`;
        
        setMessages(prev => [...prev, {
          role: "assistant",
          content: assistantMessage
        }]);
        
        speak(`I can add this ${tradeData.pair} ${tradeData.direction} trade for ${tradeData.result > 0 ? 'a profit of' : 'a loss of'} $${Math.abs(tradeData.result)}. Should I add this trade?`);
      } else {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.message
        }]);
        
        speak(data.message);
      }
    } catch (error) {
      console.error("AI error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      }]);
      toast.error("Failed to get AI response");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmAddTrade = async () => {
    if (!pendingTrade) return;

    try {
      const result = await onAddTrade(pendingTrade);
      if (result) {
        const successMessage = `Trade added successfully! Your ${pendingTrade.pair} ${pendingTrade.direction} trade has been logged.`;
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `✅ ${successMessage}`
        }]);
        toast.success("Trade added to journal");
        speak(successMessage);
      }
    } catch (error) {
      toast.error("Failed to add trade");
    } finally {
      setPendingTrade(null);
    }
  };

  const cancelAddTrade = () => {
    setPendingTrade(null);
    const cancelMessage = "No problem! Let me know if you'd like to add a different trade or need anything else.";
    setMessages(prev => [...prev, {
      role: "assistant",
      content: cancelMessage
    }]);
    speak(cancelMessage);
  };

  const quickPrompts = [
    "Analyze my trading performance",
    "What's my best trading pair?",
    "How can I improve?",
  ];

  const hasSpeechRecognition = !!SpeechRecognition;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 lg:bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg hover:scale-105 transition-transform glow-primary"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-primary-foreground" />
        ) : (
          <Bot className="w-6 h-6 text-primary-foreground" />
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-40 lg:bottom-24 right-6 z-50 w-[calc(100vw-48px)] max-w-md h-[500px] glass-strong rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-border/50 animate-fade-in">
          {/* Header */}
          <div className="p-4 border-b border-border/50 bg-gradient-to-r from-primary/10 to-secondary/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Trading Assistant</h3>
                  <p className="text-xs text-muted-foreground">Voice & text enabled</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className="h-8 w-8"
                title={voiceEnabled ? "Disable voice responses" : "Enable voice responses"}
              >
                {voiceEnabled ? (
                  <Volume2 className="w-4 h-4 text-primary" />
                ) : (
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Hi! I can help analyze your trades or add new ones.</p>
                <p className="text-xs mt-1">Try saying "I went long EURUSD today and made $150"</p>
                {hasSpeechRecognition && (
                  <p className="text-xs mt-2 text-primary">🎤 Use the mic button for voice input!</p>
                )}
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* Pending Trade Actions */}
            {pendingTrade && (
              <div className="flex gap-2 justify-center">
                <Button
                  size="sm"
                  onClick={confirmAddTrade}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Trade
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelAddTrade}
                >
                  Cancel
                </Button>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>
              </div>
            )}

            {isSpeaking && (
              <div className="flex justify-start">
                <button
                  onClick={stopSpeaking}
                  className="flex items-center gap-2 text-xs text-primary hover:text-primary/80"
                >
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  Speaking... (click to stop)
                </button>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border/50">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="flex gap-2"
            >
              {hasSpeechRecognition && (
                <Button
                  type="button"
                  size="icon"
                  variant={isRecording ? "destructive" : "outline"}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading}
                  className="shrink-0"
                  title={isRecording ? "Stop recording" : "Start voice input"}
                >
                  {isRecording ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </Button>
              )}
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type or use voice..."
                className="flex-1 bg-background/50"
                disabled={isLoading || isRecording}
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim() || isRecording}
                className="shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
