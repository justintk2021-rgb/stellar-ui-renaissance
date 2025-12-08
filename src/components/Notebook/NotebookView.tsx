import { useState, useRef, useEffect, useMemo } from "react";
import { Trade, NotebookEntry } from "@/types/trade";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Quote,
  MoreHorizontal,
  Copy,
  Download,
  Lock,
  Unlock,
  Type,
  Maximize2,
  Minimize2,
  Clock,
  Star,
  RotateCcw,
  PanelLeftOpen,
  Link,
  FolderInput,
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
  { id: "trash", label: "Trash", icon: Trash2 },
];

type FontStyle = 'default' | 'serif' | 'mono';

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
  const [fontStyle, setFontStyle] = useState<FontStyle>('default');
  const [isSmallText, setIsSmallText] = useState(false);
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isFoldersPanelOpen, setIsFoldersPanelOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Find selected entry
  const selectedEntry = notebookEntries.find((e) => e.id === selectedEntryId);

  // Calculate word count
  const wordCount = useMemo(() => {
    if (!editorRef.current) return 0;
    const text = editorRef.current.innerText || '';
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }, [selectedEntry?.content]);

  // Filter entries by category and search (excluding trash unless viewing trash)
  const filteredEntries = notebookEntries.filter((entry) => {
    // Trash filter
    if (selectedCategory === "trash") {
      return entry.isDeleted === true;
    }
    
    // For other categories, exclude deleted items
    if (entry.isDeleted) return false;
    
    const matchesCategory = selectedCategory === "all" || entry.category === selectedCategory;
    const matchesSearch = entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Count trash items
  const trashCount = notebookEntries.filter(e => e.isDeleted).length;

  // Group entries by date
  const groupedEntries = filteredEntries.reduce((acc, entry) => {
    const date = entry.isDeleted && entry.deletedAt 
      ? entry.deletedAt.slice(0, 10) 
      : entry.date;
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
    if (isLocked) return;
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
        category: selectedCategory === "all" || selectedCategory === "trash" ? "general" : selectedCategory,
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
    if (selectedCategory === "trash") {
      setSelectedCategory("general");
    }
    setIsCreatingNew(true);
    setSelectedEntryId(null);
    setIsLocked(false);
    if (titleRef.current) titleRef.current.value = "";
    if (editorRef.current) editorRef.current.innerHTML = "";
  };

  // Soft delete - move to trash
  const handleMoveToTrash = () => {
    if (selectedEntry) {
      onSaveEntry({
        ...selectedEntry,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setSelectedEntryId(null);
      toast.success("Note moved to trash!");
    }
  };

  // Restore from trash
  const handleRestoreFromTrash = () => {
    if (selectedEntry) {
      onSaveEntry({
        ...selectedEntry,
        isDeleted: false,
        deletedAt: undefined,
        updatedAt: new Date().toISOString(),
      });
      toast.success("Note restored!");
    }
  };

  // Permanent delete
  const handlePermanentDelete = () => {
    if (selectedEntry) {
      onDeleteEntry(selectedEntry.id);
      setSelectedEntryId(null);
      toast.success("Note permanently deleted!");
    }
  };

  // Empty trash
  const handleEmptyTrash = () => {
    const trashedEntries = notebookEntries.filter(e => e.isDeleted);
    trashedEntries.forEach(entry => {
      onDeleteEntry(entry.id);
    });
    setSelectedEntryId(null);
    toast.success("Trash emptied!");
  };

  const handleDuplicate = () => {
    if (!selectedEntry || !editorRef.current) return;
    
    const duplicatedEntry: NotebookEntry = {
      id: Date.now().toString(),
      title: `${selectedEntry.title} (Copy)`,
      content: editorRef.current.innerHTML,
      category: selectedEntry.category,
      date: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveEntry(duplicatedEntry);
    setSelectedEntryId(duplicatedEntry.id);
    toast.success("Note duplicated!");
  };

  const handleCopyContent = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText;
    navigator.clipboard.writeText(text);
    toast.success("Content copied to clipboard!");
  };

  const handleExport = () => {
    if (!selectedEntry || !editorRef.current) return;
    
    const text = editorRef.current.innerText;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedEntry.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Note exported!");
  };

  // Copy note link to clipboard
  const handleCopyLink = (entry: NotebookEntry) => {
    const link = `${window.location.origin}/?note=${entry.id}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard!");
  };

  // Duplicate a specific entry
  const handleDuplicateEntry = (entry: NotebookEntry) => {
    const duplicatedEntry: NotebookEntry = {
      id: Date.now().toString(),
      title: `${entry.title} (Copy)`,
      content: entry.content,
      category: entry.category,
      date: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveEntry(duplicatedEntry);
    setSelectedEntryId(duplicatedEntry.id);
    toast.success("Note duplicated!");
  };

  // Move entry to a different category
  const handleMoveToCategory = (entry: NotebookEntry, newCategory: string) => {
    onSaveEntry({
      ...entry,
      category: newCategory,
      updatedAt: new Date().toISOString(),
    });
    toast.success(`Note moved to ${CATEGORIES.find(c => c.id === newCategory)?.label || newCategory}!`);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  };

  // Find linked trade for entry
  const linkedTrade = selectedEntry?.tradeId ? trades.find((t) => t.id === selectedEntry.tradeId) : null;

  // Calculate overall trade stats
  const overallStats = {
    totalTrades: trades.length,
    wins: trades.filter(t => t.result > 0).length,
    losses: trades.filter(t => t.result < 0).length,
    netPnL: trades.reduce((sum, t) => sum + t.result, 0),
    winRate: trades.length > 0 ? (trades.filter(t => t.result > 0).length / trades.length) * 100 : 0,
  };

  // Font style classes
  const fontClasses = {
    default: 'font-sans',
    serif: 'font-serif',
    mono: 'font-mono',
  };

  const isViewingTrash = selectedCategory === "trash";
  const isSelectedEntryInTrash = selectedEntry?.isDeleted;

  return (
    <div className={cn(
      "h-[calc(100vh-220px)] lg:h-[calc(100vh-180px)] flex gap-4 transition-all duration-300",
      isFullWidth && "px-0"
    )}>
      {/* Folders Sheet */}
      <Sheet open={isFoldersPanelOpen} onOpenChange={setIsFoldersPanelOpen}>
        <SheetContent side="left" className="w-80 p-0 border-none bg-background">
          <div className="flex flex-col h-full">
            <SheetHeader className="p-4 border-b border-border/30">
              <SheetTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary" />
                Folders
              </SheetTitle>
              <SheetDescription className="sr-only">
                Navigate between note categories and folders
              </SheetDescription>
            </SheetHeader>

            {/* New Note Button */}
            <div className="p-4">
              <Button
                onClick={() => {
                  handleNewNote();
                  setIsFoldersPanelOpen(false);
                }}
                className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90 text-sm font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Note
              </Button>
            </div>

            {/* Categories */}
            <ScrollArea className="flex-1 px-2">
              <div className="space-y-1 pb-4 px-2 pr-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-2">
                  Categories
                </div>
                {CATEGORIES.filter(c => c.id !== "trash").map((cat) => {
                  const Icon = cat.icon;
                  const count = cat.id === "all" 
                    ? notebookEntries.filter(e => !e.isDeleted).length 
                    : notebookEntries.filter((e) => e.category === cat.id && !e.isDeleted).length;
                  
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSelectedEntryId(null);
                        setIsCreatingNew(false);
                        setIsFoldersPanelOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group",
                        selectedCategory === cat.id
                          ? "bg-primary/20 text-primary border border-primary/30 shadow-sm"
                          : "text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 hover:translate-x-1 hover:shadow-sm border border-transparent"
                      )}
                    >
                      <Icon className={cn(
                        "w-4 h-4 transition-transform duration-200",
                        selectedCategory !== cat.id && "group-hover:scale-110"
                      )} />
                      <span className="flex-1 text-left">{cat.label}</span>
                      <Badge variant="secondary" className={cn(
                        "text-[10px] px-1.5 py-0 transition-colors duration-200",
                        selectedCategory !== cat.id && "group-hover:bg-primary/20 group-hover:text-primary"
                      )}>
                        {count}
                      </Badge>
                    </button>
                  );
                })}

                {/* Trash - separated */}
                <div className="pt-4 mt-4 border-t border-border/30">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-2">
                    System
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCategory("trash");
                      setSelectedEntryId(null);
                      setIsCreatingNew(false);
                      setIsFoldersPanelOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group",
                      selectedCategory === "trash"
                        ? "bg-destructive/20 text-destructive border border-destructive/30 shadow-sm"
                        : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 hover:translate-x-1 hover:shadow-sm border border-transparent"
                    )}
                  >
                    <Trash2 className={cn(
                      "w-4 h-4 transition-transform duration-200",
                      trashCount > 0 && "text-destructive",
                      selectedCategory !== "trash" && "group-hover:scale-110"
                    )} />
                    <span className="flex-1 text-left">Trash</span>
                    {trashCount > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        {trashCount}
                      </Badge>
                    )}
                  </button>
                </div>
              </div>
            </ScrollArea>

            {/* Trade Stats Footer */}
            <div className="p-4 border-t border-border/30 bg-muted/20">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <TrendingUp className="w-3 h-3" />
                <span>Trading Summary</span>
              </div>
              <div className={cn(
                "p-3 rounded-lg border text-center mb-3",
                overallStats.netPnL >= 0 
                  ? "bg-primary/10 border-primary/30" 
                  : "bg-destructive/10 border-destructive/30"
              )}>
                <div className="text-[10px] uppercase text-muted-foreground">Net P&L</div>
                <div className={cn(
                  "text-xl font-bold font-mono",
                  overallStats.netPnL >= 0 ? "text-primary" : "text-destructive"
                )}>
                  {overallStats.netPnL >= 0 ? "+" : ""}${overallStats.netPnL.toFixed(2)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-background border border-border/30">
                  <div className="text-muted-foreground">Trades</div>
                  <div className="font-bold text-sm">{overallStats.totalTrades}</div>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border/30">
                  <div className="text-muted-foreground">Win Rate</div>
                  <div className={cn(
                    "font-bold text-sm",
                    overallStats.winRate >= 50 ? "text-primary" : "text-destructive"
                  )}>
                    {overallStats.winRate.toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Entries List */}
      <div className={cn(
        "w-72 flex-shrink-0 glass rounded-xl border border-border/40 overflow-hidden flex flex-col transition-all duration-300",
        isFullWidth && "hidden"
      )}>
        <div className="p-3 border-b border-border/30 space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFoldersPanelOpen(true)}
              className="h-8 w-8 p-0"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium flex-1">
              {CATEGORIES.find((c) => c.id === selectedCategory)?.label}
            </span>
            {isViewingTrash && trashCount > 0 && (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">
                    Empty
                  </Button>
                }
                title="Empty Trash"
                description="Are you sure you want to permanently delete all items in trash? This action cannot be undone."
                confirmLabel="Empty Trash"
                variant="destructive"
                onConfirm={handleEmptyTrash}
              />
            )}
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
                {isViewingTrash ? "Trash is empty" : "No notes yet. Create one!"}
              </div>
            ) : (
              sortedDates.map((date) => (
                <div key={date} className="mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 sticky top-0 bg-card/80 backdrop-blur-sm">
                    {isViewingTrash ? `Deleted ${formatDate(date)}` : formatDate(date)}
                  </div>
                  {groupedEntries[date].map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "w-full text-left p-2 rounded-lg transition-all mb-1 group relative",
                        selectedEntryId === entry.id
                          ? "bg-primary/20 border border-primary/40"
                          : "hover:bg-muted/50 border border-transparent",
                        entry.isDeleted && "opacity-70"
                      )}
                    >
                      <button
                        onClick={() => {
                          setSelectedEntryId(entry.id);
                          setIsCreatingNew(false);
                        }}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight className={cn(
                            "w-3 h-3 transition-transform flex-shrink-0",
                            selectedEntryId === entry.id && "rotate-90"
                          )} />
                          <span className="text-xs font-medium truncate flex-1">{entry.title}</span>
                          {entry.isDeleted && (
                            <Trash2 className="w-3 h-3 text-destructive flex-shrink-0" />
                          )}
                        </div>
                        {entry.tradeId && !entry.isDeleted && (() => {
                          const trade = trades.find(t => t.id === entry.tradeId);
                          return trade ? (
                            <div className="flex items-center gap-2 mt-1 ml-5">
                              <Badge variant="outline" className={cn(
                                "text-[9px]",
                                trade.result >= 0 ? "border-primary/50 text-primary" : "border-destructive/50 text-destructive"
                              )}>
                                {trade.result >= 0 ? "+" : ""}${trade.result.toFixed(0)}
                              </Badge>
                            </div>
                          ) : null;
                        })()}
                      </button>
                      
                      {/* Note Actions Dropdown */}
                      {!entry.isDeleted && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-popover border border-border shadow-lg z-50">
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyLink(entry);
                              }} 
                              className="text-xs"
                            >
                              <Link className="w-4 h-4 mr-2" />
                              Copy link
                              <span className="ml-auto text-[10px] text-muted-foreground">Ctrl+L</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateEntry(entry);
                              }} 
                              className="text-xs"
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              Duplicate
                              <span className="ml-auto text-[10px] text-muted-foreground">Ctrl+D</span>
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            
                            {/* Move to submenu */}
                            <DropdownMenu>
                              <DropdownMenuTrigger className="w-full">
                                <div className="flex items-center px-2 py-1.5 text-xs hover:bg-muted/50 rounded-sm cursor-pointer">
                                  <FolderInput className="w-4 h-4 mr-2" />
                                  Move to
                                  <ChevronRight className="w-3 h-3 ml-auto" />
                                </div>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="right" className="w-44 bg-popover border border-border shadow-lg z-50">
                                {CATEGORIES.filter(c => c.id !== "all" && c.id !== "trash" && c.id !== entry.category).map((cat) => {
                                  const Icon = cat.icon;
                                  return (
                                    <DropdownMenuItem
                                      key={cat.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveToCategory(entry, cat.id);
                                      }}
                                      className="text-xs"
                                    >
                                      <Icon className="w-4 h-4 mr-2" />
                                      {cat.label}
                                    </DropdownMenuItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            
                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                onSaveEntry({
                                  ...entry,
                                  isDeleted: true,
                                  deletedAt: new Date().toISOString(),
                                  updatedAt: new Date().toISOString(),
                                });
                                if (selectedEntryId === entry.id) {
                                  setSelectedEntryId(null);
                                }
                                toast.success("Note moved to trash!");
                              }} 
                              className="text-xs text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Move to trash
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Editor */}
      <div className="flex-1 glass rounded-xl border border-border/40 overflow-hidden flex flex-col">
        {selectedEntry || isCreatingNew ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border/30">
              {/* Trash Banner */}
              {isSelectedEntryInTrash && (
                <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <Trash2 className="w-4 h-4" />
                    <span>This note is in the trash</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRestoreFromTrash}
                      className="h-7 text-xs border-primary/50 text-primary hover:bg-primary/10"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Restore
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-destructive/50 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete Forever
                        </Button>
                      }
                      title="Delete Permanently"
                      description="Are you sure you want to permanently delete this note? This action cannot be undone."
                      confirmLabel="Delete Forever"
                      variant="destructive"
                      onConfirm={handlePermanentDelete}
                    />
                  </div>
                </div>
              )}

              {/* Trade Metrics Banner (if linked) */}
              {linkedTrade && !isSelectedEntryInTrash && (
                <div className={cn(
                  "mb-4 p-4 rounded-xl border",
                  linkedTrade.result >= 0 
                    ? "bg-primary/5 border-primary/30" 
                    : "bg-destructive/5 border-destructive/30"
                )}>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        linkedTrade.result >= 0 ? "bg-primary/20" : "bg-destructive/20"
                      )}>
                        <TrendingUp className={cn(
                          "w-6 h-6",
                          linkedTrade.result >= 0 ? "text-primary" : "text-destructive"
                        )} />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Trade Result</div>
                        <div className={cn(
                          "text-2xl font-bold font-mono",
                          linkedTrade.result >= 0 ? "text-primary" : "text-destructive"
                        )}>
                          {linkedTrade.result >= 0 ? "+" : ""}${linkedTrade.result.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-6">
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pair</div>
                        <div className="text-sm font-semibold">{linkedTrade.pair}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Direction</div>
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          linkedTrade.direction === 'Long' 
                            ? "border-primary/50 text-primary" 
                            : "border-destructive/50 text-destructive"
                        )}>
                          {linkedTrade.direction}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Session</div>
                        <div className="text-sm font-medium">{linkedTrade.session || 'N/A'}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Strategy</div>
                        <div className="text-sm font-medium">{linkedTrade.strategy || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Input
                    ref={titleRef}
                    defaultValue={selectedEntry?.title || ""}
                    placeholder="Note title..."
                    disabled={isLocked || isSelectedEntryInTrash}
                    className={cn(
                      "text-lg font-semibold bg-transparent border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 focus:outline-none placeholder:text-muted-foreground/50",
                      (isLocked || isSelectedEntryInTrash) && "cursor-not-allowed opacity-70"
                    )}
                  />
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                    <Calendar className="w-3 h-3" />
                    <span>{selectedEntry ? formatDate(selectedEntry.date) : formatDate(new Date().toISOString().slice(0, 10))}</span>
                    {selectedEntry && (
                      <>
                        <span>•</span>
                        <span>Last updated: {new Date(selectedEntry.updatedAt).toLocaleTimeString()}</span>
                      </>
                    )}
                    {linkedTrade && (
                      <>
                        <span>•</span>
                        <Badge variant="outline" className="text-[10px] border-secondary/50 bg-secondary/10">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trade Note
                        </Badge>
                      </>
                    )}
                    {isLocked && (
                      <>
                        <span>•</span>
                        <Badge variant="outline" className="text-[10px] border-yellow-500/50 bg-yellow-500/10 text-yellow-600">
                          <Lock className="w-3 h-3 mr-1" />
                          Locked
                        </Badge>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions - hidden for trash items */}
                {!isSelectedEntryInTrash && (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSave}
                      disabled={isLocked}
                      size="sm"
                      className="bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90 text-xs font-medium h-8"
                    >
                      <Save className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 glass-strong">
                      {/* Font Style Options */}
                      <div className="px-2 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Font Style</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setFontStyle('default')}
                            className={cn(
                              "flex-1 py-2 rounded-lg text-center transition-all border",
                              fontStyle === 'default' 
                                ? "bg-primary/20 border-primary/50 text-primary" 
                                : "bg-muted/30 border-transparent hover:bg-muted/50"
                            )}
                          >
                            <span className="text-lg font-sans">Ag</span>
                            <div className="text-[9px] text-muted-foreground mt-1">Default</div>
                          </button>
                          <button
                            onClick={() => setFontStyle('serif')}
                            className={cn(
                              "flex-1 py-2 rounded-lg text-center transition-all border",
                              fontStyle === 'serif' 
                                ? "bg-primary/20 border-primary/50 text-primary" 
                                : "bg-muted/30 border-transparent hover:bg-muted/50"
                            )}
                          >
                            <span className="text-lg font-serif">Ag</span>
                            <div className="text-[9px] text-muted-foreground mt-1">Serif</div>
                          </button>
                          <button
                            onClick={() => setFontStyle('mono')}
                            className={cn(
                              "flex-1 py-2 rounded-lg text-center transition-all border",
                              fontStyle === 'mono' 
                                ? "bg-primary/20 border-primary/50 text-primary" 
                                : "bg-muted/30 border-transparent hover:bg-muted/50"
                            )}
                          >
                            <span className="text-lg font-mono">Ag</span>
                            <div className="text-[9px] text-muted-foreground mt-1">Mono</div>
                          </button>
                        </div>
                      </div>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem onClick={handleCopyContent} className="text-xs">
                        <Copy className="w-4 h-4 mr-2" />
                        Copy content
                      </DropdownMenuItem>
                      
                      {selectedEntry && (
                        <DropdownMenuItem onClick={handleDuplicate} className="text-xs">
                          <FileText className="w-4 h-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator />

                      {/* Toggle Options */}
                      <div className="px-2 py-2 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs">
                            <Type className="w-4 h-4" />
                            Small text
                          </div>
                          <Switch 
                            checked={isSmallText} 
                            onCheckedChange={setIsSmallText}
                            className="scale-75"
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs">
                            {isFullWidth ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            Full width
                          </div>
                          <Switch 
                            checked={isFullWidth} 
                            onCheckedChange={setIsFullWidth}
                            className="scale-75"
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs">
                            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            Lock page
                          </div>
                          <Switch 
                            checked={isLocked} 
                            onCheckedChange={setIsLocked}
                            className="scale-75"
                          />
                        </div>
                      </div>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem onClick={handleExport} className="text-xs">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </DropdownMenuItem>

                      {selectedEntry && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={handleMoveToTrash} 
                            className="text-xs text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Move to Trash
                          </DropdownMenuItem>
                        </>
                      )}

                      {/* Footer Info */}
                      <DropdownMenuSeparator />
                      <div className="px-2 py-2 text-[10px] text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <Type className="w-3 h-3" />
                          Word count: {wordCount} words
                        </div>
                        {selectedEntry && (
                          <>
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              Last edited: {formatDateTime(selectedEntry.updatedAt)}
                            </div>
                            <div className="flex items-center gap-2">
                              <Star className="w-3 h-3" />
                              Created: {formatDateTime(selectedEntry.createdAt)}
                            </div>
                          </>
                        )}
                      </div>
                    </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </div>


            {/* Editor */}
            <ScrollArea className="flex-1">
              <div
                ref={editorRef}
                contentEditable={!isLocked && !isSelectedEntryInTrash}
                className={cn(
                  "min-h-full p-4 outline-none focus:outline-none focus-visible:outline-none transition-all caret-primary",
                  fontClasses[fontStyle],
                  isSmallText ? "text-xs" : "text-sm",
                  (isLocked || isSelectedEntryInTrash) && "cursor-not-allowed opacity-70",
                  "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2",
                  "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2",
                  "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1",
                  "[&_p]:mb-2",
                  "[&_ul]:list-disc [&_ul]:ml-5 [&_ul]:mb-2",
                  "[&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:mb-2",
                  "[&_li]:text-foreground [&_li]:mb-1",
                  "[&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-2",
                  "[&_strong]:font-semibold",
                  "[&_em]:italic"
                )}
                data-placeholder="Start writing your notes..."
              />
            </ScrollArea>

            {/* Floating Add Note Button */}
            {!isViewingTrash && (
              <Button
                onClick={handleNewNote}
                className="absolute bottom-6 left-6 w-12 h-12 rounded-full bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-300 group"
              >
                <Plus className="w-5 h-5 transition-transform duration-300 group-hover:rotate-90" />
              </Button>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <BookOpen className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">{isViewingTrash ? "Select a note to view" : "Select a note or create a new one"}</p>
            {!isViewingTrash && (
              <Button
                onClick={handleNewNote}
                variant="outline"
                className="mt-4 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Create Note
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}