import { useEffect, useMemo, useState } from "react";
import {
  BookMarked,
  Brain,
  Check,
  CheckSquare,
  Pencil,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { NotebookEntry, Trade } from "@/types/trade";
import { TradeScreenshot } from "@/components/Journal/TradeScreenshot";
import { StudyNoteMentions } from "@/components/study/StudyNoteMentions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SymbolMark } from "@/components/ui/AssetIcon";
import { useTradeDetail } from "@/hooks/useTrades";
import { notebookPlainText } from "@/lib/notebookSync";
import {
  formatPnL,
  getTradeLocalDateKey,
  getTradeNetResult,
  parseLocalDateKey,
} from "@/lib/tradeFormat";
import { cn } from "@/lib/utils";

type InsightTab = "stats" | "executions";

interface ChecklistSummary {
  id: string;
  name: string;
}

interface TradeInsightModalProps {
  trade: Trade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  checklists?: ChecklistSummary[];
  notebookEntries?: NotebookEntry[];
  onUpdateTrade?: (id: string, updates: Partial<Trade>) => void | Promise<void>;
  onEdit?: (trade: Trade) => void;
  onOpenPlaybook?: () => void;
  onTradeChange?: (trade: Trade) => void;
  onSelectForNotebook?: (id: string, quickNotes?: string) => void | Promise<void>;
  onOpenStudyNote?: (noteId: string) => void;
  onOpenPsychology?: (tradeId: string) => void;
}

function seedQuickNotes(trade: Trade, notebookEntries: NotebookEntry[]) {
  if (trade.notes?.trim()) return trade.notes;
  const entry = notebookEntries.find((item) => item.tradeId === trade.id && !item.isDeleted);
  if (entry) return notebookPlainText(entry.content);
  return "";
}

function formatLongDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? parseLocalDateKey(dateStr)
      : new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatPrice(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(value > 100 ? 2 : 5);
}

function checklistPercentage(state: NonNullable<Trade["checklistState"]>) {
  const hasCustom = state.some((item) => item.percentage !== undefined);
  if (hasCustom) {
    return state.filter((item) => item.checked).reduce((sum, item) => sum + (item.percentage || 0), 0);
  }
  if (!state.length) return 0;
  return (state.filter((item) => item.checked).length / state.length) * 100;
}

function checklistGrade(percentage: number) {
  if (percentage >= 90) return { grade: "A Setup", color: "text-emerald-500", bg: "bg-emerald-500/15" };
  if (percentage >= 75) return { grade: "B Setup", color: "text-blue-500", bg: "bg-blue-500/15" };
  if (percentage >= 60) return { grade: "C Setup", color: "text-yellow-500", bg: "bg-yellow-500/15" };
  return { grade: "D Setup", color: "text-destructive", bg: "bg-destructive/15" };
}

export function TradeInsightModal({
  trade,
  open,
  onOpenChange,
  userId,
  checklists = [],
  notebookEntries = [],
  onUpdateTrade,
  onEdit,
  onOpenPlaybook,
  onTradeChange,
  onSelectForNotebook,
  onOpenStudyNote,
  onOpenPsychology,
}: TradeInsightModalProps) {
  const [insightTab, setInsightTab] = useState<InsightTab>("stats");
  const [selectedChecklistId, setSelectedChecklistId] = useState(trade?.checklistId || "none");
  const [notesDraft, setNotesDraft] = useState(() =>
    trade ? seedQuickNotes(trade, notebookEntries) : "",
  );
  const [savingNotes, setSavingNotes] = useState(false);
  const [hasScreenshot, setHasScreenshot] = useState(false);

  useEffect(() => {
    setSelectedChecklistId(trade?.checklistId || "none");
  }, [trade?.id, trade?.checklistId]);

  useEffect(() => {
    if (!trade || !open) {
      setNotesDraft("");
      return;
    }
    setNotesDraft(seedQuickNotes(trade, notebookEntries));
    // Re-seed when the opened trade changes, not on every notes mutation while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional seed on open/trade id
  }, [open, trade?.id]);

  const { data: tradeDetail } = useTradeDetail(userId, open ? trade?.id ?? null : null);

  useEffect(() => {
    if (!open || !trade) {
      setHasScreenshot(false);
      return;
    }
    setHasScreenshot(Boolean(tradeDetail?.chartImage ?? trade.chartImage));
  }, [open, trade, tradeDetail?.chartImage]);
  const net = trade ? getTradeNetResult(trade) : 0;
  const fees = (trade?.commission ?? 0) + (trade?.swap ?? 0);
  const gross = net - fees;
  const isProfit = net >= 0;
  const dateKey = trade ? getTradeLocalDateKey(trade) || trade.date : "";
  const checklistState = tradeDetail?.checklistState ?? trade?.checklistState ?? [];
  const checklist =
    selectedChecklistId !== "none"
      ? checklists.find((item) => item.id === selectedChecklistId)
      : null;
  const linkedNote = useMemo(
    () => (trade ? notebookEntries.find((entry) => entry.tradeId === trade.id && !entry.isDeleted) : null),
    [notebookEntries, trade],
  );
  const grade =
    checklistState.length > 0 ? checklistGrade(checklistPercentage(checklistState)) : null;

  const handlePlaybookChange = (value: string) => {
    if (!trade || !onUpdateTrade) return;
    const nextId = value === "none" ? undefined : value;
    setSelectedChecklistId(value);
    const nextTrade = { ...trade, checklistId: nextId };
    onTradeChange?.(nextTrade);
    void onUpdateTrade(trade.id, { checklistId: nextId });
  };

  const handleSaveNotes = async () => {
    if (!trade || !onUpdateTrade) return;
    setSavingNotes(true);
    try {
      await onUpdateTrade(trade.id, { notes: notesDraft });
      onTradeChange?.({ ...trade, notes: notesDraft });
    } finally {
      setSavingNotes(false);
    }
  };

  const showJournalLinks = notesDraft.trim().length > 0 || hasScreenshot;

  if (!trade) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex h-[min(92vh,56rem)] w-[min(98vw,88rem)] max-w-none flex-col gap-0 overflow-hidden rounded-3xl p-0 liquid-glass shadow-none",
          "[&>button]:right-5 [&>button]:top-5",
        )}
      >
        <DialogTitle className="sr-only">
          {trade.pair} {trade.direction} trade insights
        </DialogTitle>
        <DialogDescription className="sr-only">
          Detailed stats, plan adherence, psychology, and price action for this trade.
        </DialogDescription>

        <header className="shrink-0 border-b border-border/30 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <SymbolMark symbol={trade.pair} size="md" textClassName="text-xl font-semibold" />
                <Badge
                  variant="outline"
                  className={cn(
                    "px-2.5 py-0.5 text-xs font-medium uppercase",
                    trade.direction === "Long"
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-destructive/40 bg-destructive/10 text-destructive",
                  )}
                >
                  {trade.direction}
                </Badge>
                {trade.importedFromBroker ? (
                  <Badge variant="outline" className="border-blue-500/40 bg-blue-500/5 text-[10px] text-blue-400">
                    Imported
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">{formatLongDate(dateKey)}</p>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 font-mono text-2xl font-bold",
                  isProfit ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
                )}
              >
                {isProfit ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {formatPnL(net)}
              </div>
              {onEdit && !trade.importedFromBroker ? (
                <Button type="button" variant="outline" size="sm" onClick={() => onEdit(trade)}>
                  Edit
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Type", value: trade.executionType || "—" },
              { label: "Asset", value: "Forex" },
              { label: "Direction", value: trade.direction },
              { label: "R:R", value: "—" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-border/40 bg-background/40 px-3 py-2.5"
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-0.5 text-sm font-semibold capitalize text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-border/30 lg:border-b-0 lg:border-r">
            <div className="flex gap-1 border-b border-border/30 p-2">
              {(
                [
                  { id: "stats", label: "Stats" },
                  { id: "executions", label: "Executions" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInsightTab(tab.id)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    insightTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
              {insightTab === "stats" ? (
                <>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Net P&L</span>
                      <span className={cn("font-mono font-semibold", isProfit ? "text-primary" : "text-destructive")}>
                        {formatPnL(net)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Commissions & Fees</span>
                      <span className="font-mono">{fees ? formatPnL(fees) : "0"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Gross P&L</span>
                      <span className="font-mono font-medium">{formatPnL(gross)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Session</span>
                      <span className="font-medium">{trade.session || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Planned R</span>
                      <span>—</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Realized R</span>
                      <span>—</span>
                    </div>
                  </div>

                  <div className="border-t border-border/30 pt-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <BookMarked className="h-3 w-3" />
                      Playbook
                    </p>
                    <Select
                      value={selectedChecklistId}
                      onValueChange={handlePlaybookChange}
                      disabled={!onUpdateTrade}
                    >
                      <SelectTrigger className="h-9 border-border/50 bg-background/40 text-sm">
                        <SelectValue
                          placeholder={
                            checklists.length === 0 ? "No playbooks yet" : "Select playbook…"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        <SelectItem value="none">No playbook</SelectItem>
                        {checklists.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {grade && checklist ? (
                      <Badge className={cn("mt-2 border-0 text-[10px]", grade.bg, grade.color)}>
                        {grade.grade}
                      </Badge>
                    ) : null}
                    {onOpenPlaybook ? (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChange(false);
                          onOpenPlaybook();
                        }}
                        className="mt-2 text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
                      >
                        {checklists.length === 0 ? "Create a playbook" : "Open playbook page"}
                      </button>
                    ) : null}
                  </div>

                  {checklistState.length > 0 ? (
                    <div className="border-t border-border/30 pt-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Checklist
                      </p>
                      <div className="max-h-40 space-y-1.5 overflow-y-auto">
                        {checklistState.map((item, index) => (
                          <div
                            key={item.id || index}
                            className={cn(
                              "flex items-center gap-2 text-xs",
                              item.checked ? "text-muted-foreground" : "text-foreground",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
                                item.checked
                                  ? "border-primary/50 bg-primary/15"
                                  : "border-border",
                              )}
                            >
                              {item.checked ? <CheckSquare className="h-2.5 w-2.5 text-primary" /> : null}
                            </span>
                            <span className={cn(item.checked && "line-through")}>{item.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                </>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Open</span>
                    <span className="font-mono">{formatPrice(trade.openPrice)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Close</span>
                    <span className="font-mono">{formatPrice(trade.closePrice)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Open time</span>
                    <span className="text-right text-xs">
                      {trade.openTime ? new Date(trade.openTime).toLocaleString() : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Close time</span>
                    <span className="text-right text-xs">
                      {trade.closeTime ? new Date(trade.closeTime).toLocaleString() : "Still open"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Commission</span>
                    <span className="font-mono">{trade.commission?.toFixed(2) ?? "0"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Swap</span>
                    <span className="font-mono">{trade.swap?.toFixed(2) ?? "0"}</span>
                  </div>
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col p-4 sm:p-5">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/40 bg-background/35">
              <div className="min-h-0 flex-[2.2] overflow-hidden border-b border-border/30 p-3 sm:p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Trade screenshot
                </p>
                <TradeScreenshot
                  tradeId={trade.id}
                  userId={userId}
                  className="min-h-0 h-[calc(100%-1.25rem)]"
                  editable={!!onUpdateTrade}
                  onUpdate={
                    onUpdateTrade
                      ? async (chartImage) => {
                          setHasScreenshot(Boolean(chartImage));
                          await onUpdateTrade(trade.id, { chartImage });
                        }
                      : undefined
                  }
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Quick notes
                </p>
                <Textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Add notes for this trade…"
                  className="min-h-0 flex-1 resize-none bg-background/40"
                  aria-label="Quick notes"
                  disabled={!onUpdateTrade}
                />
                {linkedNote ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    A notebook page exists for this trade. Edit here or open it in the Notebook.
                  </p>
                ) : null}
                <StudyNoteMentions
                  tradeId={trade.id}
                  onOpen={(noteId) => {
                    onOpenChange(false);
                    onOpenStudyNote?.(noteId);
                  }}
                />
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  {onUpdateTrade ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={savingNotes}
                      onClick={() => void handleSaveNotes()}
                      className="gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {savingNotes ? "Saving…" : "Save notes"}
                    </Button>
                  ) : null}
                  {showJournalLinks && onSelectForNotebook ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await onSelectForNotebook(trade.id, notesDraft);
                        onOpenChange(false);
                      }}
                      className="gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Notebook
                    </Button>
                  ) : null}
                  {showJournalLinks && onOpenPsychology ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onOpenChange(false);
                        onOpenPsychology(trade.id);
                      }}
                      className="gap-1.5"
                    >
                      <Brain className="h-3.5 w-3.5" />
                      Psychology
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
