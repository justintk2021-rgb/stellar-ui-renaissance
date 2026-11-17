import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Save,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { NotebookEntry, Trade } from "@/types/trade";
import { useChecklists } from "@/hooks/useChecklists";
import { useTradeDetail } from "@/hooks/useTrades";
import { TradeScreenshot } from "@/components/Journal/TradeScreenshot";
import { RichTextEditor } from "@/components/Notebook/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SymbolMark } from "@/components/ui/AssetIcon";
import { tradeHasJournalNotes } from "@/lib/notifications";
import {
  formatLocalDateKey,
  getTradeCloseLocalDateKey,
  getTradeNetResult,
} from "@/lib/tradeFormat";
import { cn } from "@/lib/utils";

export const PSYCHOLOGY_JOURNAL_CATEGORY = "psychology";

type Mode = "trade" | "daily";

const TRADE_QUESTIONS_BASE = [
  {
    id: "before",
    text: "How did you feel before you took this trade — calm, rushed, FOMO, confident?",
  },
  {
    id: "why",
    text: "What made you take this trade — your setup, or an emotion (FOMO, boredom, revenge after a loss)?",
  },
  {
    id: "entry",
    text: "Did you wait for your break-and-retest confirmation, or did you enter early? What were you feeling in that moment?",
  },
  {
    id: "open",
    text: "While the trade was open, what emotions came up — and did they make you want to move your stop, exit early, or add size?",
  },
  {
    id: "result",
    text: "", // filled adaptively
  },
  {
    id: "different",
    text: "What would you do differently next time — same setup, different headspace?",
  },
  {
    id: "discipline",
    text: "From 1 to 10, how disciplined were you on this trade — and what pulled the number down if it wasn't 10?",
  },
  {
    id: "identity",
    text: "In one line: what kind of trader were you on this trade?",
  },
] as const;

const DAILY_QUESTIONS = [
  {
    id: "feeling",
    text: "How are you feeling going into today — and what could throw you off?",
  },
  {
    id: "urge",
    text: "Did you feel the urge to trade today — even if you didn't take one? What triggered it?",
  },
  {
    id: "headspace",
    text: "If you traded: what was your headspace on your trades today? If you didn't: how do you feel about sitting out?",
  },
  {
    id: "emotion",
    text: "What emotion showed up most today — and did it help or hurt you?",
  },
  {
    id: "practice",
    text: "One thing you'll protect or practice tomorrow.",
  },
] as const;

const AI_INSIGHT_MARKER = 'data-psychology-ai-insight="true"';

interface PsychologyJournalViewProps {
  trades: Trade[];
  userId?: string;
  notebookEntries: NotebookEntry[];
  onSaveEntry: (entry: NotebookEntry) => void;
  focusTradeId?: string | null;
  onFocusHandled?: () => void;
}

function checklistGrade(percentage: number) {
  if (percentage >= 90) return { grade: "A Setup", color: "text-emerald-500", bgColor: "bg-emerald-500/20" };
  if (percentage >= 75) return { grade: "B Setup", color: "text-blue-500", bgColor: "bg-blue-500/20" };
  if (percentage >= 60) return { grade: "C Setup", color: "text-yellow-500", bgColor: "bg-yellow-500/20" };
  return { grade: "D Setup", color: "text-red-500", bgColor: "bg-destructive/20" };
}

function checklistPercentage(state: NonNullable<Trade["checklistState"]>) {
  const hasCustomPercentages = state.some((item) => item.percentage !== undefined);
  if (hasCustomPercentages) {
    return state
      .filter((item) => item.checked)
      .reduce((sum, item) => sum + (item.percentage || 0), 0);
  }
  if (state.length === 0) return 0;
  return (state.filter((item) => item.checked).length / state.length) * 100;
}

function plainFromHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function isAnswered(html: string | undefined) {
  return Boolean(html && plainFromHtml(html).length > 0);
}

function buildEntryHtml(
  questions: { id: string; text: string }[],
  answers: Record<string, string>,
  aiInsight?: string | null,
) {
  const parts = questions
    .filter((q) => isAnswered(answers[q.id]))
    .map(
      (q) =>
        `<h3>${escapeHtml(q.text)}</h3>${answers[q.id]}`,
    );
  let html = parts.join("");
  if (aiInsight?.trim()) {
    html += `<aside ${AI_INSIGHT_MARKER} class="psychology-ai-insight rounded-xl border border-primary/30 bg-primary/5 p-3 mt-4"><h3>AI insight</h3>${aiInsight}</aside>`;
  }
  return html || "<p></p>";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractAiInsight(html: string): string | null {
  const match = html.match(
    /<aside[^>]*data-psychology-ai-insight="true"[^>]*>([\s\S]*?)<\/aside>/i,
  );
  if (!match) return null;
  return match[1].replace(/<h3[^>]*>[\s\S]*?<\/h3>/i, "").trim();
}

function parseAnswersFromHtml(
  html: string,
  questions: { id: string; text: string }[],
): Record<string, string> {
  const answers: Record<string, string> = {};
  const withoutAi = html.replace(
    /<aside[^>]*data-psychology-ai-insight="true"[^>]*>[\s\S]*?<\/aside>/gi,
    "",
  );
  for (const q of questions) {
    const escaped = escapeHtml(q.text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `<h3[^>]*>\\s*${escaped}\\s*<\\/h3>([\\s\\S]*?)(?=<h3[^>]*>|<aside|$)`,
      "i",
    );
    const match = withoutAi.match(re);
    if (match?.[1]?.trim()) {
      answers[q.id] = match[1].trim();
    }
  }
  return answers;
}

function tradeResultLabel(net: number) {
  if (net > 0) return "win";
  if (net < 0) return "loss";
  return "breakeven";
}

export function PsychologyJournalView({
  trades,
  userId,
  notebookEntries,
  onSaveEntry,
  focusTradeId = null,
  onFocusHandled,
}: PsychologyJournalViewProps) {
  const { checklists } = useChecklists();
  const todayKey = formatLocalDateKey(new Date());

  const [mode, setMode] = useState<Mode>("trade");
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [pinnedTradeId, setPinnedTradeId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(true);

  const journaledTrades = useMemo(() => {
    const listed = [...trades]
      .filter((trade) => tradeHasJournalNotes(trade, notebookEntries))
      .sort((a, b) => {
        const aKey = a.closeTime || a.openTime || a.date || "";
        const bKey = b.closeTime || b.openTime || b.date || "";
        return bKey.localeCompare(aKey);
      });

    const pinId = pinnedTradeId || focusTradeId;
    if (!pinId || listed.some((trade) => trade.id === pinId)) return listed;
    const focused = trades.find((trade) => trade.id === pinId);
    return focused ? [focused, ...listed] : listed;
  }, [trades, notebookEntries, pinnedTradeId, focusTradeId]);

  const todayTrades = useMemo(() => {
    return trades.filter((trade) => {
      const key = getTradeCloseLocalDateKey(trade) || trade.date?.slice(0, 10);
      return key === todayKey;
    });
  }, [trades, todayKey]);

  const psychologyEntries = useMemo(
    () =>
      notebookEntries
        .filter((entry) => entry.category === PSYCHOLOGY_JOURNAL_CATEGORY && !entry.isDeleted)
        .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)),
    [notebookEntries],
  );

  const dailyEntries = useMemo(
    () => psychologyEntries.filter((entry) => !entry.tradeId),
    [psychologyEntries],
  );

  const todayDailyEntry = useMemo(
    () => dailyEntries.find((entry) => entry.date === todayKey) ?? null,
    [dailyEntries, todayKey],
  );

  const tradeEntries = useMemo(() => {
    if (!selectedTradeId) return [];
    return psychologyEntries.filter((entry) => entry.tradeId === selectedTradeId);
  }, [psychologyEntries, selectedTradeId]);

  const selectedTrade =
    mode === "trade"
      ? journaledTrades.find((trade) => trade.id === selectedTradeId) ??
        trades.find((trade) => trade.id === selectedTradeId) ??
        null
      : null;

  const linkedNet = selectedTrade ? getTradeNetResult(selectedTrade) : 0;
  const { data: tradeDetail } = useTradeDetail(userId, mode === "trade" ? selectedTradeId : null);
  const checklistState = tradeDetail?.checklistState ?? selectedTrade?.checklistState ?? [];
  const linkedChecklist = selectedTrade?.checklistId
    ? checklists.find((checklist) => checklist.id === selectedTrade.checklistId)
    : null;
  const grade =
    checklistState.length > 0 ? checklistGrade(checklistPercentage(checklistState)) : null;

  const tradeQuestions = useMemo(() => {
    const resultQ =
      linkedNet >= 0
        ? "How did you react to the result — and what story did you tell yourself about it? (win: did it make you overconfident or careful?)"
        : "How did you react to the result — and what story did you tell yourself about it? (loss: how did your body and thoughts react?)";
    return TRADE_QUESTIONS_BASE.map((q) =>
      q.id === "result" ? { id: q.id, text: resultQ } : { id: q.id, text: q.text },
    );
  }, [linkedNet]);

  const questions = mode === "daily" ? [...DAILY_QUESTIONS] : tradeQuestions;
  const currentQuestion = questions[questionIndex] ?? questions[0];
  const currentAnswer = answers[currentQuestion?.id] ?? "";

  useEffect(() => {
    if (!focusTradeId) return;
    setMode("trade");
    setPinnedTradeId(focusTradeId);
    setSelectedTradeId(focusTradeId);
    setSelectedEntryId(null);
    setIsCreating(true);
    setQuestionIndex(0);
    setAnswers({});
    setAiInsight(null);
    setAiError(null);
    onFocusHandled?.();
  }, [focusTradeId, onFocusHandled]);

  useEffect(() => {
    if (focusTradeId || mode !== "trade") return;
    if (!selectedTradeId && journaledTrades[0]) {
      setSelectedTradeId(journaledTrades[0].id);
    } else if (
      selectedTradeId &&
      journaledTrades.length > 0 &&
      !journaledTrades.some((trade) => trade.id === selectedTradeId)
    ) {
      setSelectedTradeId(journaledTrades[0].id);
    }
  }, [focusTradeId, journaledTrades, mode, selectedTradeId]);

  const resetWizard = (nextAnswers: Record<string, string> = {}, insight: string | null = null) => {
    setQuestionIndex(0);
    setAnswers(nextAnswers);
    setAiInsight(insight);
    setAiError(null);
  };

  const startTradeFresh = (tradeId: string) => {
    setMode("trade");
    setPinnedTradeId(tradeId);
    setSelectedTradeId(tradeId);
    setSelectedEntryId(null);
    setIsCreating(true);
    resetWizard();
  };

  const openTradeEntry = (entry: NotebookEntry) => {
    setMode("trade");
    if (entry.tradeId) {
      setSelectedTradeId(entry.tradeId);
      setPinnedTradeId(entry.tradeId);
    }
    setSelectedEntryId(entry.id);
    setIsCreating(false);
    const trade = trades.find((t) => t.id === entry.tradeId);
    const net = trade ? getTradeNetResult(trade) : 0;
    const resultQ =
      net >= 0
        ? "How did you react to the result — and what story did you tell yourself about it? (win: did it make you overconfident or careful?)"
        : "How did you react to the result — and what story did you tell yourself about it? (loss: how did your body and thoughts react?)";
    const qs = TRADE_QUESTIONS_BASE.map((q) =>
      q.id === "result" ? { id: q.id, text: resultQ } : { id: q.id, text: q.text },
    );
    resetWizard(parseAnswersFromHtml(entry.content, qs), extractAiInsight(entry.content));
  };

  const openDaily = (entry?: NotebookEntry | null) => {
    setMode("daily");
    setSelectedTradeId(null);
    const target = entry ?? todayDailyEntry;
    if (target) {
      setSelectedEntryId(target.id);
      setIsCreating(false);
      resetWizard(
        parseAnswersFromHtml(target.content, [...DAILY_QUESTIONS]),
        extractAiInsight(target.content),
      );
    } else {
      setSelectedEntryId(null);
      setIsCreating(true);
      resetWizard();
    }
  };

  const setCurrentAnswer = (html: string) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: html }));
  };

  const entryTitle = () => {
    if (mode === "daily") {
      return `Daily psychology · ${todayKey}`;
    }
    if (!selectedTrade) return "Psychology journal";
    const kind = tradeResultLabel(linkedNet);
    const label =
      kind === "win" ? "After a win" : kind === "loss" ? "After a loss" : "Trade reflection";
    return `${label} · ${selectedTrade.pair}`;
  };

  const handleSave = () => {
    const answeredCount = questions.filter((q) => isAnswered(answers[q.id])).length;
    if (answeredCount === 0) {
      toast.error("Answer at least one question before saving.");
      return;
    }
    if (mode === "trade" && !selectedTradeId) {
      toast.error("Select a journaled trade first.");
      return;
    }

    const now = new Date().toISOString();
    const content = buildEntryHtml(questions, answers, aiInsight);
    const existing =
      (selectedEntryId && psychologyEntries.find((e) => e.id === selectedEntryId)) ||
      (mode === "daily" ? todayDailyEntry : tradeEntries[0]) ||
      null;

    if (existing && !isCreating) {
      void Promise.resolve(
        onSaveEntry({
          ...existing,
          title: entryTitle(),
          content,
          date: mode === "daily" ? todayKey : existing.date,
          tradeId: mode === "trade" ? selectedTradeId ?? undefined : undefined,
          updatedAt: now,
        }),
      ).then(() => {
        setSelectedEntryId(existing.id);
        toast.success(mode === "daily" ? "Daily psychology saved" : "Psychology entry updated");
      });
      return;
    }

    const entry: NotebookEntry = {
      id: crypto.randomUUID(),
      title: entryTitle(),
      content,
      category: PSYCHOLOGY_JOURNAL_CATEGORY,
      date: mode === "daily" ? todayKey : now.slice(0, 10),
      tradeId: mode === "trade" ? selectedTradeId ?? undefined : undefined,
      createdAt: now,
      updatedAt: now,
    };
    void Promise.resolve(onSaveEntry(entry)).then(() => {
      setSelectedEntryId(entry.id);
      setIsCreating(false);
      toast.success(mode === "daily" ? "Daily psychology saved" : "Psychology entry linked to trade");
    });
  };

  const handleAiInsight = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.access_token) {
        throw new Error("Sign in to use AI insight.");
      }

      const answered = questions
        .filter((q) => isAnswered(answers[q.id]))
        .map((q) => `Q: ${q.text}\nA: ${plainFromHtml(answers[q.id])}`)
        .join("\n\n");

      let contextBlock = "";
      if (mode === "trade" && selectedTrade) {
        contextBlock = [
          `Trade: ${selectedTrade.pair} ${selectedTrade.direction}`,
          `Result: ${linkedNet >= 0 ? "+" : ""}${linkedNet.toFixed(2)} (${tradeResultLabel(linkedNet)})`,
          `Session: ${selectedTrade.session || "—"}`,
          linkedChecklist ? `Checklist: ${linkedChecklist.name}${grade ? ` · ${grade.grade}` : ""}` : null,
          selectedTrade.notes?.trim() ? `Trade notes: ${selectedTrade.notes.trim()}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      } else {
        if (todayTrades.length === 0) {
          contextBlock = "No trades today.";
        } else {
          const lines = todayTrades.map((trade) => {
            const net = getTradeNetResult(trade);
            return `${trade.pair} ${trade.direction} ${net >= 0 ? "+" : ""}${net.toFixed(2)}`;
          });
          const total = todayTrades.reduce((sum, trade) => sum + getTradeNetResult(trade), 0);
          contextBlock = `Today's trades (${todayTrades.length}):\n${lines.join("\n")}\nTotal: ${total >= 0 ? "+" : ""}${total.toFixed(2)}`;
        }
      }

      const prompt = [
        "You are helping a trader journal psychology — emotions and discipline, not setups.",
        "Return ONLY 2–3 short observations:",
        "1) a pattern in the emotions,",
        "2) one thing to watch,",
        "3) one concrete practice for next time.",
        "No generic advice, no trade calls, no new trade ideas. Plain text, short bullets ok.",
        "",
        contextBlock,
        "",
        "Answers:",
        answered || "(no answers yet)",
      ].join("\n");

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
            messages: [{ role: "user", content: prompt }],
            userContext: {
              ui: { currentPage: "psychology" },
              user: {},
              mode,
              tradeId: selectedTradeId,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        if (response.status === 404) {
          throw new Error("AI insight isn't available right now");
        }
        throw new Error(errorBody.error || "AI insight isn't available right now");
      }

      const data = await response.json();
      const insightText =
        typeof data.message === "string"
          ? data.message
          : typeof data.content === "string"
            ? data.content
            : typeof data.reply === "string"
              ? data.reply
              : Array.isArray(data.messages)
                ? String(data.messages[data.messages.length - 1]?.content ?? "")
                : "";

      if (!insightText.trim()) {
        throw new Error("AI insight isn't available right now");
      }

      const html = insightText
        .trim()
        .split(/\n+/)
        .map((line: string) => `<p>${escapeHtml(line.replace(/^[-*•]\s*/, ""))}</p>`)
        .join("");
      setAiInsight(html);
      toast.success("AI insight ready — save the entry to keep it");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI insight isn't available right now";
      setAiError(message);
      toast.error(message);
    } finally {
      setAiLoading(false);
    }
  };

  const pastEntries = mode === "daily" ? dailyEntries : tradeEntries;

  return (
    <div className="relative flex min-h-[calc(100vh-10rem)] flex-col gap-4">
      <header className="space-y-1 px-1">
        <div className="flex items-center gap-2 text-foreground">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Brain className="h-4 w-4" />
          </span>
          <h2 className="text-lg font-semibold tracking-tight">Trade psychology journal</h2>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Guided questions for each trade, plus a daily check-in — with optional AI insight from your
          journaled data.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(15rem,17rem)_minmax(0,1fr)_minmax(14rem,16rem)]">
        <aside className="flex min-h-0 flex-col border-r border-border/40 pr-3">
          <button
            type="button"
            onClick={() => openDaily(todayDailyEntry)}
            className={cn(
              "mb-3 flex w-full flex-col rounded-xl border px-3 py-2.5 text-left transition-colors",
              mode === "daily"
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border/40 bg-muted/20 text-foreground/80 hover:bg-muted/40",
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Daily
            </span>
            <span className="text-sm font-medium">
              {todayDailyEntry ? "Today's entry" : "Start today's check-in"}
            </span>
            <span className="text-[11px] text-muted-foreground">{todayKey}</span>
          </button>

          {dailyEntries.filter((e) => e.date !== todayKey).length > 0 ? (
            <div className="mb-3 space-y-1">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Past daily
              </p>
              {dailyEntries
                .filter((e) => e.date !== todayKey)
                .slice(0, 8)
                .map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => openDaily(entry)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                      mode === "daily" && selectedEntryId === entry.id
                        ? "bg-muted/80 text-foreground"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                    )}
                  >
                    <span>{entry.date}</span>
                    <span className="truncate pl-2">{entry.title.replace(/^Daily psychology · /, "")}</span>
                  </button>
                ))}
            </div>
          ) : null}

          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Journaled trades
          </p>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5 scrollbar-thin">
            {journaledTrades.length === 0 ? (
              <p className="px-1 py-4 text-xs text-muted-foreground">
                No journaled trades yet. Journal a trade in the Trade Log first.
              </p>
            ) : (
              journaledTrades.map((trade) => {
                const net = getTradeNetResult(trade);
                const active = mode === "trade" && selectedTradeId === trade.id;
                return (
                  <button
                    key={trade.id}
                    type="button"
                    onClick={() => startTradeFresh(trade.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl border-0 px-2.5 py-2 text-left transition-colors",
                      active ? "bg-muted/80 text-foreground" : "text-foreground/80 hover:bg-muted/40",
                    )}
                  >
                    <SymbolMark symbol={trade.pair} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{trade.pair}</span>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-[11px] font-semibold",
                        net >= 0 ? "text-primary" : "text-destructive",
                      )}
                    >
                      {net >= 0 ? "+" : ""}${net.toFixed(0)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="study-glass flex min-h-[28rem] flex-col rounded-2xl p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {mode === "daily" ? "Daily psychology" : "Trade reflection"}
            </p>
            <button
              type="button"
              onClick={() => {
                if (mode === "daily") openDaily(null);
                else if (selectedTradeId) startTradeFresh(selectedTradeId);
              }}
              disabled={mode === "trade" && !selectedTradeId}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              New
            </button>
          </div>

          {pastEntries.length > 0 ? (
            <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {pastEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    if (mode === "daily") openDaily(entry);
                    else openTradeEntry(entry);
                  }}
                  className={cn(
                    "shrink-0 rounded-xl border-0 px-3 py-2 text-left transition-colors",
                    selectedEntryId === entry.id
                      ? "bg-muted/80 text-foreground"
                      : "text-foreground/80 hover:bg-muted/40",
                  )}
                >
                  <span className="block max-w-[10rem] truncate text-sm font-medium">
                    {entry.title || "Untitled"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(entry.updatedAt || entry.createdAt).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mb-4 px-1 text-xs text-muted-foreground">
              {mode === "daily"
                ? "No daily entries yet — answer the questions below."
                : selectedTrade
                  ? "No psychology entries for this trade yet."
                  : "Select a journaled trade or open Daily to start."}
            </p>
          )}

          {(mode === "daily" || selectedTrade) && currentQuestion ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Question {questionIndex + 1} of {questions.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    disabled={questionIndex <= 0}
                    onClick={() => setQuestionIndex((i) => Math.max(0, i - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    disabled={questionIndex >= questions.length - 1}
                    onClick={() =>
                      setQuestionIndex((i) => Math.min(questions.length - 1, i + 1))
                    }
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted/50">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }}
                />
              </div>

              <div className="mb-4 flex items-start gap-2 rounded-xl border border-border/40 bg-muted/30 px-3 py-2.5">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <p className="text-sm text-muted-foreground">{currentQuestion.text}</p>
              </div>

              <RichTextEditor
                key={`${mode}-${selectedTradeId ?? "daily"}-${currentQuestion.id}-${selectedEntryId ?? "new"}`}
                value={currentAnswer}
                onChange={setCurrentAnswer}
                placeholder="Write your answer…"
                minHeightClass="min-h-[10rem]"
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/40 px-4 py-16 text-center text-sm text-muted-foreground">
              Select a journaled trade or open Daily to begin the guided questions.
            </div>
          )}

          {aiError ? (
            <p className="mt-3 text-xs text-destructive">{aiError}</p>
          ) : null}

          {aiInsight ? (
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                AI insight
              </div>
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground/90"
                dangerouslySetInnerHTML={{ __html: aiInsight }}
              />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {mode === "daily"
                ? "Daily entry · not linked to a trade"
                : selectedTrade
                  ? `Linked to ${selectedTrade.pair} · ${selectedTrade.direction}`
                  : "Not linked to a trade"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleAiInsight()}
                disabled={aiLoading || (mode === "trade" && !selectedTrade)}
                className="gap-1.5"
              >
                {aiLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Get AI insight
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                className="gap-1.5"
                disabled={mode === "trade" && !selectedTrade}
              >
                <Save className="h-4 w-4" />
                Save entry
              </Button>
            </div>
          </div>
        </section>

        <aside
          className={cn(
            "study-glass h-fit shrink-0 rounded-xl p-3",
            mode === "daily"
              ? "bg-muted/20"
              : selectedTrade
                ? linkedNet >= 0
                  ? "bg-primary/5"
                  : "bg-destructive/5"
                : "bg-muted/20",
          )}
        >
          {mode === "daily" ? (
            <div className="space-y-3">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                Today&apos;s trades
              </div>
              {todayTrades.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No trades today</p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {todayTrades.map((trade) => {
                      const net = getTradeNetResult(trade);
                      return (
                        <div
                          key={trade.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-background/40 px-2 py-1.5"
                        >
                          <SymbolMark symbol={trade.pair} size="sm" textClassName="text-xs font-medium" />
                          <span
                            className={cn(
                              "font-mono text-[11px] font-semibold",
                              net >= 0 ? "text-primary" : "text-destructive",
                            )}
                          >
                            {net >= 0 ? "+" : ""}${net.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between border-t border-border/30 pt-2 text-xs">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-mono font-semibold">
                      {(() => {
                        const total = todayTrades.reduce((s, t) => s + getTradeNetResult(t), 0);
                        return `${total >= 0 ? "+" : ""}$${total.toFixed(2)}`;
                      })()}
                    </span>
                  </div>
                </>
              )}
            </div>
          ) : !selectedTrade ? (
            <p className="px-1 py-8 text-center text-xs text-muted-foreground">
              Trade insights appear here when you select a journaled trade.
            </p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    linkedNet >= 0 ? "bg-primary/20" : "bg-destructive/20",
                  )}
                >
                  <TrendingUp
                    className={cn("h-4 w-4", linkedNet >= 0 ? "text-primary" : "text-destructive")}
                  />
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Result</div>
                  <div
                    className={cn(
                      "font-mono text-lg font-bold leading-tight",
                      linkedNet >= 0 ? "text-primary" : "text-destructive",
                    )}
                  >
                    {linkedNet >= 0 ? "+" : ""}${linkedNet.toFixed(0)}
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pair</span>
                  <SymbolMark symbol={selectedTrade.pair} size="sm" textClassName="font-medium" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Direction</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-1.5 py-0 text-[10px]",
                      selectedTrade.direction === "Long"
                        ? "border-primary/50 text-primary"
                        : "border-destructive/50 text-destructive",
                    )}
                  >
                    {selectedTrade.direction}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Session</span>
                  <span className="font-medium">{selectedTrade.session || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">
                    {new Date(selectedTrade.closeTime || selectedTrade.date).toLocaleDateString()}
                  </span>
                </div>
                {linkedChecklist ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Checklist</span>
                      <Badge
                        variant="outline"
                        className="max-w-[7rem] truncate border-primary/30 px-1.5 py-0 text-[10px] text-primary"
                      >
                        {linkedChecklist.name}
                      </Badge>
                    </div>
                    {grade ? (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Grade</span>
                        <Badge className={cn("border-0 px-1.5 py-0 text-[10px]", grade.bgColor, grade.color)}>
                          {grade.grade}
                        </Badge>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>

              {checklistState.length > 0 ? (
                <div className="mt-3 border-t border-border/30 pt-3">
                  <div className="mb-2 text-[9px] uppercase tracking-wider text-muted-foreground">
                    Checklist items
                  </div>
                  <div className="max-h-32 space-y-1 overflow-y-auto">
                    {checklistState.map((item, index) => (
                      <div
                        key={item.id || index}
                        className={cn(
                          "flex items-center gap-1.5 text-[10px]",
                          item.checked ? "text-muted-foreground" : "text-foreground",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border",
                            item.checked
                              ? "border-primary/50 bg-primary/20"
                              : "border-border",
                          )}
                        >
                          {item.checked ? <CheckSquare className="h-2 w-2 text-primary" /> : null}
                        </div>
                        <span className={cn(item.checked && "line-through")}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedTrade.notes?.trim() ? (
                <div className="mt-3 border-t border-border/30 pt-3">
                  <div className="mb-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                    Trade notes
                  </div>
                  <p className="line-clamp-5 text-[11px] leading-relaxed text-muted-foreground">
                    {selectedTrade.notes}
                  </p>
                </div>
              ) : null}

              <div className="mt-3 border-t border-border/30 pt-3">
                <div className="mb-2 text-[9px] uppercase tracking-wider text-muted-foreground">Chart</div>
                <TradeScreenshot tradeId={selectedTrade.id} userId={userId} editable={false} />
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
