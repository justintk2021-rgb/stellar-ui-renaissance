import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, X, Sparkles, Plus, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trade } from "@/types/trade";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AssistantUserContext } from "@/lib/assistantContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface TradingAssistantProps {
  trades: Trade[];
  userContext: AssistantUserContext;
  onAddTrade: (trade: Omit<Trade, "id">) => Promise<Trade | null | void>;
}

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const TradingAssistant = ({ trades, userContext, onAddTrade }: TradingAssistantProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingTrade, setPendingTrade] = useState<Omit<Trade, "id"> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const userContextRef = useRef(userContext);
  userContextRef.current = userContext;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/\*\*/g, "").replace(/\n/g, " ").replace(/[📊📅💰⏰📈✅→]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = { role: "user", content: content.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to use the assistant");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sign in to chat with your personalized trading assistant." },
        ]);
        return;
      }

      const history = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trading-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages: history,
            userContext: userContextRef.current,
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const msg = errorBody.error || `Request failed (${response.status})`;
        if (response.status === 404) {
          throw new Error("AI assistant is not deployed yet. Run: supabase functions deploy trading-assistant");
        }
        throw new Error(msg);
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
        const assistantMessage =
          `I can add this trade:\n\n**${tradeData.pair}** ${tradeData.direction}\n` +
          `Date: ${tradeData.date} · P&L: $${tradeData.result > 0 ? "+" : ""}${tradeData.result}` +
          (tradeData.session ? `\nSession: ${tradeData.session}` : "") +
          `\n\nShould I add it to your journal?`;
        setMessages((prev) => [...prev, { role: "assistant", content: assistantMessage }]);
        speak(assistantMessage);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
        speak(data.message);
      }
    } catch (error) {
      console.error("AI error:", error);
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, I couldn't respond: ${detail}`,
        },
      ]);
      toast.error(detail);
    } finally {
      setIsLoading(false);
    }
  }, [messages, speak]);

  useEffect(() => {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) sendMessage(transcript);
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis.cancel();
    };
  }, [sendMessage]);

  const confirmAddTrade = async () => {
    if (!pendingTrade) return;
    try {
      const result = await onAddTrade(pendingTrade);
      if (result) {
        const msg = `Trade added — ${pendingTrade.pair} ${pendingTrade.direction} logged.`;
        setMessages((prev) => [...prev, { role: "assistant", content: `✅ ${msg}` }]);
        toast.success("Trade added to journal");
        speak(msg);
      }
    } catch {
      toast.error("Failed to add trade");
    } finally {
      setPendingTrade(null);
    }
  };

  const cancelAddTrade = () => {
    setPendingTrade(null);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "No problem — tell me if you want to log a different trade." },
    ]);
  };

  const firstName = userContext.user.firstName || "there";
  const hasTrades = trades.length > 0;
  const pageLabel = userContext.ui.currentPage;

  const quickPrompts = userContext.ui.inCompareMode
    ? ["Summarize my compare results", "What should I improve?", "How do I use Compare?"]
    : hasTrades
      ? ["Analyze my performance", "What's my best pair?", "How do I connect TradeLocker?"]
      : ["How do I log a trade?", "What can this app do?", "How do I connect my broker?"];

  const hasSpeechRecognition = !!SpeechRecognition;

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "fixed bottom-24 lg:bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-shadow",
          isOpen
            ? "bg-muted border border-border/50"
            : "bg-gradient-to-br from-primary to-primary/70 glow-primary",
        )}
        aria-label={isOpen ? "Close assistant" : "Open AI assistant"}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-foreground" />
        ) : (
          <Bot className="w-6 h-6 text-primary-foreground" />
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="fixed bottom-40 lg:bottom-24 right-6 z-50 w-[calc(100vw-48px)] max-w-md h-[min(560px,calc(100vh-8rem))] glass-strong rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-border/50"
          >
            <div className="p-4 border-b border-border/50 bg-gradient-to-r from-primary/10 to-violet-500/10">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground truncate">NSYNC AI</h3>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Hi {firstName} · viewing {pageLabel}
                      {hasTrades ? ` · ${trades.length} trades` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className="h-8 w-8 shrink-0"
                  title={voiceEnabled ? "Mute voice" : "Enable voice"}
                >
                  {voiceEnabled ? (
                    <Volume2 className="w-4 h-4 text-primary" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-6">
                  <Sparkles className="w-10 h-10 mx-auto mb-3 text-primary/50" />
                  <p className="text-sm font-medium text-foreground">Your personal trading copilot</p>
                  <p className="text-xs mt-1.5 max-w-[260px] mx-auto">
                    Ask about your stats, how to use the app, or say a trade to log it.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4 px-1">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => sendMessage(prompt)}
                        className="text-[11px] px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
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
                  className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted/80 text-foreground rounded-bl-md border border-border/30",
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {pendingTrade && (
                <div className="flex gap-2 justify-center pt-1">
                  <Button size="sm" onClick={confirmAddTrade} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Trade
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelAddTrade}>
                    Cancel
                  </Button>
                </div>
              )}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted/80 rounded-2xl rounded-bl-md px-4 py-2.5 border border-border/30">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:0.1s]" />
                      <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                    </div>
                  </div>
                </div>
              )}

              {isSpeaking && (
                <button
                  type="button"
                  onClick={() => { window.speechSynthesis.cancel(); setIsSpeaking(false); }}
                  className="flex items-center gap-2 text-xs text-primary"
                >
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  Speaking… tap to stop
                </button>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-border/50 bg-background/40">
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
                    onClick={() => {
                      if (isRecording) {
                        recognitionRef.current?.stop();
                      } else {
                        setIsRecording(true);
                        recognitionRef.current?.start();
                      }
                    }}
                    disabled={isLoading}
                    className="shrink-0"
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                )}
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything about your trades or the app…"
                  className="flex-1 bg-background/60 text-sm"
                  disabled={isLoading || isRecording}
                />
                <Button type="submit" size="icon" disabled={isLoading || !input.trim() || isRecording}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
