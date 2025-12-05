import { useState, useRef, useEffect } from "react";
import { Trade, NotebookEntry } from "@/types/trade";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bold,
  Italic,
  List,
  Heading1,
  Save,
  Plus,
  FolderOpen,
  FileText,
  BookOpen,
  Target,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Calendar,
  Search,
  Trash2,
  ChevronRight,
  ListOrdered,
  Link,
  Quote,
} from "lucide-react";
import { toast } from "sonner";

interface NotebookViewProps {
  trades: Trade[];
  selectedTradeId: string | null;
  onSelectTrade: (id: string) => void;
  onSaveNotes: (id: string, notes: string) => void;
  notebookEntries: NotebookEntry[];
  onSaveEntry: (entry: NotebookEntry) => void;
  onDeleteEntry: (id: string) => void;
}

const CATEGORIES = [
  { id: "all", label: "All Notes", icon: FileText },
  { id: "trade-notes", label: "Trade Notes", icon: TrendingUp },
  { id: "daily-journal", label: "Daily Journal", icon: Calendar },
  { id: "trading-plan", label: "Trading Plan", icon: Target },
  { id: "goals", label: "Goals", icon: Lightbulb },
  { id: "mistakes", label: "Mistakes & Lessons", icon: AlertTriangle },
  { id: "general", label: "General Notes", icon: BookOpen },
];

export function NotebookView({
  trades,
  selectedTradeId,
  onSelectTrade,
  onSaveNotes,
  notebookEntries,
  onSaveEntry,
  onDeleteEntry,
}: NotebookViewProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Find selected entry
  const selectedEntry = notebookEntries.find((e) => e.id === selectedEntryId);

  // Filter entries by category and search
  const filteredEntries = notebookEntries.filter((entry) => {
    const matchesCategory = selectedCategory === "all" || entry.category === selectedCategory;
    const matchesSearch = entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group entries by date
  const groupedEntries = filteredEntries.reduce((acc, entry) => {
    const date = entry.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, NotebookEntry[]>);

  const sortedDates = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));

  // Load entry content into editor
  useEffect(() => {
    if (editorRef.current && selectedEntry) {
      editorRef.current.innerHTML = selectedEntry.content || "";
    } else if (editorRef.current && isCreatingNew) {
      editorRef.current.innerHTML = "";
    }
  }, [selectedEntry, isCreatingNew]);

  const execCommand = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const handleSave = () => {
    if (!editorRef.current) return;
    
    const content = editorRef.current.innerHTML;
    const title = titleRef.current?.value || "Untitled Note";
    
    if (isCreatingNew) {
      const newEntry: NotebookEntry = {
        id: Date.now().toString(),
        title,
        content,
        category: selectedCategory === "all" ? "general" : selectedCategory,
        date: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onSaveEntry(newEntry);
      setSelectedEntryId(newEntry.id);
      setIsCreatingNew(false);
      toast.success("Note created!");
    } else if (selectedEntry) {
      onSaveEntry({
        ...selectedEntry,
        title,
        content,
        updatedAt: new Date().toISOString(),
      });
      toast.success("Note saved!");
    }
  };

  const handleNewNote = () => {
    setIsCreatingNew(true);
    setSelectedEntryId(null);
    if (titleRef.current) titleRef.current.value = "";
    if (editorRef.current) editorRef.current.innerHTML = "";
  };

  const handleDeleteEntry = () => {
    if (selectedEntry && window.confirm("Delete this note?")) {
      onDeleteEntry(selectedEntry.id);
      setSelectedEntryId(null);
      toast.success("Note deleted!");
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

  // Find linked trade for entry
  const linkedTrade = selectedEntry?.tradeId ? trades.find((t) => t.id === selectedEntry.tradeId) : null;

  // Calculate stats for linked trade
  const tradeStats = linkedTrade ? {
    pnl: linkedTrade.result,
    wins: linkedTrade.result > 0 ? 1 : 0,
    losses: linkedTrade.result < 0 ? 1 : 0,
  } : null;

  // Calculate overall trade stats
  const overallStats = {
    totalTrades: trades.length,
    wins: trades.filter(t => t.result > 0).length,
    losses: trades.filter(t => t.result < 0).length,
    netPnL: trades.reduce((sum, t) => sum + t.result, 0),
    winRate: trades.length > 0 ? (trades.filter(t => t.result > 0).length / trades.length) * 100 : 0,
  };

  return (
    <div className="h-[calc(100vh-220px)] lg:h-[calc(100vh-180px)] flex gap-4">
      {/* Left Sidebar - Categories & Trade Stats */}
      <div className="w-52 flex-shrink-0 flex flex-col gap-4">
        {/* Categories */}
        <div className="glass rounded-xl border border-border/40 overflow-hidden flex flex-col flex-1">
          <div className="p-3 border-b border-border/30">
            <Button
              onClick={handleNewNote}
              className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90 text-xs font-medium"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Note
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
                Folders
              </div>
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const count = cat.id === "all" 
                  ? notebookEntries.length 
                  : notebookEntries.filter((e) => e.category === cat.id).length;
                
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all",
                      selectedCategory === cat.id
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left truncate">{cat.label}</span>
                    <span className="text-[10px] opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Trade Stats Summary */}
        <div className="glass rounded-xl border border-border/40 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">Trade Summary</span>
          </div>
          
          <div className={cn(
            "p-3 rounded-lg border text-center",
            overallStats.netPnL >= 0 
              ? "bg-primary/10 border-primary/30" 
              : "bg-destructive/10 border-destructive/30"
          )}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Net P&L</div>
            <div className={cn(
              "text-xl font-bold font-mono",
              overallStats.netPnL >= 0 ? "text-primary" : "text-destructive"
            )}>
              {overallStats.netPnL >= 0 ? "+" : ""}${overallStats.netPnL.toFixed(2)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <div className="text-[10px] text-muted-foreground">Total</div>
              <div className="text-sm font-bold">{overallStats.totalTrades}</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <div className="text-[10px] text-muted-foreground">Win Rate</div>
              <div className={cn(
                "text-sm font-bold",
                overallStats.winRate >= 50 ? "text-primary" : "text-destructive"
              )}>
                {overallStats.winRate.toFixed(1)}%
              </div>
            </div>
            <div className="p-2 rounded-lg bg-primary/10 text-center">
              <div className="text-[10px] text-muted-foreground">Winners</div>
              <div className="text-sm font-bold text-primary">{overallStats.wins}</div>
            </div>
            <div className="p-2 rounded-lg bg-destructive/10 text-center">
              <div className="text-[10px] text-muted-foreground">Losers</div>
              <div className="text-sm font-bold text-destructive">{overallStats.losses}</div>
            </div>
          </div>

          {/* Recent Trades */}
          {trades.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent Trades</div>
              <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                {trades.slice(0, 5).map((trade) => (
                  <div 
                    key={trade.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/20 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[9px] px-1.5 py-0",
                          trade.direction === 'Long' 
                            ? "border-primary/50 text-primary" 
                            : "border-destructive/50 text-destructive"
                        )}
                      >
                        {trade.direction.charAt(0)}
                      </Badge>
                      <span className="font-medium">{trade.pair}</span>
                    </div>
                    <span className={cn(
                      "font-bold font-mono",
                      trade.result >= 0 ? "text-primary" : "text-destructive"
                    )}>
                      {trade.result >= 0 ? "+" : ""}{trade.result.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Middle - Entries List */}
      <div className="w-64 flex-shrink-0 glass rounded-xl border border-border/40 overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border/30 space-y-2">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium">
              {CATEGORIES.find((c) => c.id === selectedCategory)?.label}
            </span>
          </div>
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 text-xs pl-7 bg-muted/30 border-border/50"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {sortedDates.length === 0 && !isCreatingNew ? (
              <div className="text-center text-xs text-muted-foreground py-8">
                No notes yet. Create one!
              </div>
            ) : (
              sortedDates.map((date) => (
                <div key={date} className="mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 sticky top-0 bg-card/80 backdrop-blur-sm">
                    {formatDate(date)}
                  </div>
                  {groupedEntries[date].map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => {
                        setSelectedEntryId(entry.id);
                        setIsCreatingNew(false);
                      }}
                      className={cn(
                        "w-full text-left p-2 rounded-lg transition-all mb-1",
                        selectedEntryId === entry.id
                          ? "bg-primary/20 border border-primary/40"
                          : "hover:bg-muted/50 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <ChevronRight className={cn(
                          "w-3 h-3 transition-transform",
                          selectedEntryId === entry.id && "rotate-90"
                        )} />
                        <span className="text-xs font-medium truncate flex-1">{entry.title}</span>
                      </div>
                      {entry.tradeId && (
                        <Badge variant="outline" className="mt-1 text-[9px] border-secondary/50">
                          Trade linked
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right - Editor */}
      <div className="flex-1 glass rounded-xl border border-border/40 overflow-hidden flex flex-col">
        {selectedEntry || isCreatingNew ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border/30 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Input
                    ref={titleRef}
                    defaultValue={selectedEntry?.title || ""}
                    placeholder="Note title..."
                    className="text-lg font-semibold bg-transparent border-none p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/50"
                  />
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>{selectedEntry ? formatDate(selectedEntry.date) : formatDate(new Date().toISOString().slice(0, 10))}</span>
                    {selectedEntry && (
                      <>
                        <span>•</span>
                        <span>Last updated: {new Date(selectedEntry.updatedAt).toLocaleTimeString()}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Trade Stats (if linked) */}
                {tradeStats && linkedTrade && (
                  <div className={cn(
                    "px-4 py-2 rounded-lg border text-right",
                    tradeStats.pnl >= 0 
                      ? "bg-primary/10 border-primary/30" 
                      : "bg-destructive/10 border-destructive/30"
                  )}>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Net P&L</div>
                    <div className={cn(
                      "text-xl font-bold font-mono",
                      tradeStats.pnl >= 0 ? "text-primary" : "text-destructive"
                    )}>
                      {tradeStats.pnl >= 0 ? "+" : ""}${tradeStats.pnl.toFixed(2)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px]">
                      <span>{linkedTrade.pair}</span>
                      <span>•</span>
                      <span>{linkedTrade.direction}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Toolbar */}
            <div className="px-4 py-2 border-b border-border/30 flex items-center gap-1 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => execCommand("bold")} className="w-7 h-7 p-0">
                <Bold className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => execCommand("italic")} className="w-7 h-7 p-0">
                <Italic className="w-3 h-3" />
              </Button>
              <div className="w-px h-5 bg-border/50 mx-1" />
              <Button variant="outline" size="sm" onClick={() => execCommand("formatBlock", "h2")} className="w-7 h-7 p-0">
                <Heading1 className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => execCommand("insertUnorderedList")} className="w-7 h-7 p-0">
                <List className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => execCommand("insertOrderedList")} className="w-7 h-7 p-0">
                <ListOrdered className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => execCommand("formatBlock", "blockquote")} className="w-7 h-7 p-0">
                <Quote className="w-3 h-3" />
              </Button>
              
              <div className="flex-1" />
              
              {selectedEntry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteEntry}
                  className="text-xs text-destructive hover:bg-destructive/10 hover:border-destructive/50"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              )}
              <Button
                onClick={handleSave}
                className="bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90 text-xs font-medium"
              >
                <Save className="w-3 h-3 mr-1" />
                Save
              </Button>
            </div>

            {/* Editor */}
            <ScrollArea className="flex-1">
              <div
                ref={editorRef}
                contentEditable
                className="min-h-full p-4 text-sm focus:outline-none
                  [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                  [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2
                  [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
                  [&_p]:mb-2
                  [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:mb-2
                  [&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:mb-2
                  [&_li]:text-foreground [&_li]:mb-1
                  [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-2
                  [&_strong]:font-semibold
                  [&_em]:italic"
                data-placeholder="Start writing your notes..."
              />
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <BookOpen className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">Select a note or create a new one</p>
            <Button
              onClick={handleNewNote}
              variant="outline"
              className="mt-4 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Create Note
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
