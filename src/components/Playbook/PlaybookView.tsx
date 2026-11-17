import { useState, useEffect } from "react";
import { motion } from "@/lib/motion";
import { PlaybookDetailView } from "./PlaybookDetailView";
import { PlaybookRulesEditor, type ChecklistMetrics } from "./PlaybookRulesEditor";
import { Plus, Trash2, Edit2, ClipboardList, Loader2, GitBranch, ListChecks, MoreHorizontal, LayoutGrid, List, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChecklists, ChecklistType } from "@/hooks/useChecklists";
import { supabase } from "@/integrations/supabase/client";
import { journalTradeStats } from "@/lib/tradeFormat";
import { filterLivePlaybookTrades } from "./PlaybookBacktesting";

const PLAYBOOK_TRADE_SELECT =
  "id, date, pair, direction, result, checklist_id, account_id, broker_account_id, session, swap, commission, imported_from_broker, broker_position_id, last_broker_sync_at";

function mapPlaybookTrade(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    date: String(row.date ?? ""),
    pair: String(row.pair ?? ""),
    direction: (row.direction as "Long" | "Short") || "Long",
    result: Number(row.result) || 0,
    checklist_id: (row.checklist_id as string | null) ?? undefined,
    accountId: (row.account_id as string | null) ?? undefined,
    brokerAccountId: (row.broker_account_id as string | null) ?? undefined,
    session: (row.session as string | null) ?? undefined,
    swap: row.swap != null ? Number(row.swap) : 0,
    commission: row.commission != null ? Number(row.commission) : 0,
    importedFromBroker: Boolean(row.imported_from_broker),
    brokerPositionId: (row.broker_position_id as string | null) ?? null,
    lastBrokerSyncAt: (row.last_broker_sync_at as string | null) ?? null,
  };
}

/** Only keep trades linked to accounts that still exist on the site. */
function tradeBelongsToActiveAccount(
  trade: ReturnType<typeof mapPlaybookTrade>,
  manualIds: Set<string>,
  brokerExternalIds: Set<string>,
) {
  if (trade.brokerAccountId) return brokerExternalIds.has(trade.brokerAccountId);
  if (trade.accountId) return manualIds.has(trade.accountId);
  return false;
}

async function fetchActiveAccountIdSets(userId: string) {
  const [{ data: manuals }, { data: connections }] = await Promise.all([
    supabase.from("trading_accounts").select("id").eq("user_id", userId),
    supabase
      .from("broker_connections")
      .select("id, connection_status")
      .eq("user_id", userId)
      .neq("connection_status", "disconnected"),
  ]);

  const manualIds = new Set((manuals || []).map((row) => String(row.id)));
  const brokerExternalIds = new Set<string>();

  const visibleConnections = (connections || []).filter(
    (conn) =>
      conn.connection_status === "connected" ||
      conn.connection_status === "expired" ||
      conn.connection_status === "connecting" ||
      conn.connection_status === "pending",
  );

  for (const conn of visibleConnections) {
    const { data: accounts } = await supabase
      .from("broker_accounts")
      .select("account_id_external")
      .eq("broker_connection_id", conn.id);
    for (const account of accounts || []) {
      if (account.account_id_external) {
        brokerExternalIds.add(String(account.account_id_external));
      }
    }
  }

  return { manualIds, brokerExternalIds };
}
export function PlaybookView() {
  const { checklists, loading, isAuthenticated, createChecklist, updateChecklist, deleteChecklist } = useChecklists();
  const [newChecklistName, setNewChecklistName] = useState("");
  const [newChecklistType, setNewChecklistType] = useState<ChecklistType | null>(null);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [isTypeSelectOpen, setIsTypeSelectOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [checklistMetrics, setChecklistMetrics] = useState<ChecklistMetrics[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  // Landing page state
  const [activeTab, setActiveTab] = useState<"my" | "shared">("my");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // Detail view state
  const [showDetailView, setShowDetailView] = useState(false);
  const [allTrades, setAllTrades] = useState<any[]>([]);

  const selectedChecklist = checklists.find(c => c.id === selectedChecklistId) || null;
  const selectedMetrics = checklistMetrics.find(m => m.checklistId === selectedChecklistId);

  const fetchTradesAndMetrics = async () => {
    if (!isAuthenticated) return;

    setMetricsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAllTrades([]);
        setChecklistMetrics([]);
        return;
      }

      const [{ data, error }, accountSets] = await Promise.all([
        supabase.from("trades").select(PLAYBOOK_TRADE_SELECT).not("checklist_id", "is", null),
        fetchActiveAccountIdSets(user.id),
      ]);
      if (error) throw error;

      const activeTrades = (data || [])
        .map((row) => mapPlaybookTrade(row as Record<string, unknown>))
        .filter((trade) =>
          tradeBelongsToActiveAccount(trade, accountSets.manualIds, accountSets.brokerExternalIds),
        );

      setAllTrades(activeTrades);

      const byChecklist = new Map<string, ReturnType<typeof mapPlaybookTrade>[]>();
      for (const trade of filterLivePlaybookTrades(activeTrades)) {
        if (!trade.checklist_id) continue;
        const existing = byChecklist.get(trade.checklist_id) || [];
        existing.push(trade);
        byChecklist.set(trade.checklist_id, existing);
      }

      setChecklistMetrics(
        checklists.map((checklist) => {
          const stats = journalTradeStats(byChecklist.get(checklist.id) || []);
          return {
            checklistId: checklist.id,
            checklistName: checklist.name,
            totalTrades: stats.total,
            winningTrades: stats.wins,
            losingTrades: stats.losses,
            totalPnL: stats.netPnL,
            winRate: stats.winRate,
          };
        }),
      );
    } catch (error) {
      console.error("Error fetching checklist trades/metrics:", error);
    } finally {
      setMetricsLoading(false);
    }
  };

  // Fetch playbook trades + metrics, excluding trades from deleted/disconnected accounts.
  useEffect(() => {
    void fetchTradesAndMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when auth/checklists change
  }, [isAuthenticated, checklists]);

  const handleCreateChecklist = async () => {
    if (!newChecklistName.trim() || !newChecklistType) return;
    const newChecklist = await createChecklist(newChecklistName, newChecklistType);
    setNewChecklistName("");
    setNewChecklistType(null);
    setIsCreateDialogOpen(false);
    if (!newChecklist) return;
    setShowDetailView(false);
    setSelectedChecklistId(newChecklist.id);
  };

  const openTypeSelect = () => {
    setIsTypeSelectOpen(true);
  };

  const selectType = (type: ChecklistType) => {
    setNewChecklistType(type);
    setIsTypeSelectOpen(false);
    setIsCreateDialogOpen(true);
  };

  const handleDeleteChecklist = async (id: string) => {
    await deleteChecklist(id);
    if (selectedChecklistId === id) {
      setSelectedChecklistId(checklists.length > 1 ? checklists.find(c => c.id !== id)?.id || null : null);
    }
  };


  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Trading Playbook</h2>
            <p className="text-xs text-muted-foreground">Create and manage your trading checklists</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Trading Playbook</h2>
            <p className="text-xs text-muted-foreground">Create and manage your trading checklists</p>
          </div>
        </div>
        <div className="glass rounded-xl p-12 text-center">
          <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sign In Required</h3>
          <p className="text-sm text-muted-foreground">
            Please sign in to access your trading checklists
          </p>
        </div>
      </div>
    );
  }

  // Landing page - show grid of playbooks when no checklist is selected
  if (!selectedChecklistId) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header with Tabs and Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("my")}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
                activeTab === "my" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              My Playbook
            </button>
            <button
              onClick={() => setActiveTab("shared")}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
                activeTab === "shared" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Shared Playbook
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              onClick={openTypeSelect}
              className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary transition-all duration-300 hover:scale-105 hover:shadow-glow-sm active:scale-95"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              <Plus className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-90" />
              Create Playbook
            </Button>

            <div className="flex items-center bg-muted/30 rounded-lg p-1">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-2 rounded-md transition-all duration-200",
                  viewMode === "list" 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-2 rounded-md transition-all duration-200",
                  viewMode === "grid" 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Type Selection Dialog */}
        <Dialog open={isTypeSelectOpen} onOpenChange={setIsTypeSelectOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Choose Checklist Type</DialogTitle>
              <DialogDescription>
                Select the type of checklist you want to create
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 grid grid-cols-2 gap-4">
              <motion.button
                onClick={() => selectType("fixed")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative p-6 rounded-xl border-2 border-border/50 hover:border-primary/50 bg-muted/30 hover:bg-muted/50 transition-all duration-300 text-left"
              >
                <div className="absolute top-3 right-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                    <ListChecks className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="pr-10">
                  <h3 className="font-semibold text-base mb-2">Fixed Checklist</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Standard checklist with items you check off one by one.
                  </p>
                </div>
              </motion.button>

              <motion.button
                onClick={() => selectType("conditional")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative p-6 rounded-xl border-2 border-border/50 hover:border-primary/50 bg-muted/30 hover:bg-muted/50 transition-all duration-300 text-left"
              >
                <div className="absolute top-3 right-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 flex items-center justify-center transition-colors">
                    <GitBranch className="w-4 h-4 text-amber-500" />
                  </div>
                </div>
                <div className="pr-10">
                  <h3 className="font-semibold text-base mb-2">Conditional Checklist</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Branching checklist with nested sub-conditions.
                  </p>
                </div>
              </motion.button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Checklist Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) setNewChecklistType(null);
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {newChecklistType === "conditional" ? (
                  <GitBranch className="w-5 h-5 text-amber-500" />
                ) : (
                  <ListChecks className="w-5 h-5 text-primary" />
                )}
                Create {newChecklistType === "conditional" ? "Conditional" : "Fixed"} Checklist
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Checklist name..."
                value={newChecklistName}
                onChange={(e) => setNewChecklistName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateChecklist()}
                className="bg-background/50"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateChecklist} disabled={!newChecklistName.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Playbook Grid/List */}
        {checklists.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Playbooks Yet</h3>
            <p className="text-sm text-muted-foreground">Create your first trading playbook to get started</p>
          </div>
        ) : (
          <motion.div 
            className={cn(
              "gap-4",
              viewMode === "grid" 
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
                : "flex flex-col"
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {checklists.map((checklist, index) => {
              const metrics = checklistMetrics.find(m => m.checklistId === checklist.id);
              
              return (
                <motion.div
                  key={checklist.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  onClick={() => { setSelectedChecklistId(checklist.id); setShowDetailView(true); }}
                  className={cn(
                    "group relative bg-card hover:bg-muted/30 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
                    viewMode === "list" && "flex items-center justify-between"
                  )}
                >
                  <div className={cn("flex items-center gap-3", viewMode === "grid" && "w-full")}>
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      checklist.type === "conditional" ? "bg-amber-500/10" : "bg-primary/10"
                    )}>
                      {checklist.type === "conditional" ? (
                        <GitBranch className="w-4 h-4 text-amber-500" />
                      ) : (
                        <ListChecks className="w-4 h-4 text-primary" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{checklist.name}</h3>
                      {viewMode === "grid" && metrics && metrics.totalTrades > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {metrics.totalTrades} trades • {metrics.winRate.toFixed(0)}% WR
                        </p>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted/50 transition-all duration-200">
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[140px]">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedChecklistId(checklist.id); setShowDetailView(false); }}>
                          <Edit2 className="w-3.5 h-3.5 mr-2" />Edit Rules
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(checklist.id); }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {viewMode === "list" && metrics && metrics.totalTrades > 0 && (
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">{metrics.totalTrades} trades</span>
                      <span className={cn("font-medium", metrics.winRate >= 50 ? "text-primary" : "text-destructive")}>
                        {metrics.winRate.toFixed(0)}% WR
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}

        <ConfirmDialog
          open={!!deleteConfirmId}
          onOpenChange={(open) => !open && setDeleteConfirmId(null)}
          title="Delete Playbook"
          description="Are you sure you want to delete this playbook? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => { if (deleteConfirmId) { deleteChecklist(deleteConfirmId); setDeleteConfirmId(null); } }}
        />
      </div>
    );
  }

  // Newly created playbooks are selected before the list refetch lands.
  // The editor below assumes selectedChecklist is defined.
  if (!selectedChecklist) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Detail view - show analytics and overview
  if (showDetailView) {
    return (
      <PlaybookDetailView
        checklist={selectedChecklist}
        metrics={selectedMetrics}
        trades={allTrades}
        onBack={() => { setSelectedChecklistId(null); setShowDetailView(false); }}
        onUpdateNotes={(notes) => {
          updateChecklist(selectedChecklist.id, { notes });
        }}
        onUpdateChecklist={updateChecklist}
        onDeleteChecklist={handleDeleteChecklist}
        onTradesChanged={() => {
          void fetchTradesAndMetrics();
        }}
      />
    );
  }

  // Rules editor view when a checklist is selected
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setShowDetailView(true)} className="hover:bg-muted/50">
          <ArrowLeft className="w-4 h-4 mr-2" />Back
        </Button>
        <Button 
          onClick={openTypeSelect}
          className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary transition-all duration-300 hover:scale-105 hover:shadow-glow-sm active:scale-95"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
          <Plus className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-90" />New Checklist
        </Button>
      </div>

      {/* Type Selection Dialog */}
      <Dialog open={isTypeSelectOpen} onOpenChange={setIsTypeSelectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose Checklist Type</DialogTitle>
            <DialogDescription>Select the type of checklist you want to create</DialogDescription>
          </DialogHeader>
          <div className="py-6 grid grid-cols-2 gap-4">
            <motion.button onClick={() => selectType("fixed")} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="group relative p-6 rounded-xl border-2 border-border/50 hover:border-primary/50 bg-muted/30 hover:bg-muted/50 transition-all duration-300 text-left">
              <div className="absolute top-3 right-3"><div className="w-8 h-8 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors"><ListChecks className="w-4 h-4 text-primary" /></div></div>
              <div className="pr-10"><h3 className="font-semibold text-base mb-2">Fixed Checklist</h3><p className="text-xs text-muted-foreground leading-relaxed">Standard checklist with linear items.</p></div>
            </motion.button>
            <motion.button onClick={() => selectType("conditional")} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="group relative p-6 rounded-xl border-2 border-border/50 hover:border-primary/50 bg-muted/30 hover:bg-muted/50 transition-all duration-300 text-left">
              <div className="absolute top-3 right-3"><div className="w-8 h-8 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 flex items-center justify-center transition-colors"><GitBranch className="w-4 h-4 text-amber-500" /></div></div>
              <div className="pr-10"><h3 className="font-semibold text-base mb-2">Conditional Checklist</h3><p className="text-xs text-muted-foreground leading-relaxed">Branching checklist with sub-conditions.</p></div>
            </motion.button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Checklist Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) setNewChecklistType(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {newChecklistType === "conditional" ? <GitBranch className="w-5 h-5 text-amber-500" /> : <ListChecks className="w-5 h-5 text-primary" />}
              Create {newChecklistType === "conditional" ? "Conditional" : "Fixed"} Checklist
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input placeholder="Checklist name..." value={newChecklistName} onChange={(e) => setNewChecklistName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateChecklist()} className="bg-background/50" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateChecklist} disabled={!newChecklistName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlaybookRulesEditor
        checklist={selectedChecklist}
        metrics={selectedMetrics}
        onUpdateChecklist={updateChecklist}
        onDeleteChecklist={handleDeleteChecklist}
      />
    </div>
  );
}
