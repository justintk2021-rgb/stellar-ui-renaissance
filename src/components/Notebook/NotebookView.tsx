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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Heading2,
  Heading3,
  Save,
  Plus,
  FolderPlus,
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
  CheckSquare,
  ListCollapse,
  ChevronDown,
  MessageSquare,
  Table,
  Minus,
  ExternalLink,
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

const MARKER_COLORS = [
  { id: 'none', label: 'None', color: 'transparent' },
  { id: 'red', label: 'Red', color: 'hsl(0, 84%, 60%)' },
  { id: 'orange', label: 'Orange', color: 'hsl(25, 95%, 53%)' },
  { id: 'yellow', label: 'Yellow', color: 'hsl(48, 96%, 53%)' },
  { id: 'green', label: 'Green', color: 'hsl(142, 71%, 45%)' },
  { id: 'blue', label: 'Blue', color: 'hsl(217, 91%, 60%)' },
  { id: 'purple', label: 'Purple', color: 'hsl(262, 83%, 58%)' },
  { id: 'pink', label: 'Pink', color: 'hsl(330, 81%, 60%)' },
  { id: 'cyan', label: 'Cyan', color: 'hsl(186, 94%, 41%)' },
];

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
  const [isAddFolderDialogOpen, setIsAddFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [customFolders, setCustomFolders] = useState<Array<{ id: string; label: string; color?: string }>>(() => {
    const saved = localStorage.getItem('notebook-custom-folders');
    return saved ? JSON.parse(saved) : [];
  });
  const [folderMarkers, setFolderMarkers] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('notebook-folder-markers');
    return saved ? JSON.parse(saved) : {};
  });
  const [isBlockMenuOpen, setIsBlockMenuOpen] = useState(false);
  const [blockMenuPosition, setBlockMenuPosition] = useState({ x: 0, y: 0 });
  const [showBlockButton, setShowBlockButton] = useState(false);
  const [blockButtonPosition, setBlockButtonPosition] = useState({ x: 0, y: 0 });
  const [showTableControls, setShowTableControls] = useState(false);
  const [selectedTable, setSelectedTable] = useState<HTMLTableElement | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

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

  // Update folder marker color
  const handleSetFolderMarker = (folderId: string, colorId: string) => {
    const newMarkers = { ...folderMarkers };
    if (colorId === 'none') {
      delete newMarkers[folderId];
    } else {
      newMarkers[folderId] = colorId;
    }
    setFolderMarkers(newMarkers);
    localStorage.setItem('notebook-folder-markers', JSON.stringify(newMarkers));
  };

  // Get marker color for a folder
  const getFolderMarkerColor = (folderId: string) => {
    const markerId = folderMarkers[folderId];
    if (!markerId) return null;
    return MARKER_COLORS.find(m => m.id === markerId)?.color || null;
  };

  // Block formatting options
  const BLOCK_OPTIONS = [
    { id: 'text', label: 'Text', icon: Type, command: 'formatBlock', value: 'p' },
    { id: 'h1', label: 'Heading 1', icon: Heading1, command: 'formatBlock', value: 'h1' },
    { id: 'h2', label: 'Heading 2', icon: Heading2, command: 'formatBlock', value: 'h2' },
    { id: 'h3', label: 'Heading 3', icon: Heading3, command: 'formatBlock', value: 'h3' },
    { id: 'bullet', label: 'Bulleted list', icon: List, command: 'insertUnorderedList', value: '' },
    { id: 'numbered', label: 'Numbered list', icon: ListOrdered, command: 'insertOrderedList', value: '' },
    { id: 'todo', label: 'To-do list', icon: CheckSquare, command: 'custom', value: '' },
    { id: 'toggle', label: 'Toggle list', icon: ChevronDown, command: 'formatBlock', value: 'details' },
    { id: 'quote', label: 'Quote', icon: Quote, command: 'formatBlock', value: 'blockquote' },
    { id: 'callout', label: 'Callout', icon: MessageSquare, command: 'formatBlock', value: 'aside' },
    { id: 'divider', label: 'Divider', icon: Minus, command: 'insertHorizontalRule', value: '' },
    { id: 'table', label: 'Table', icon: Table, command: 'insertTable', value: '' },
    { id: 'link', label: 'Link to page', icon: ExternalLink, command: 'createLink', value: '' },
  ];

  const handleBlockFormat = (option: typeof BLOCK_OPTIONS[0]) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    
    if (option.id === 'divider') {
      document.execCommand('insertHTML', false, '<hr class="my-4 border-border" />');
    } else if (option.id === 'table') {
      const tableHTML = `
        <div class="notebook-table-wrapper my-4 relative group" contenteditable="false">
          <table class="notebook-table w-full border-separate border-spacing-0 rounded-xl overflow-hidden bg-muted/30">
            <tbody>
              <tr>
                <td class="p-3 border border-border/50 first:rounded-tl-xl" contenteditable="true">Cell 1</td>
                <td class="p-3 border border-border/50 last:rounded-tr-xl" contenteditable="true">Cell 2</td>
              </tr>
              <tr>
                <td class="p-3 border border-border/50 first:rounded-bl-xl" contenteditable="true">Cell 3</td>
                <td class="p-3 border border-border/50 last:rounded-br-xl" contenteditable="true">Cell 4</td>
              </tr>
            </tbody>
          </table>
          <div class="notebook-table-controls absolute -right-10 top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="this.closest('.notebook-table-wrapper').querySelector('table tbody').insertAdjacentHTML('beforeend', '<tr>' + Array(this.closest('.notebook-table-wrapper').querySelector('tr').cells.length).fill('<td class=\\'p-3 border border-border/50\\' contenteditable=\\'true\\'>New</td>').join('') + '</tr>')" class="w-7 h-7 rounded-lg bg-primary/20 hover:bg-primary/40 flex items-center justify-center text-[10px] font-medium text-primary transition-colors" title="Add row">+R</button>
            <button onclick="this.closest('.notebook-table-wrapper').querySelectorAll('tr').forEach(r => r.insertAdjacentHTML('beforeend', '<td class=\\'p-3 border border-border/50\\' contenteditable=\\'true\\'>New</td>'))" class="w-7 h-7 rounded-lg bg-primary/20 hover:bg-primary/40 flex items-center justify-center text-[10px] font-medium text-primary transition-colors" title="Add column">+C</button>
            <button onclick="const rows = this.closest('.notebook-table-wrapper').querySelectorAll('tr'); if(rows.length > 1) rows[rows.length-1].remove();" class="w-7 h-7 rounded-lg bg-destructive/20 hover:bg-destructive/40 flex items-center justify-center text-[10px] font-medium text-destructive transition-colors" title="Remove row">-R</button>
            <button onclick="this.closest('.notebook-table-wrapper').querySelectorAll('tr').forEach(r => { if(r.cells.length > 1) r.deleteCell(-1); });" class="w-7 h-7 rounded-lg bg-destructive/20 hover:bg-destructive/40 flex items-center justify-center text-[10px] font-medium text-destructive transition-colors" title="Remove column">-C</button>
            <div class="h-px bg-border/50 my-1"></div>
            <button onclick="this.closest('.notebook-table-wrapper').remove();" class="w-7 h-7 rounded-lg bg-destructive hover:bg-destructive/80 flex items-center justify-center text-[10px] font-medium text-destructive-foreground transition-colors" title="Delete table">✕</button>
          </div>
        </div>
      `;
      document.execCommand('insertHTML', false, tableHTML);
    } else if (option.id === 'callout') {
      document.execCommand('insertHTML', false, '<div class="bg-primary/10 border-l-4 border-primary p-3 my-2 rounded-r">Type your callout here...</div>');
    } else if (option.id === 'toggle') {
      document.execCommand('insertHTML', false, '<details class="my-2"><summary class="cursor-pointer font-medium">Toggle title</summary><div class="pl-4 pt-2">Toggle content...</div></details>');
    } else if (option.id === 'todo') {
      const todoHTML = `
        <div class="notebook-todo-item flex items-center gap-3 my-2 py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all group" contenteditable="false">
          <label class="todo-checkbox-wrapper relative flex items-center justify-center w-5 h-5 cursor-pointer">
            <input type="checkbox" class="peer sr-only" onchange="const text = this.closest('.notebook-todo-item').querySelector('.todo-text'); text.classList.toggle('line-through', this.checked); text.classList.toggle('text-muted-foreground', this.checked);" />
            <div class="w-5 h-5 rounded-md border-2 border-primary/40 peer-checked:border-primary peer-checked:bg-primary transition-all duration-200 flex items-center justify-center">
              <svg class="w-3 h-3 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </label>
          <span contenteditable="true" class="todo-text flex-1 outline-none transition-all duration-200 text-sm">New task</span>
          <button onclick="this.closest('.notebook-todo-item').remove();" class="w-6 h-6 rounded-md opacity-0 group-hover:opacity-100 bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center text-destructive transition-all duration-150" title="Delete">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      `;
      document.execCommand('insertHTML', false, todoHTML);
    } else if (option.id === 'link') {
      const url = prompt('Enter URL:');
      if (url) {
        document.execCommand('createLink', false, url);
      }
    } else if (option.value) {
      document.execCommand(option.command, false, option.value);
    } else {
      document.execCommand(option.command, false);
    }
    setIsBlockMenuOpen(false);
    setShowBlockButton(false);
  };

  // Handle mouse move over editor to show block button
  const handleEditorMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isLocked || isSelectedEntryInTrash) return;
    
    const editorContainer = editorContainerRef.current;
    if (!editorContainer) return;
    
    const rect = editorContainer.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    
    // Show button on the left side
    setShowBlockButton(true);
    setBlockButtonPosition({ x: 8, y: relativeY - 12 });
  };

  const handleEditorMouseLeave = () => {
    if (!isBlockMenuOpen) {
      setShowBlockButton(false);
    }
  };

  const openBlockMenu = () => {
    const editorContainer = editorContainerRef.current;
    if (!editorContainer) return;
    
    setBlockMenuPosition({ x: blockButtonPosition.x + 32, y: blockButtonPosition.y });
    setIsBlockMenuOpen(true);
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
      {/* Folders Popup Overlay */}
      {isFoldersPanelOpen && (
        <div 
          className="fixed left-4 top-1/2 -translate-y-1/2 z-50 w-72 bg-background/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl animate-scale-in overflow-hidden"
          onMouseLeave={() => setIsFoldersPanelOpen(false)}
        >
          <div className="flex flex-col max-h-[70vh]">
            {/* Header */}
            <div className="p-3 border-b border-border/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm">Folders</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddFolderDialogOpen(true)}
                className="h-7 w-7 p-0"
              >
                <FolderPlus className="w-4 h-4" />
              </Button>
            </div>

            {/* Categories */}
            <ScrollArea className="flex-1 max-h-[50vh]">
              <div className="p-2 space-y-0.5">
                {CATEGORIES.filter(c => c.id !== "trash").map((cat) => {
                  const Icon = cat.icon;
                  const count = cat.id === "all" 
                    ? notebookEntries.filter(e => !e.isDeleted).length 
                    : notebookEntries.filter((e) => e.category === cat.id && !e.isDeleted).length;
                  const markerColor = getFolderMarkerColor(cat.id);
                  
                  return (
                    <div key={cat.id} className="relative group/folder flex items-center gap-1">
                      {/* Color Marker */}
                      {markerColor && (
                        <div 
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                          style={{ backgroundColor: markerColor }}
                        />
                      )}
                      <button
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          setSelectedEntryId(null);
                          setIsCreatingNew(false);
                          setIsFoldersPanelOpen(false);
                        }}
                        className={cn(
                          "flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all",
                          markerColor && "pl-3",
                          selectedCategory === cat.id
                            ? "bg-primary/20 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="flex-1 text-left truncate">{cat.label}</span>
                        <span className="text-[10px] text-muted-foreground">{count}</span>
                      </button>
                      
                      {/* Marker Color Picker */}
                      {cat.id !== "all" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button 
                              className="w-6 h-6 rounded-md opacity-0 group-hover/folder:opacity-100 bg-background hover:bg-accent flex items-center justify-center transition-all border border-border shadow-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div 
                                className={cn(
                                  "w-3 h-3 rounded-full border",
                                  markerColor ? "border-white/60" : "border-dashed border-foreground/40 bg-muted"
                                )}
                                style={{ backgroundColor: markerColor || undefined }}
                              />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36 p-2">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">Marker Color</div>
                            <div className="grid grid-cols-5 gap-1.5">
                              {MARKER_COLORS.map((color) => (
                                <button
                                  key={color.id}
                                  onClick={() => handleSetFolderMarker(cat.id, color.id)}
                                  className={cn(
                                    "w-5 h-5 rounded-full border-2 transition-all hover:scale-110 shadow-sm",
                                    folderMarkers[cat.id] === color.id 
                                      ? "border-foreground ring-2 ring-primary/30" 
                                      : "border-white/30 hover:border-foreground/50",
                                    color.id === 'none' && "border-dashed border-muted-foreground/50 bg-muted/50"
                                  )}
                                  style={{ backgroundColor: color.id === 'none' ? 'transparent' : color.color }}
                                  title={color.label}
                                />
                              ))}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  );
                })}

                {/* Custom Folders */}
                {customFolders.length > 0 && (
                  <>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground px-2 pt-3 pb-1">
                      Custom
                    </div>
                    {customFolders.map((folder) => {
                      const count = notebookEntries.filter((e) => e.category === folder.id && !e.isDeleted).length;
                      const markerColor = getFolderMarkerColor(folder.id);
                      
                      return (
                        <div key={folder.id} className="relative group/folder flex items-center gap-1">
                          {markerColor && (
                            <div 
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                              style={{ backgroundColor: markerColor }}
                            />
                          )}
                          <button
                            onClick={() => {
                              setSelectedCategory(folder.id);
                              setSelectedEntryId(null);
                              setIsCreatingNew(false);
                              setIsFoldersPanelOpen(false);
                            }}
                            className={cn(
                              "flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all",
                              markerColor && "pl-3",
                              selectedCategory === folder.id
                                ? "bg-primary/20 text-primary"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span className="flex-1 text-left truncate">{folder.label}</span>
                            <span className="text-[10px] text-muted-foreground">{count}</span>
                          </button>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button 
                                className="w-6 h-6 rounded-md opacity-0 group-hover/folder:opacity-100 bg-background hover:bg-accent flex items-center justify-center transition-all border border-border shadow-sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div 
                                  className={cn(
                                    "w-3 h-3 rounded-full border",
                                    markerColor ? "border-white/60" : "border-dashed border-foreground/40 bg-muted"
                                  )}
                                  style={{ backgroundColor: markerColor || undefined }}
                                />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36 p-2">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">Marker Color</div>
                              <div className="grid grid-cols-5 gap-1.5">
                                {MARKER_COLORS.map((color) => (
                                  <button
                                    key={color.id}
                                    onClick={() => handleSetFolderMarker(folder.id, color.id)}
                                    className={cn(
                                      "w-5 h-5 rounded-full border-2 transition-all hover:scale-110 shadow-sm",
                                      folderMarkers[folder.id] === color.id 
                                        ? "border-foreground ring-2 ring-primary/30" 
                                        : "border-white/30 hover:border-foreground/50",
                                      color.id === 'none' && "border-dashed border-muted-foreground/50 bg-muted/50"
                                    )}
                                    style={{ backgroundColor: color.id === 'none' ? 'transparent' : color.color }}
                                    title={color.label}
                                  />
                                ))}
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Trash */}
                <div className="pt-2 mt-2 border-t border-border/30">
                  <button
                    onClick={() => {
                      setSelectedCategory("trash");
                      setSelectedEntryId(null);
                      setIsCreatingNew(false);
                      setIsFoldersPanelOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all",
                      selectedCategory === "trash"
                        ? "bg-destructive/20 text-destructive"
                        : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="flex-1 text-left">Trash</span>
                    {trashCount > 0 && (
                      <span className="text-[10px] text-destructive">{trashCount}</span>
                    )}
                  </button>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

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
      <div className="flex-1 flex overflow-hidden gap-3">
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


            {/* Editor with Block Menu */}
            <ScrollArea className="flex-1">
              <div 
                ref={editorContainerRef}
                className="relative min-h-full"
                onMouseMove={handleEditorMouseMove}
                onMouseLeave={handleEditorMouseLeave}
              >
                {/* Floating Block Button */}
                {showBlockButton && !isLocked && !isSelectedEntryInTrash && (
                  <div
                    className="absolute z-20"
                    style={{ left: blockButtonPosition.x, top: blockButtonPosition.y }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-6 h-6 p-0 opacity-30 hover:opacity-100 hover:bg-muted rounded transition-opacity duration-150"
                      onClick={openBlockMenu}
                    >
                      <Plus className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                  </div>
                )}

                {/* Block Format Menu */}
                {isBlockMenuOpen && (
                  <div
                    className="absolute z-50 bg-background border border-border rounded-lg shadow-xl py-1 w-48 max-h-64 overflow-y-auto animate-scale-in"
                    style={{ left: blockMenuPosition.x, top: blockMenuPosition.y }}
                    onMouseLeave={() => {
                      setIsBlockMenuOpen(false);
                      setShowBlockButton(false);
                    }}
                  >
                    <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground sticky top-0 bg-background">
                      Basic blocks
                    </div>
                    {BLOCK_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.id}
                          onClick={() => handleBlockFormat(option)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors text-left group"
                        >
                          <div className="w-6 h-6 flex items-center justify-center rounded border border-border/50 bg-background group-hover:border-primary/30 transition-colors">
                            <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                          <span className="flex-1">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div
                  ref={editorRef}
                  contentEditable={!isLocked && !isSelectedEntryInTrash}
                  className={cn(
                    "min-h-full p-4 pl-12 pr-12 outline-none focus:outline-none focus-visible:outline-none transition-all caret-primary",
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
                    "[&_em]:italic",
                    "[&_.notebook-table-wrapper]:relative",
                    "[&_.notebook-table]:rounded-xl [&_.notebook-table]:overflow-hidden",
                    "[&_.notebook-table_td]:bg-background/50 [&_.notebook-table_td]:hover:bg-muted/50 [&_.notebook-table_td]:transition-colors",
                    "[&_.notebook-table_td:focus]:outline-none [&_.notebook-table_td:focus]:ring-2 [&_.notebook-table_td:focus]:ring-primary/30 [&_.notebook-table_td:focus]:ring-inset"
                  )}
                  data-placeholder="Start writing your notes..."
                />
              </div>
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
        
        {/* Trade Metrics Panel - Right Side */}
        {linkedTrade && !isSelectedEntryInTrash && (
          <div className={cn(
            "w-44 flex-shrink-0 glass rounded-xl border border-border/40 p-3 h-fit",
            linkedTrade.result >= 0 
              ? "bg-primary/5" 
              : "bg-destructive/5"
          )}>
            <div className="flex items-center gap-2 mb-3">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                linkedTrade.result >= 0 ? "bg-primary/20" : "bg-destructive/20"
              )}>
                <TrendingUp className={cn(
                  "w-4 h-4",
                  linkedTrade.result >= 0 ? "text-primary" : "text-destructive"
                )} />
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Result</div>
                <div className={cn(
                  "text-lg font-bold font-mono leading-tight",
                  linkedTrade.result >= 0 ? "text-primary" : "text-destructive"
                )}>
                  {linkedTrade.result >= 0 ? "+" : ""}${linkedTrade.result.toFixed(0)}
                </div>
              </div>
            </div>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Pair</span>
                <span className="font-medium">{linkedTrade.pair}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Direction</span>
                <Badge variant="outline" className={cn(
                  "text-[10px] px-1.5 py-0",
                  linkedTrade.direction === 'Long' 
                    ? "border-primary/50 text-primary" 
                    : "border-destructive/50 text-destructive"
                )}>
                  {linkedTrade.direction}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Session</span>
                <span className="font-medium">{linkedTrade.session || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Strategy</span>
                <span className="font-medium truncate max-w-[70px]">{linkedTrade.strategy || '—'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Folder Dialog */}
      <Dialog open={isAddFolderDialogOpen} onOpenChange={setIsAddFolderDialogOpen}>
        <DialogContent className="sm:max-w-md glass-strong">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Create New Folder</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Enter a name for your new folder to organize your notes.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFolderName.trim()) {
                  const folderId = `custom-${Date.now()}`;
                  const newFolder = { id: folderId, label: newFolderName.trim() };
                  const updatedFolders = [...customFolders, newFolder];
                  setCustomFolders(updatedFolders);
                  localStorage.setItem('notebook-custom-folders', JSON.stringify(updatedFolders));
                  toast.success(`Folder "${newFolderName}" created!`);
                  setNewFolderName("");
                  setIsAddFolderDialogOpen(false);
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setNewFolderName("");
                setIsAddFolderDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newFolderName.trim()) {
                  const folderId = `custom-${Date.now()}`;
                  const newFolder = { id: folderId, label: newFolderName.trim() };
                  const updatedFolders = [...customFolders, newFolder];
                  setCustomFolders(updatedFolders);
                  localStorage.setItem('notebook-custom-folders', JSON.stringify(updatedFolders));
                  toast.success(`Folder "${newFolderName}" created!`);
                  setNewFolderName("");
                  setIsAddFolderDialogOpen(false);
                } else {
                  toast.error("Please enter a folder name");
                }
              }}
              className="bg-gradient-to-r from-primary to-secondary text-primary-foreground"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}