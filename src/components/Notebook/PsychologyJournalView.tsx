import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  CheckSquare,
  Plus,
  Save,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import type { NotebookEntry, Trade } from "@/types/trade";
import { useChecklists } from "@/hooks/useChecklists";
import { useTradeDetail } from "@/hooks/useTrades";
import { TradeScreenshot } from "@/components/Journal/TradeScreenshot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SymbolMark } from "@/components/ui/AssetIcon";
import { tradeHasJournalNotes } from "@/lib/notifications";
import { getTradeNetResult } from "@/lib/tradeFormat";
import { cn } from "@/lib/utils";

export const PSYCHOLOGY_JOURNAL_CATEGORY = "psychology";

const PSYCHOLOGY_PROMPTS = [
  {
    id: "pre-session",
    title: "Pre-session mindset",
    prompt: "How do you feel going into the session? What state do you want to protect?",
  },
  {
    id: "urge",
    title: "Urge to trade",
    prompt: "What urge or FOMO showed up today, and what rule helped (or would have helped) you pause?",
  },
  {
    id: "plan-follow",
    title: "Plan discipline",
    prompt: "Where did you follow your plan perfectly? Where did emotion override it?",
  },
  {
    id: "loss-response",
    title: "After a loss",
    prompt: "How did your body and thoughts react after a loss? What story did you tell yourself?",
  },
  {
    id: "win-response",
    title: "After a win",
    prompt: "Did a win make you overconfident or careful? What will you carry into the next trade?",
  },
  {
    id: "identity",
    title: "Trader identity",
    prompt: "What kind of trader are you practicing being today — and what behavior would prove it?",
  },
] as const;

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

export function PsychologyJournalView({
  trades,
  userId,
  notebookEntries,
  onSaveEntry,
  focusTradeId = null,
  onFocusHandled,
}: PsychologyJournalViewProps) {
  const { checklists } = useChecklists();

  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [pinnedTradeId, setPinnedTradeId] = useState<string | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(PSYCHOLOGY_PROMPTS[0].id);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>(PSYCHOLOGY_PROMPTS[0].title);
  const [content, setContent] = useState("");
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

  useEffect(() => {
    if (!focusTradeId) return;
    const trade = trades.find((item) => item.id === focusTradeId) ?? null;
    setPinnedTradeId(focusTradeId);
    setSelectedTradeId(focusTradeId);
    setSelectedEntryId(null);
    setIsCreating(true);
    const prompt = PSYCHOLOGY_PROMPTS.find((item) => item.id === selectedPromptId) ?? PSYCHOLOGY_PROMPTS[0];
    setTitle(trade ? `${prompt.title} · ${trade.pair}` : prompt.title);
    setContent("");
    onFocusHandled?.();
  }, [focusTradeId, onFocusHandled, selectedPromptId, trades]);

  useEffect(() => {
    if (focusTradeId) return;
    if (!selectedTradeId && journaledTrades[0]) {
      setSelectedTradeId(journaledTrades[0].id);
    } else if (
      selectedTradeId &&
      journaledTrades.length > 0 &&
      !journaledTrades.some((trade) => trade.id === selectedTradeId)
    ) {
      setSelectedTradeId(journaledTrades[0].id);
    }
  }, [focusTradeId, journaledTrades, selectedTradeId]);

  const selectedTrade = journaledTrades.find((trade) => trade.id === selectedTradeId) ?? null;
  const linkedNet = selectedTrade ? getTradeNetResult(selectedTrade) : 0;
  const { data: tradeDetail } = useTradeDetail(userId, selectedTradeId);
  const checklistState = tradeDetail?.checklistState ?? selectedTrade?.checklistState ?? [];
  const linkedChecklist = selectedTrade?.checklistId
    ? checklists.find((checklist) => checklist.id === selectedTrade.checklistId)
    : null;

  const entries = useMemo(() => {
    return notebookEntries
      .filter(
        (entry) =>
          entry.category === PSYCHOLOGY_JOURNAL_CATEGORY &&
          !entry.isDeleted &&
          (!selectedTradeId || entry.tradeId === selectedTradeId),
      )
      .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  }, [notebookEntries, selectedTradeId]);

  const selectedPrompt = PSYCHOLOGY_PROMPTS.find((prompt) => prompt.id === selectedPromptId) ?? null;
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? null;

  const startFresh = (promptId?: string) => {
    if (!selectedTradeId) {
      toast.error("Select a journaled trade first.");
      return;
    }
    const prompt = PSYCHOLOGY_PROMPTS.find((item) => item.id === promptId) ?? PSYCHOLOGY_PROMPTS[0];
    setSelectedPromptId(prompt.id);
    setSelectedEntryId(null);
    setIsCreating(true);
    setTitle(
      selectedTrade
        ? `${prompt.title} · ${selectedTrade.pair}`
        : prompt.title,
    );
    setContent("");
  };

  const openEntry = (entry: NotebookEntry) => {
    setSelectedEntryId(entry.id);
    setIsCreating(false);
    setSelectedPromptId(null);
    if (entry.tradeId) setSelectedTradeId(entry.tradeId);
    setTitle(entry.title || "Psychology journal");
    setContent(entry.content.replace(/<[^>]*>/g, "").trim());
  };

  const selectTrade = (tradeId: string) => {
    setPinnedTradeId(tradeId);
    setSelectedTradeId(tradeId);
    setSelectedEntryId(null);
    setIsCreating(true);
    const prompt = PSYCHOLOGY_PROMPTS.find((item) => item.id === selectedPromptId) ?? PSYCHOLOGY_PROMPTS[0];
    const trade = journaledTrades.find((item) => item.id === tradeId) ?? trades.find((item) => item.id === tradeId);
    setTitle(trade ? `${prompt.title} · ${trade.pair}` : prompt.title);
    setContent("");
  };

  const handleSave = () => {
    if (!selectedTradeId) {
      toast.error("Link this reflection to a journaled trade.");
      return;
    }
    const body = content.trim();
    if (!body) {
      toast.error("Write a short reflection before saving.");
      return;
    }

    const now = new Date().toISOString();
    if (isCreating || !selectedEntry) {
      const entry: NotebookEntry = {
        id: Date.now().toString(),
        title: title.trim() || selectedPrompt?.title || "Psychology journal",
        content: `<p>${body.replace(/\n/g, "</p><p>")}</p>`,
        category: PSYCHOLOGY_JOURNAL_CATEGORY,
        date: now.slice(0, 10),
        tradeId: selectedTradeId,
        createdAt: now,
        updatedAt: now,
      };
      onSaveEntry(entry);
      setSelectedEntryId(entry.id);
      setIsCreating(false);
      toast.success("Psychology entry linked to trade");
      return;
    }

    onSaveEntry({
      ...selectedEntry,
      title: title.trim() || selectedEntry.title,
      content: `<p>${body.replace(/\n/g, "</p><p>")}</p>`,
      tradeId: selectedTradeId,
      updatedAt: now,
    });
    toast.success("Journal entry updated");
  };

  const grade =
    checklistState.length > 0 ? checklistGrade(checklistPercentage(checklistState)) : null;

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
          Pick a journaled trade, then write your psychology reflection. Insights stay beside your writing.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(15rem,17rem)_minmax(0,1fr)_minmax(14rem,16rem)]">
        <aside className="flex min-h-0 flex-col border-r border-border/40 pr-3">
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
                const active = selectedTradeId === trade.id;
                return (
                  <button
                    key={trade.id}
                    type="button"
                    onClick={() => selectTrade(trade.id)}
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
              Past entries
            </p>
            <button
              type="button"
              onClick={() => startFresh(selectedPromptId ?? PSYCHOLOGY_PROMPTS[0].id)}
              disabled={!selectedTrade}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              New
            </button>
          </div>
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {entries.length === 0 ? (
              <p className="px-1 py-1 text-xs text-muted-foreground">
                {selectedTrade
                  ? "No psychology entries for this trade yet."
                  : "Select a journaled trade to start."}
              </p>
            ) : (
              entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => openEntry(entry)}
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
              ))
            )}
          </div>

          {isCreating ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {PSYCHOLOGY_PROMPTS.map((prompt) => {
                const active = selectedPromptId === prompt.id;
                return (
                  <button
                    key={prompt.id}
                    type="button"
                    onClick={() => startFresh(prompt.id)}
                    disabled={!selectedTrade}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50",
                      active
                        ? "bg-primary/15 text-primary"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    {prompt.title}
                  </button>
                );
              })}
            </div>
          ) : null}

          {selectedPrompt && isCreating ? (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-border/40 bg-muted/30 px-3 py-2.5">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">{selectedPrompt.prompt}</p>
            </div>
          ) : null}

          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Entry title"
            className="mb-3 h-11 border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
          />

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={
              selectedTrade
                ? `Reflect on ${selectedTrade.pair} (${selectedTrade.direction})…`
                : "Select a journaled trade, then write your psychology reflection…"
            }
            disabled={!selectedTrade}
            className="min-h-[16rem] flex-1 resize-none rounded-xl border border-border/40 bg-background/40 px-3.5 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:border-border/70 focus:ring-1 focus:ring-border/40 disabled:cursor-not-allowed disabled:opacity-60"
          />

          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {selectedTrade
                ? `Linked to ${selectedTrade.pair} · ${selectedTrade.direction}`
                : "Not linked to a trade"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => startFresh(selectedPromptId ?? undefined)}
                disabled={!selectedTrade}
              >
                Clear
              </Button>
              <Button type="button" onClick={handleSave} className="gap-1.5" disabled={!selectedTrade}>
                <Save className="h-4 w-4" />
                Save entry
              </Button>
            </div>
          </div>
        </section>

        <aside
          className={cn(
            "study-glass h-fit shrink-0 rounded-xl p-3",
            selectedTrade
              ? linkedNet >= 0
                ? "bg-primary/5"
                : "bg-destructive/5"
              : "bg-muted/20",
          )}
        >
          {!selectedTrade ? (
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
