import { useState, useRef, useEffect, useMemo } from "react";
import { Trade, NotebookEntry } from "@/types/trade";
import { useChecklists } from "@/hooks/useChecklists";
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  Bold,
  Italic,
  Underline,
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
  ChevronLeft,
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
  Languages,
  Undo2,
  SpellCheck,
  X,
  LayoutGrid,
  LayoutList,
  Pin,
  Share2,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface NotebookViewProps {
  trades: Trade[];
  selectedTradeId: string | null;
  onSelectTrade: (id: string) => void;
  onSaveNotes: (id: string, notes: string) => void;
  notebookEntries: NotebookEntry[];
  onSaveEntry: (entry: NotebookEntry) => void;
  onDeleteEntry: (id: string) => void;
  notebookFont?: string;
  onFontChange?: (font: string) => void;
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

// 50 Fonts organized by category
const NOTEBOOK_FONTS = [
  // Sans Serif - Modern
  { id: 'inter', name: 'Inter', family: "'Inter', sans-serif", category: 'Sans Serif' },
  { id: 'roboto', name: 'Roboto', family: "'Roboto', sans-serif", category: 'Sans Serif' },
  { id: 'open-sans', name: 'Open Sans', family: "'Open Sans', sans-serif", category: 'Sans Serif' },
  { id: 'lato', name: 'Lato', family: "'Lato', sans-serif", category: 'Sans Serif' },
  { id: 'montserrat', name: 'Montserrat', family: "'Montserrat', sans-serif", category: 'Sans Serif' },
  { id: 'poppins', name: 'Poppins', family: "'Poppins', sans-serif", category: 'Sans Serif' },
  { id: 'raleway', name: 'Raleway', family: "'Raleway', sans-serif", category: 'Sans Serif' },
  { id: 'nunito', name: 'Nunito', family: "'Nunito', sans-serif", category: 'Sans Serif' },
  { id: 'ubuntu', name: 'Ubuntu', family: "'Ubuntu', sans-serif", category: 'Sans Serif' },
  { id: 'rubik', name: 'Rubik', family: "'Rubik', sans-serif", category: 'Sans Serif' },
  { id: 'oswald', name: 'Oswald', family: "'Oswald', sans-serif", category: 'Sans Serif' },
  { id: 'dm-sans', name: 'DM Sans', family: "'DM Sans', sans-serif", category: 'Sans Serif' },
  { id: 'space-grotesk', name: 'Space Grotesk', family: "'Space Grotesk', sans-serif", category: 'Sans Serif' },
  { id: 'outfit', name: 'Outfit', family: "'Outfit', sans-serif", category: 'Sans Serif' },
  { id: 'work-sans', name: 'Work Sans', family: "'Work Sans', sans-serif", category: 'Sans Serif' },
  { id: 'plus-jakarta', name: 'Plus Jakarta Sans', family: "'Plus Jakarta Sans', sans-serif", category: 'Sans Serif' },
  { id: 'manrope', name: 'Manrope', family: "'Manrope', sans-serif", category: 'Sans Serif' },
  { id: 'sora', name: 'Sora', family: "'Sora', sans-serif", category: 'Sans Serif' },
  { id: 'lexend', name: 'Lexend', family: "'Lexend', sans-serif", category: 'Sans Serif' },
  { id: 'urbanist', name: 'Urbanist', family: "'Urbanist', sans-serif", category: 'Sans Serif' },
  { id: 'figtree', name: 'Figtree', family: "'Figtree', sans-serif", category: 'Sans Serif' },
  { id: 'archivo', name: 'Archivo', family: "'Archivo', sans-serif", category: 'Sans Serif' },
  { id: 'barlow', name: 'Barlow', family: "'Barlow', sans-serif", category: 'Sans Serif' },
  { id: 'karla', name: 'Karla', family: "'Karla', sans-serif", category: 'Sans Serif' },
  { id: 'quicksand', name: 'Quicksand', family: "'Quicksand', sans-serif", category: 'Sans Serif' },
  { id: 'comfortaa', name: 'Comfortaa', family: "'Comfortaa', sans-serif", category: 'Sans Serif' },
  { id: 'varela-round', name: 'Varela Round', family: "'Varela Round', sans-serif", category: 'Sans Serif' },
  // Serif - Classic
  { id: 'merriweather', name: 'Merriweather', family: "'Merriweather', serif", category: 'Serif' },
  { id: 'playfair', name: 'Playfair Display', family: "'Playfair Display', serif", category: 'Serif' },
  { id: 'libre-baskerville', name: 'Libre Baskerville', family: "'Libre Baskerville', serif", category: 'Serif' },
  { id: 'crimson', name: 'Crimson Text', family: "'Crimson Text', serif", category: 'Serif' },
  { id: 'source-serif', name: 'Source Serif 4', family: "'Source Serif 4', serif", category: 'Serif' },
  { id: 'cormorant', name: 'Cormorant Garamond', family: "'Cormorant Garamond', serif", category: 'Serif' },
  { id: 'eb-garamond', name: 'EB Garamond', family: "'EB Garamond', serif", category: 'Serif' },
  { id: 'spectral', name: 'Spectral', family: "'Spectral', serif", category: 'Serif' },
  { id: 'bitter', name: 'Bitter', family: "'Bitter', serif", category: 'Serif' },
  { id: 'lora', name: 'Lora', family: "'Lora', serif", category: 'Serif' },
  // Monospace - Code
  { id: 'source-code', name: 'Source Code Pro', family: "'Source Code Pro', monospace", category: 'Monospace' },
  { id: 'fira-code', name: 'Fira Code', family: "'Fira Code', monospace", category: 'Monospace' },
  { id: 'jetbrains', name: 'JetBrains Mono', family: "'JetBrains Mono', monospace", category: 'Monospace' },
  { id: 'ibm-plex', name: 'IBM Plex Mono', family: "'IBM Plex Mono', monospace", category: 'Monospace' },
  { id: 'space-mono', name: 'Space Mono', family: "'Space Mono', monospace", category: 'Monospace' },
  { id: 'roboto-mono', name: 'Roboto Mono', family: "'Roboto Mono', monospace", category: 'Monospace' },
  { id: 'cousine', name: 'Cousine', family: "'Cousine', monospace", category: 'Monospace' },
  { id: 'anonymous', name: 'Anonymous Pro', family: "'Anonymous Pro', monospace", category: 'Monospace' },
  { id: 'overpass-mono', name: 'Overpass Mono', family: "'Overpass Mono', monospace", category: 'Monospace' },
  { id: 'inconsolata', name: 'Inconsolata', family: "'Inconsolata', monospace", category: 'Monospace' },
];

type FontStyle = string;

export function NotebookView({
  trades,
  selectedTradeId,
  onSelectTrade,
  onSaveNotes,
  notebookEntries,
  onSaveEntry,
  onDeleteEntry,
  notebookFont = 'inter',
  onFontChange,
}: NotebookViewProps) {
  const { checklists } = useChecklists();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSmallText, setIsSmallText] = useState(false);
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [isFullWidthClosing, setIsFullWidthClosing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isFoldersPanelOpen, setIsFoldersPanelOpen] = useState(false);
  const [isFoldersPanelClosing, setIsFoldersPanelClosing] = useState(false);
  const [isEntriesPanelOpen, setIsEntriesPanelOpen] = useState(false);
  const [isEntriesPanelClosing, setIsEntriesPanelClosing] = useState(false);
  const [isAddFolderDialogOpen, setIsAddFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderSearchQuery, setFolderSearchQuery] = useState("");
  const [customFolders, setCustomFolders] = useState<Array<{ id: string; label: string; color?: string }>>(() => {
    const saved = localStorage.getItem('notebook-custom-folders');
    console.log('Loading custom folders:', saved);
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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isImagePreviewClosing, setIsImagePreviewClosing] = useState(false);
  const [fullscreenShowBlockButton, setFullscreenShowBlockButton] = useState(false);
  const [fullscreenBlockButtonPosition, setFullscreenBlockButtonPosition] = useState({ x: 0, y: 0 });
  const [fullscreenBlockMenuOpen, setFullscreenBlockMenuOpen] = useState(false);
  const [fullscreenBlockMenuPosition, setFullscreenBlockMenuPosition] = useState({ x: 0, y: 0 });
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('notebook-view-mode');
    return (saved === 'list' ? 'list' : 'grid') as 'grid' | 'list';
  });
  
  // Right-click context menu state
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightColorPicker, setShowHighlightColorPicker] = useState(false);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const fullscreenEditorRef = useRef<HTMLDivElement>(null);
  const fullscreenEditorContainerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const fullscreenTitleRef = useRef<HTMLInputElement>(null);
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

  // Sync content when entering fullscreen
  useEffect(() => {
    if (isFullWidth && editorRef.current && fullscreenEditorRef.current) {
      fullscreenEditorRef.current.innerHTML = editorRef.current.innerHTML;
      if (titleRef.current && fullscreenTitleRef.current) {
        fullscreenTitleRef.current.value = titleRef.current.value;
      }
    }
  }, [isFullWidth]);

  // Close fullscreen with animation and sync content back
  const closeFullscreen = () => {
    // Sync content back to main editor before closing
    if (fullscreenEditorRef.current && editorRef.current) {
      editorRef.current.innerHTML = fullscreenEditorRef.current.innerHTML;
    }
    if (fullscreenTitleRef.current && titleRef.current) {
      titleRef.current.value = fullscreenTitleRef.current.value;
    }
    setIsFullWidthClosing(true);
    setTimeout(() => {
      setIsFullWidth(false);
      setIsFullWidthClosing(false);
    }, 200);
  };

  // Auto-select notebook entry when navigating from trade log
  useEffect(() => {
    if (selectedTradeId) {
      // Find the notebook entry linked to this trade
      const linkedEntry = notebookEntries.find(e => e.tradeId === selectedTradeId && !e.isDeleted);
      if (linkedEntry) {
        setSelectedEntryId(linkedEntry.id);
        setSelectedCategory(linkedEntry.category || 'trade-notes');
        setIsCreatingNew(false);
      }
    }
  }, [selectedTradeId, notebookEntries]);

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullWidth) {
        closeFullscreen();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullWidth]);

  // Auto-save in fullscreen mode (every 30 seconds)
  useEffect(() => {
    if (!isFullWidth || !selectedEntry || isLocked) return;

    const autoSaveInterval = setInterval(() => {
      if (fullscreenEditorRef.current && fullscreenTitleRef.current) {
        const content = fullscreenEditorRef.current.innerHTML;
        const title = fullscreenTitleRef.current.value || "Untitled Note";
        
        onSaveEntry({
          ...selectedEntry,
          title,
          content,
          updatedAt: new Date().toISOString(),
        });
        toast.success("Auto-saved", { duration: 1500 });
      }
    }, 30000); // 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [isFullWidth, selectedEntry, isLocked, onSaveEntry]);

  const closeFoldersPanel = () => {
    setIsFoldersPanelClosing(true);
    setTimeout(() => {
      setIsFoldersPanelOpen(false);
      setIsFoldersPanelClosing(false);
    }, 200);
  };

  const toggleFoldersPanel = () => {
    if (isFoldersPanelOpen) {
      closeFoldersPanel();
    } else {
      setIsFoldersPanelOpen(true);
    }
  };

  const closeEntriesPanel = () => {
    setIsEntriesPanelClosing(true);
    setTimeout(() => {
      setIsEntriesPanelOpen(false);
      setIsEntriesPanelClosing(false);
    }, 200);
  };

  const toggleEntriesPanel = () => {
    if (isEntriesPanelOpen) {
      closeEntriesPanel();
    } else {
      setIsEntriesPanelOpen(true);
    }
  };

  const execCommand = (cmd: string, value?: string) => {
    if (isLocked) return;
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const handleSave = () => {
    // Use fullscreen refs if in fullscreen mode, otherwise use regular refs
    const currentEditorRef = isFullWidth ? fullscreenEditorRef : editorRef;
    const currentTitleRef = isFullWidth ? fullscreenTitleRef : titleRef;
    
    if (!currentEditorRef.current) return;
    
    const content = currentEditorRef.current.innerHTML;
    const title = currentTitleRef.current?.value || "Untitled Note";
    
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

  // Undo action
  const handleUndo = () => {
    document.execCommand('undo', false);
    toast.success("Undo applied");
  };

  // Translation (opens browser translate - placeholder for now)
  const handleTranslate = () => {
    if (!editorRef.current) return;
    const selectedText = window.getSelection()?.toString();
    if (selectedText) {
      const url = `https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(selectedText)}`;
      window.open(url, '_blank');
    } else {
      toast.info("Select text to translate");
    }
  };

  // Spell check toggle
  const handleSpellCheck = () => {
    if (editorRef.current) {
      const currentSpellcheck = editorRef.current.spellcheck;
      editorRef.current.spellcheck = !currentSpellcheck;
      editorRef.current.focus();
      toast.success(currentSpellcheck ? "Spell check disabled" : "Spell check enabled");
    }
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

  // Toggle view mode
  const toggleViewMode = () => {
    const newMode = viewMode === 'grid' ? 'list' : 'grid';
    setViewMode(newMode);
    localStorage.setItem('notebook-view-mode', newMode);
  };

  // Note card colors based on category - using inline styles for HSL colors
  const getNoteCardColor = (category: string, index: number) => {
    const colors = [
      { bg: 'hsl(210, 100%, 95%)', bgDark: 'hsl(210, 50%, 15%)', border: 'hsl(210, 80%, 85%)', borderDark: 'hsl(210, 40%, 25%)', accent: 'hsl(210, 80%, 55%)' },
      { bg: 'hsl(142, 70%, 92%)', bgDark: 'hsl(142, 40%, 12%)', border: 'hsl(142, 60%, 80%)', borderDark: 'hsl(142, 30%, 22%)', accent: 'hsl(142, 70%, 45%)' },
      { bg: 'hsl(48, 95%, 90%)', bgDark: 'hsl(48, 50%, 12%)', border: 'hsl(48, 80%, 80%)', borderDark: 'hsl(48, 40%, 22%)', accent: 'hsl(48, 95%, 50%)' },
      { bg: 'hsl(0, 85%, 93%)', bgDark: 'hsl(0, 40%, 14%)', border: 'hsl(0, 70%, 85%)', borderDark: 'hsl(0, 30%, 24%)', accent: 'hsl(0, 75%, 55%)' },
      { bg: 'hsl(262, 80%, 93%)', bgDark: 'hsl(262, 40%, 14%)', border: 'hsl(262, 60%, 85%)', borderDark: 'hsl(262, 30%, 24%)', accent: 'hsl(262, 70%, 55%)' },
      { bg: 'hsl(330, 80%, 93%)', bgDark: 'hsl(330, 40%, 14%)', border: 'hsl(330, 60%, 85%)', borderDark: 'hsl(330, 30%, 24%)', accent: 'hsl(330, 70%, 55%)' },
      { bg: 'hsl(186, 80%, 90%)', bgDark: 'hsl(186, 40%, 12%)', border: 'hsl(186, 60%, 80%)', borderDark: 'hsl(186, 30%, 22%)', accent: 'hsl(186, 70%, 45%)' },
      { bg: 'hsl(25, 90%, 92%)', bgDark: 'hsl(25, 50%, 14%)', border: 'hsl(25, 70%, 82%)', borderDark: 'hsl(25, 35%, 24%)', accent: 'hsl(25, 85%, 50%)' },
    ];
    return colors[index % colors.length];
  };


  const handleDeleteFolder = (folderId: string) => {
    // Move all notes in this folder to general
    notebookEntries
      .filter(e => e.category === folderId)
      .forEach(entry => {
        onSaveEntry({
          ...entry,
          category: 'general',
          updatedAt: new Date().toISOString(),
        });
      });
    
    // Remove folder from list
    const updatedFolders = customFolders.filter(f => f.id !== folderId);
    setCustomFolders(updatedFolders);
    localStorage.setItem('notebook-custom-folders', JSON.stringify(updatedFolders));
    
    // Remove folder marker if exists
    const newMarkers = { ...folderMarkers };
    delete newMarkers[folderId];
    setFolderMarkers(newMarkers);
    localStorage.setItem('notebook-folder-markers', JSON.stringify(newMarkers));
    
    // If currently viewing the deleted folder, switch to all
    if (selectedCategory === folderId) {
      setSelectedCategory('all');
    }
    
    toast.success("Folder deleted!");
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

  const handleBlockFormat = (option: typeof BLOCK_OPTIONS[0], isFullscreen = false) => {
    const targetRef = isFullscreen ? fullscreenEditorRef : editorRef;
    if (!targetRef.current) return;
    targetRef.current.focus();
    
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
    
    if (isFullscreen) {
      setFullscreenBlockMenuOpen(false);
      setFullscreenShowBlockButton(false);
    } else {
      setIsBlockMenuOpen(false);
      setShowBlockButton(false);
    }
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

  // Fullscreen editor mouse handlers
  const handleFullscreenEditorMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isLocked) return;
    
    const container = fullscreenEditorContainerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    
    setFullscreenShowBlockButton(true);
    setFullscreenBlockButtonPosition({ x: 8, y: relativeY - 12 });
  };

  const handleFullscreenEditorMouseLeave = () => {
    if (!fullscreenBlockMenuOpen) {
      setFullscreenShowBlockButton(false);
    }
  };

  const openFullscreenBlockMenu = () => {
    setFullscreenBlockMenuPosition({ x: fullscreenBlockButtonPosition.x + 32, y: fullscreenBlockButtonPosition.y });
    setFullscreenBlockMenuOpen(true);
  };

  // Text and highlight colors
  const TEXT_COLORS = [
    { id: 'default', label: 'Default', color: 'inherit' },
    { id: 'red', label: 'Red', color: '#ef4444' },
    { id: 'orange', label: 'Orange', color: '#f97316' },
    { id: 'yellow', label: 'Yellow', color: '#eab308' },
    { id: 'green', label: 'Green', color: '#22c55e' },
    { id: 'blue', label: 'Blue', color: '#3b82f6' },
    { id: 'purple', label: 'Purple', color: '#a855f7' },
    { id: 'pink', label: 'Pink', color: '#ec4899' },
    { id: 'gray', label: 'Gray', color: '#6b7280' },
  ];

  const HIGHLIGHT_COLORS = [
    { id: 'none', label: 'None', color: 'transparent' },
    { id: 'yellow', label: 'Yellow', color: 'rgba(234, 179, 8, 0.3)' },
    { id: 'green', label: 'Green', color: 'rgba(34, 197, 94, 0.3)' },
    { id: 'blue', label: 'Blue', color: 'rgba(59, 130, 246, 0.3)' },
    { id: 'purple', label: 'Purple', color: 'rgba(168, 85, 247, 0.3)' },
    { id: 'pink', label: 'Pink', color: 'rgba(236, 72, 153, 0.3)' },
    { id: 'red', label: 'Red', color: 'rgba(239, 68, 68, 0.3)' },
    { id: 'orange', label: 'Orange', color: 'rgba(249, 115, 22, 0.3)' },
    { id: 'gray', label: 'Gray', color: 'rgba(107, 114, 128, 0.3)' },
  ];

  // Handle right-click context menu for text formatting
  const handleContextMenu = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      e.preventDefault();
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setContextMenuOpen(true);
      setShowTextColorPicker(false);
      setShowHighlightColorPicker(false);
    }
  };

  // Apply text color to selected text
  const applyTextColor = (color: string) => {
    if (color === 'inherit') {
      document.execCommand('removeFormat', false);
    } else {
      document.execCommand('foreColor', false, color);
    }
    setContextMenuOpen(false);
    setShowTextColorPicker(false);
  };

  // Apply highlight/background color to selected text
  const applyHighlightColor = (color: string) => {
    if (color === 'transparent') {
      document.execCommand('removeFormat', false);
    } else {
      document.execCommand('hiliteColor', false, color);
    }
    setContextMenuOpen(false);
    setShowHighlightColorPicker(false);
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuOpen) {
        setContextMenuOpen(false);
        setShowTextColorPicker(false);
        setShowHighlightColorPicker(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenuOpen]);

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
  
  // Find the checklist used for the linked trade
  const linkedChecklist = linkedTrade?.checklistId 
    ? checklists.find(c => c.id === linkedTrade.checklistId) 
    : null;
  // Calculate overall trade stats
  const overallStats = {
    totalTrades: trades.length,
    wins: trades.filter(t => t.result > 0).length,
    losses: trades.filter(t => t.result < 0).length,
    netPnL: trades.reduce((sum, t) => sum + t.result, 0),
    winRate: trades.length > 0 ? (trades.filter(t => t.result > 0).length / trades.length) * 100 : 0,
  };

  // Get font family from NOTEBOOK_FONTS array
  const selectedFontFamily = useMemo(() => {
    const font = NOTEBOOK_FONTS.find(f => f.id === notebookFont);
    return font?.family || "'Inter', sans-serif";
  }, [notebookFont]);

  const isViewingTrash = selectedCategory === "trash";
  const isSelectedEntryInTrash = selectedEntry?.isDeleted;

  return (
    <>
    {/* Fullscreen Overlay */}
    {(isFullWidth || isFullWidthClosing) && selectedEntry && (
      <div 
        className={cn(
          "fixed inset-0 z-50 bg-background/60 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8 transition-all duration-300",
          isFullWidthClosing ? "opacity-0" : "opacity-100"
        )}
        onClick={closeFullscreen}
      >
        {/* Fullscreen Container - Glass morphism card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ 
            opacity: isFullWidthClosing ? 0 : 1, 
            scale: isFullWidthClosing ? 0.95 : 1, 
            y: isFullWidthClosing ? 20 : 0 
          }}
          transition={{ 
            duration: 0.35, 
            ease: [0.25, 0.46, 0.45, 0.94],
            scale: { type: "spring", stiffness: 300, damping: 25 }
          }}
          className="w-full max-w-4xl h-[90vh] glass-strong rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="flex items-center justify-between px-6 py-4 border-b border-border/20"
          >
            <h2 className="text-xl font-semibold tracking-tight">Notes</h2>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 w-9 p-0 rounded-xl hover:bg-muted/50"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  closeFullscreen();
                }}
                className="h-9 px-4 rounded-xl text-sm hover:bg-muted/50"
              >
                Discard
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => {
                  handleSave();
                  closeFullscreen();
                }}
                disabled={isLocked} 
                className="h-9 px-5 rounded-xl text-sm bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
              >
                Save & Close
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={closeFullscreen}
                className="h-9 w-9 p-0 rounded-xl hover:bg-destructive/10 hover:text-destructive ml-1"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>

          {/* Formatting Toolbar */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="flex items-center justify-center gap-1 px-6 py-3 border-b border-border/10"
          >
            <div className="flex items-center gap-1 bg-muted/30 rounded-xl p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => document.execCommand('bold')}
                className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
                disabled={isLocked}
              >
                <Bold className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => document.execCommand('italic')}
                className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
                disabled={isLocked}
              >
                <Italic className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => document.execCommand('underline')}
                className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
                disabled={isLocked}
              >
                <Underline className="w-4 h-4" />
              </Button>
              
              <div className="w-px h-5 bg-border/50 mx-1" />
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => document.execCommand('justifyLeft')}
                className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
                disabled={isLocked}
              >
                <AlignLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => document.execCommand('justifyCenter')}
                className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
                disabled={isLocked}
              >
                <AlignCenter className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => document.execCommand('justifyRight')}
                className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
                disabled={isLocked}
              >
                <AlignRight className="w-4 h-4" />
              </Button>
              
              <div className="w-px h-5 bg-border/50 mx-1" />
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const url = prompt('Enter URL:');
                  if (url) document.execCommand('createLink', false, url);
                }}
                className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
                disabled={isLocked}
              >
                <Link className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => document.execCommand('formatBlock', false, 'blockquote')}
                className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
                disabled={isLocked}
              >
                <Quote className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>

          {/* Content Area */}
          <ScrollArea className="flex-1">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              ref={fullscreenEditorContainerRef}
              className="max-w-3xl mx-auto px-8 md:px-12 py-8"
              onMouseMove={handleFullscreenEditorMouseMove}
              onMouseLeave={handleFullscreenEditorMouseLeave}
            >
              {/* Title Section */}
              <div className="mb-6">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
                  Title
                </span>
                <Input
                  ref={fullscreenTitleRef}
                  defaultValue={selectedEntry?.title || ""}
                  placeholder="Untitled"
                  disabled={isLocked}
                  className="text-xl font-semibold bg-transparent border-none p-0 h-auto focus-visible:ring-0 mt-1"
                />
              </div>

              {/* Floating Block Button - Fullscreen */}
              {fullscreenShowBlockButton && !isLocked && (
                <div
                  className="absolute z-20"
                  style={{ left: fullscreenBlockButtonPosition.x, top: fullscreenBlockButtonPosition.y }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-6 h-6 p-0 opacity-30 hover:opacity-100 hover:bg-muted rounded transition-opacity duration-150"
                    onClick={openFullscreenBlockMenu}
                  >
                    <Plus className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </Button>
                </div>
              )}

              {/* Block Format Menu - Fullscreen */}
              {fullscreenBlockMenuOpen && (
                <div
                  className="absolute z-50 bg-background border border-border rounded-xl shadow-xl py-1 w-48 max-h-64 overflow-y-auto animate-scale-in"
                  style={{ left: fullscreenBlockMenuPosition.x, top: fullscreenBlockMenuPosition.y }}
                  onMouseLeave={() => {
                    setFullscreenBlockMenuOpen(false);
                    setFullscreenShowBlockButton(false);
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
                        onClick={() => handleBlockFormat(option, true)}
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

              {/* Editor Content */}
              <div
                ref={fullscreenEditorRef}
                contentEditable={!isLocked}
                style={{ fontFamily: selectedFontFamily }}
                className={cn(
                  "min-h-[calc(100vh-400px)] outline-none focus:outline-none caret-primary",
                  isSmallText ? "text-sm leading-relaxed" : "text-base leading-loose",
                  isLocked && "cursor-not-allowed opacity-70",
                  "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3",
                  "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2",
                  "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2",
                  "[&_p]:mb-3 [&_p]:text-foreground/90",
                  "[&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-3 [&_ul]:space-y-1",
                  "[&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-3 [&_ol]:space-y-1",
                  "[&_li]:text-foreground/90 [&_li]:pl-1",
                  "[&_blockquote]:border-l-4 [&_blockquote]:border-primary/60 [&_blockquote]:pl-4 [&_blockquote]:py-1 [&_blockquote]:italic [&_blockquote]:text-foreground/80 [&_blockquote]:my-4 [&_blockquote]:bg-primary/5 [&_blockquote]:rounded-r-lg",
                  "[&_strong]:font-semibold [&_strong]:text-foreground",
                  "[&_em]:italic",
                  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:text-primary/80",
                  "[&_.notebook-table-wrapper]:relative",
                  "[&_.notebook-table]:rounded-xl [&_.notebook-table]:overflow-hidden",
                  "[&_.notebook-table_td]:bg-background/50 [&_.notebook-table_td]:hover:bg-muted/50 [&_.notebook-table_td]:transition-colors",
                  "[&_.notebook-table_td:focus]:outline-none [&_.notebook-table_td:focus]:ring-2 [&_.notebook-table_td:focus]:ring-primary/30 [&_.notebook-table_td:focus]:ring-inset"
                )}
                suppressContentEditableWarning
              />
            </motion.div>
          </ScrollArea>
        </motion.div>
      </div>
    )}
    
    <div className={cn(
      "h-[calc(100vh-200px)] flex gap-4 transition-all duration-300 relative",
      isFullWidth && "invisible"
    )}>
      {/* Bookmark Tab Toggle - Notes */}
      {!isEntriesPanelOpen && !isFoldersPanelOpen && (
        <button
          onMouseEnter={() => setIsEntriesPanelOpen(true)}
          className="bookmark-tab"
        >
          <FileText className="w-4 h-4" />
          <span className="bookmark-label">Notes</span>
        </button>
      )}

      {/* Bookmark Tab Toggle - Folders */}
      {!isEntriesPanelOpen && !isFoldersPanelOpen && (
        <button
          onMouseEnter={() => setIsFoldersPanelOpen(true)}
          className="bookmark-tab"
          style={{ top: '160px' }}
        >
          <FolderOpen className="w-4 h-4" />
          <span className="bookmark-label">Folders</span>
        </button>
      )}

      {/* Editor - Full width with toggle for entries panel */}
      <div className="flex-1 flex overflow-hidden gap-3 relative" onClick={() => (isEntriesPanelOpen || isFoldersPanelOpen) && (closeEntriesPanel(), closeFoldersPanel())}>
        {/* Folders Panel - displayed in same location as entries panel */}
        {isFoldersPanelOpen && !isEntriesPanelOpen && (
          <div 
            className={cn(
              "w-72 flex-shrink-0 glass rounded-xl border border-border/40 overflow-hidden flex flex-col",
              isFoldersPanelClosing ? "animate-entries-panel-out" : "animate-entries-panel-in"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col h-[400px]">
              {/* Header */}
              <div className="p-3 border-b border-border/30 space-y-2 shrink-0">
                <div className="flex items-center justify-between">
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
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search folders..."
                    value={folderSearchQuery}
                    onChange={(e) => setFolderSearchQuery(e.target.value)}
                    className="h-8 pl-7 text-xs bg-muted/50"
                  />
                </div>
              </div>

              {/* Categories */}
              <ScrollArea className="flex-1 overflow-hidden">
                <div className="p-2 space-y-0.5">
                  {CATEGORIES.filter(c => c.id !== "trash" && c.label.toLowerCase().includes(folderSearchQuery.toLowerCase())).map((cat) => {
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
                            closeFoldersPanel();
                            setIsEntriesPanelOpen(true);
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
                          <DropdownMenu onOpenChange={setIsColorPickerOpen}>
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
                            <DropdownMenuContent align="end" className="w-36 p-2 bg-popover border border-border z-50">
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
                  {customFolders.filter(f => f.label.toLowerCase().includes(folderSearchQuery.toLowerCase())).length > 0 && (
                    <>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground px-2 pt-3 pb-1">
                        Custom
                      </div>
                      {customFolders.filter(f => f.label.toLowerCase().includes(folderSearchQuery.toLowerCase())).map((folder) => {
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
                                closeFoldersPanel();
                                setIsEntriesPanelOpen(true);
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
                            
                            {/* Delete Folder Button */}
                            <div onClick={(e) => e.stopPropagation()}>
                              <ConfirmDialog
                                trigger={
                                  <button 
                                    className="w-6 h-6 rounded-md opacity-0 group-hover/folder:opacity-100 bg-background hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-all border border-border shadow-sm"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                }
                                title="Delete Folder"
                                description={`Are you sure you want to delete "${folder.label}"? Notes in this folder will be moved to General Notes.`}
                                confirmLabel="Delete"
                                variant="destructive"
                                onConfirm={() => handleDeleteFolder(folder.id)}
                              />
                            </div>
                            
                            <DropdownMenu onOpenChange={setIsColorPickerOpen}>
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
                              <DropdownMenuContent align="end" className="w-36 p-2 bg-popover border border-border z-50">
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
                        closeFoldersPanel();
                        setIsEntriesPanelOpen(true);
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

        {/* Entries List Panel - Left Side */}
        {isEntriesPanelOpen && (
          <div 
            className={cn(
              "w-72 flex-shrink-0 glass rounded-xl border border-border/40 overflow-hidden flex flex-col",
              isEntriesPanelClosing ? "animate-entries-panel-out" : "animate-entries-panel-in"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-border/30 space-y-2">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => { closeEntriesPanel(); setIsFoldersPanelOpen(true); }} className="h-8 w-8 p-0">
                  <PanelLeftOpen className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium flex-1">
                  {selectedCategory.startsWith("custom_") 
                    ? customFolders.find(f => f.id === selectedCategory)?.label || "Folder"
                    : CATEGORIES.find((c) => c.id === selectedCategory)?.label}
                </span>
                <Button variant="ghost" size="sm" onClick={closeEntriesPanel} className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-7 text-xs pl-7 bg-muted/30 border-border/50" />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                {sortedDates.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-8">No notes yet</div>
                ) : (
                  sortedDates.map((date) => (
                    <div key={date} className="mb-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">{formatDate(date)}</div>
                      {groupedEntries[date].map((entry) => (
                        <button key={entry.id} onClick={() => { setSelectedEntryId(entry.id); setIsCreatingNew(false); }} className={cn("w-full text-left p-2 rounded-lg transition-all mb-1", selectedEntryId === entry.id ? "bg-primary/20 border border-primary/40" : "hover:bg-muted/50")}>
                          <div className="flex items-center gap-2">
                            <ChevronRight className={cn("w-3 h-3", selectedEntryId === entry.id && "rotate-90")} />
                            <span className="text-xs font-medium truncate">{entry.title}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        
        <div className="flex-1 overflow-hidden flex flex-col">
        {selectedEntry || isCreatingNew ? (
          <motion.div
            key={selectedEntry?.id || 'new-note'}
            initial={{ opacity: 0, x: 30, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ 
              duration: 0.4, 
              ease: [0.25, 0.46, 0.45, 0.94],
              opacity: { duration: 0.3 },
              scale: { duration: 0.35 }
            }}
            className="flex flex-col flex-1 overflow-hidden"
          >
            {/* Header */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="p-4 border-b border-border/30"
            >
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
                <div className="flex items-center gap-2 flex-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleFoldersPanel}
                    className="h-8 w-8 p-0 shrink-0"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                  </Button>
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
                </div>
              </div>

              {/* Actions - hidden for trash items */}
              {!isSelectedEntryInTrash && (
                <div className="flex items-center gap-2 mt-4">
                  <div className="flex-1" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-background border border-border z-50 p-2">
                      {/* Font Style Selector */}
                      <div className="flex items-center justify-center gap-2 mb-2 p-1">
                        <button 
                          onClick={() => onFontChange?.('inter')}
                          className={cn(
                            "flex flex-col items-center gap-1 px-3 py-2 rounded-md transition-colors",
                            notebookFont === 'inter' ? "bg-primary/20 text-primary" : "hover:bg-muted"
                          )}
                        >
                          <span className="text-lg font-sans">Ag</span>
                          <span className="text-[10px] text-muted-foreground">Default</span>
                        </button>
                        <button 
                          onClick={() => onFontChange?.('merriweather')}
                          className={cn(
                            "flex flex-col items-center gap-1 px-3 py-2 rounded-md transition-colors",
                            notebookFont === 'merriweather' ? "bg-primary/20 text-primary" : "hover:bg-muted"
                          )}
                        >
                          <span className="text-lg font-serif">Ag</span>
                          <span className="text-[10px] text-muted-foreground">Serif</span>
                        </button>
                        <button 
                          onClick={() => onFontChange?.('source-code')}
                          className={cn(
                            "flex flex-col items-center gap-1 px-3 py-2 rounded-md transition-colors",
                            notebookFont === 'source-code' ? "bg-primary/20 text-primary" : "hover:bg-muted"
                          )}
                        >
                          <span className="text-lg font-mono">Ag</span>
                          <span className="text-[10px] text-muted-foreground">Mono</span>
                        </button>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleDuplicate} className="text-xs">
                        <Copy className="w-3.5 h-3.5 mr-2" />
                        Duplicate
                        <span className="ml-auto text-[10px] text-muted-foreground">Ctrl+D</span>
                      </DropdownMenuItem>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-xs">
                          <FolderInput className="w-3.5 h-3.5 mr-2" />
                          Move to
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent className="w-48 z-[100] max-h-64 overflow-y-auto">
                            {CATEGORIES.filter(c => c.id !== "all" && c.id !== "trash" && c.id !== selectedEntry?.category).map((cat) => {
                              const Icon = cat.icon;
                              return (
                                <DropdownMenuItem
                                  key={cat.id}
                                  onClick={() => selectedEntry && handleMoveToCategory(selectedEntry, cat.id)}
                                  className="text-xs"
                                >
                                  <Icon className="w-3.5 h-3.5 mr-2" />
                                  {cat.label}
                                </DropdownMenuItem>
                              );
                            })}
                            {customFolders.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                {customFolders.filter(f => f.id !== selectedEntry?.category).map((folder) => (
                                  <DropdownMenuItem
                                    key={folder.id}
                                    onClick={() => selectedEntry && handleMoveToCategory(selectedEntry, folder.id)}
                                    className="text-xs"
                                  >
                                    <FolderOpen className="w-3.5 h-3.5 mr-2" style={{ color: folder.color || 'currentColor' }} />
                                    {folder.label}
                                  </DropdownMenuItem>
                                ))}
                              </>
                            )}
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                      <DropdownMenuItem onClick={handleMoveToTrash} className="text-xs text-destructive">
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        Move to Trash
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <div className="flex items-center gap-2 text-xs">
                          <Type className="w-3.5 h-3.5" />
                          Small text
                        </div>
                        <Switch 
                          checked={isSmallText} 
                          onCheckedChange={setIsSmallText}
                          className="scale-75"
                        />
                      </div>
                      <DropdownMenuItem 
                        onClick={() => setIsFullWidth(true)} 
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Maximize2 className="w-3.5 h-3.5" />
                          Full width
                        </div>
                        <Switch 
                          checked={isFullWidth} 
                          onCheckedChange={() => setIsFullWidth(true)}
                          className="scale-75 pointer-events-none"
                        />
                      </DropdownMenuItem>
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <div className="flex items-center gap-2 text-xs">
                          <Lock className="w-3.5 h-3.5" />
                          Lock page
                        </div>
                        <Switch 
                          checked={isLocked} 
                          onCheckedChange={setIsLocked}
                          className="scale-75"
                        />
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleUndo} className="text-xs">
                        <Undo2 className="w-3.5 h-3.5 mr-2" />
                        Undo
                        <span className="ml-auto text-[10px] text-muted-foreground">Ctrl+Z</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleTranslate} className="text-xs">
                        <Languages className="w-3.5 h-3.5 mr-2" />
                        Translate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleSpellCheck} className="text-xs">
                        <SpellCheck className="w-3.5 h-3.5 mr-2" />
                        Spell Check
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleExport} className="text-xs">
                        <Download className="w-3.5 h-3.5 mr-2" />
                        Export
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" size="sm" onClick={handleSave} disabled={isLocked || isSelectedEntryInTrash} className="h-7 px-3 text-xs">
                    <Save className="w-3 h-3 mr-1" />
                    Save
                  </Button>
                </div>
              )}
            </motion.div>

            {/* Formatting Toolbar - Word-style */}
            {!isSelectedEntryInTrash && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className="flex items-center gap-1 px-4 py-2 border-b border-border/20 bg-muted/10"
              >
                {/* Font Selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 rounded hover:bg-muted text-xs gap-1 min-w-[120px] justify-between"
                      disabled={isLocked}
                    >
                      <span style={{ fontFamily: NOTEBOOK_FONTS.find(f => f.id === notebookFont)?.family }}>
                        {NOTEBOOK_FONTS.find(f => f.id === notebookFont)?.name || 'Inter'}
                      </span>
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto bg-background border border-border z-50">
                    {/* Sans Serif */}
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 bg-background">
                      Sans Serif
                    </div>
                    {NOTEBOOK_FONTS.filter(f => f.category === 'Sans Serif').map((font) => (
                      <DropdownMenuItem 
                        key={font.id}
                        onClick={() => onFontChange?.(font.id)}
                        className={cn("text-xs cursor-pointer", notebookFont === font.id && "bg-primary/10")}
                        style={{ fontFamily: font.family }}
                      >
                        {font.name}
                      </DropdownMenuItem>
                    ))}
                    {/* Serif */}
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 bg-background mt-1">
                      Serif
                    </div>
                    {NOTEBOOK_FONTS.filter(f => f.category === 'Serif').map((font) => (
                      <DropdownMenuItem 
                        key={font.id}
                        onClick={() => onFontChange?.(font.id)}
                        className={cn("text-xs cursor-pointer", notebookFont === font.id && "bg-primary/10")}
                        style={{ fontFamily: font.family }}
                      >
                        {font.name}
                      </DropdownMenuItem>
                    ))}
                    {/* Monospace */}
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 bg-background mt-1">
                      Monospace
                    </div>
                    {NOTEBOOK_FONTS.filter(f => f.category === 'Monospace').map((font) => (
                      <DropdownMenuItem 
                        key={font.id}
                        onClick={() => onFontChange?.(font.id)}
                        className={cn("text-xs cursor-pointer", notebookFont === font.id && "bg-primary/10")}
                        style={{ fontFamily: font.family }}
                      >
                        {font.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <div className="w-px h-5 bg-border/50 mx-1" />
                
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => document.execCommand('bold')}
                    className="h-7 w-7 p-0 rounded hover:bg-muted"
                    disabled={isLocked}
                    title="Bold (Ctrl+B)"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => document.execCommand('italic')}
                    className="h-7 w-7 p-0 rounded hover:bg-muted"
                    disabled={isLocked}
                    title="Italic (Ctrl+I)"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => document.execCommand('underline')}
                    className="h-7 w-7 p-0 rounded hover:bg-muted"
                    disabled={isLocked}
                    title="Underline (Ctrl+U)"
                  >
                    <Underline className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => document.execCommand('strikeThrough')}
                    className="h-7 w-7 p-0 rounded hover:bg-muted"
                    disabled={isLocked}
                    title="Strikethrough"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                
                <div className="w-px h-5 bg-border/50 mx-1" />
                
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => document.execCommand('justifyLeft')}
                    className="h-7 w-7 p-0 rounded hover:bg-muted"
                    disabled={isLocked}
                    title="Align Left"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => document.execCommand('justifyCenter')}
                    className="h-7 w-7 p-0 rounded hover:bg-muted"
                    disabled={isLocked}
                    title="Align Center"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => document.execCommand('justifyRight')}
                    className="h-7 w-7 p-0 rounded hover:bg-muted"
                    disabled={isLocked}
                    title="Align Right"
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
                
                <div className="w-px h-5 bg-border/50 mx-1" />
                
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => document.execCommand('insertUnorderedList')}
                    className="h-7 w-7 p-0 rounded hover:bg-muted"
                    disabled={isLocked}
                    title="Bullet List"
                  >
                    <List className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => document.execCommand('insertOrderedList')}
                    className="h-7 w-7 p-0 rounded hover:bg-muted"
                    disabled={isLocked}
                    title="Numbered List"
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                  </Button>
                </div>
                
                <div className="w-px h-5 bg-border/50 mx-1" />
                
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const url = prompt('Enter URL:');
                      if (url) document.execCommand('createLink', false, url);
                    }}
                    className="h-7 w-7 p-0 rounded hover:bg-muted"
                    disabled={isLocked}
                    title="Insert Link"
                  >
                    <Link className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => document.execCommand('formatBlock', false, 'blockquote')}
                    className="h-7 w-7 p-0 rounded hover:bg-muted"
                    disabled={isLocked}
                    title="Quote"
                  >
                    <Quote className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            )}

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
                  style={{ fontFamily: selectedFontFamily }}
                  onContextMenu={handleContextMenu}
                  className={cn(
                    "min-h-full p-4 pl-12 pr-12 outline-none focus:outline-none focus-visible:outline-none transition-all caret-primary",
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
          </motion.div>
        ) : (
          <motion.div 
            className="flex-1 flex flex-col overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* All Notes Header */}
            <div className="px-6 lg:px-10 py-5 border-b border-border/20">
              <motion.div 
                initial={{ opacity: 0, y: -15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="flex items-center justify-between gap-4"
              >
                {/* Category Filter Tabs */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="flex items-center gap-1 overflow-x-auto scrollbar-hide"
                >
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'daily-journal', label: 'Journal' },
                    { id: 'trading-plan', label: 'Plans' },
                    { id: 'trade-notes', label: 'Trades' },
                    { id: 'goals', label: 'Goals' },
                    { id: 'general', label: 'General' },
                  ].map((tab) => (
                    <motion.button
                      key={tab.id}
                      onClick={() => setSelectedCategory(tab.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className={cn(
                        "relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap",
                        selectedCategory === tab.id
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {tab.label}
                    </motion.button>
                  ))}
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="flex items-center gap-3 shrink-0"
                >
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="Search notes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-48 pl-9 h-9 bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 rounded-lg"
                    />
                  </div>
                  {/* View Toggle */}
                  <div className="flex items-center gap-0.5 p-1 rounded-lg bg-muted/40">
                    <button
                      onClick={() => { setViewMode('grid'); localStorage.setItem('notebook-view-mode', 'grid'); }}
                      className={cn(
                        "p-1.5 rounded-md transition-all duration-200",
                        viewMode === 'grid' 
                          ? "bg-background shadow-sm text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setViewMode('list'); localStorage.setItem('notebook-view-mode', 'list'); }}
                      className={cn(
                        "p-1.5 rounded-md transition-all duration-200",
                        viewMode === 'list' 
                          ? "bg-background shadow-sm text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <LayoutList className="w-4 h-4" />
                    </button>
                  </div>
                  <Button
                    onClick={handleNewNote}
                    variant="ghost"
                    className="text-primary hover:text-primary hover:bg-primary/5 font-medium"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add new note
                  </Button>
                </motion.div>
              </motion.div>
            </div>

            {/* Notes Grid/List */}
            <ScrollArea className="flex-1 px-6 lg:px-10 py-6">
              {(() => {
                const visibleEntries = notebookEntries
                  .filter(e => {
                    if (e.isDeleted) return false;
                    if (selectedCategory !== "all" && e.category !== selectedCategory) return false;
                    if (searchQuery) {
                      const query = searchQuery.toLowerCase();
                      return e.title.toLowerCase().includes(query) || 
                             e.content.toLowerCase().includes(query);
                    }
                    return true;
                  })
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

                if (visibleEntries.length === 0) {
                  return (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="flex flex-col items-center justify-center py-20 text-muted-foreground"
                    >
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 0.15 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                      >
                        {searchQuery ? <Search className="w-14 h-14 mb-4" /> : <BookOpen className="w-14 h-14 mb-4" />}
                      </motion.div>
                      <p className="text-base font-medium">{searchQuery ? 'No matching notes' : 'No notes yet'}</p>
                      <p className="text-sm mt-1 text-muted-foreground/70">{searchQuery ? 'Try a different search term' : 'Create your first note to get started'}</p>
                    </motion.div>
                  );
                }

                return (
                  <AnimatePresence mode="wait">
                    <motion.div 
                      key={selectedCategory + viewMode}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className={cn(
                        viewMode === 'grid' 
                          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" 
                          : "flex flex-col gap-2"
                      )}
                    >
                      {visibleEntries.map((entry, index) => {
                        const colors = getNoteCardColor(entry.category, index);
                        const plainText = entry.content.replace(/<[^>]*>/g, '').trim();
                        const contentLines = plainText.split(/[.!?\n]+/).filter(s => s.trim()).slice(0, 3);
                        const isDark = document.documentElement.classList.contains('dark');
                        
                        return (
                          <motion.button
                            key={entry.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ 
                              opacity: 1, 
                              y: 0,
                              transition: {
                                delay: index * 0.03,
                                type: "spring",
                                stiffness: 400,
                                damping: 28
                              }
                            }}
                            whileHover={{ 
                              y: viewMode === 'grid' ? -4 : 0,
                              transition: { type: "spring", stiffness: 500, damping: 25 } 
                            }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => { setSelectedEntryId(entry.id); setIsCreatingNew(false); }}
                            className={cn(
                              "text-left rounded-xl overflow-hidden group relative border transition-all duration-300",
                              viewMode === 'grid' 
                                ? "flex flex-col" 
                                : "flex items-start gap-4 p-4"
                            )}
                            style={{
                              backgroundColor: isDark ? colors.bgDark : colors.bg,
                              borderColor: isDark ? colors.borderDark : colors.border,
                            }}
                          >
                            {viewMode === 'grid' ? (
                              <>
                                {/* Color accent bar - top */}
                                <div 
                                  className="h-1 w-full"
                                  style={{ backgroundColor: colors.accent }}
                                />
                                
                                <div className="p-4 flex flex-col flex-1 gap-2">
                                  {/* Date */}
                                  <p className="text-[11px] text-muted-foreground font-medium">
                                    {new Date(entry.date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                  </p>
                                  
                                  {/* Title */}
                                  <h3 className="font-semibold text-foreground leading-snug line-clamp-2 text-[15px]">
                                    {entry.title || 'Untitled'}
                                  </h3>
                                  
                                  {/* Content Preview */}
                                  <div className="flex-1 space-y-1 mt-1">
                                    {contentLines.length > 0 ? (
                                      contentLines.map((line, i) => (
                                        <div 
                                          key={i}
                                          className="flex items-start gap-2 text-[13px] text-muted-foreground leading-relaxed"
                                        >
                                          <span className="text-muted-foreground/50 mt-0.5 shrink-0">•</span>
                                          <span className="line-clamp-1">{line.trim()}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-[13px] text-muted-foreground/50 italic">No content...</p>
                                    )}
                                  </div>
                                  
                                  {/* Trade indicator */}
                                  {entry.tradeId && (
                                    <div className="mt-2 pt-2 border-t" style={{ borderColor: isDark ? colors.borderDark : colors.border }}>
                                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-border/50 bg-background/50">
                                        <TrendingUp className="w-2.5 h-2.5 mr-1" />
                                        Linked Trade
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                {/* List View */}
                                <div 
                                  className="w-1 h-12 rounded-full shrink-0 self-center"
                                  style={{ backgroundColor: colors.accent }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <h3 className="font-semibold text-foreground truncate text-sm">
                                      {entry.title || 'Untitled'}
                                    </h3>
                                    {entry.tradeId && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-background/50 shrink-0 border-border/50">
                                        <TrendingUp className="w-2.5 h-2.5 mr-1" />
                                        Trade
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[13px] text-muted-foreground line-clamp-1">
                                    {plainText || 'No content...'}
                                  </p>
                                </div>
                                <div className="text-xs text-muted-foreground shrink-0">
                                  {new Date(entry.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
                                </div>
                              </>
                            )}
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  </AnimatePresence>
                );
              })()}
            </ScrollArea>
          </motion.div>
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
              {linkedChecklist && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Checklist</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary max-w-[80px] truncate">
                      {linkedChecklist.name}
                    </Badge>
                  </div>
                  
                  {/* Checklist Grade */}
                  {linkedTrade.checklistState && linkedTrade.checklistState.length > 0 && (() => {
                    const state = linkedTrade.checklistState;
                    const hasCustomPercentages = state.some((item: any) => item.percentage !== undefined);
                    let percentage: number;
                    
                    if (hasCustomPercentages) {
                      percentage = state
                        .filter((item: any) => item.checked)
                        .reduce((sum: number, item: any) => sum + (item.percentage || 0), 0);
                    } else {
                      const checkedCount = state.filter((item: any) => item.checked).length;
                      percentage = (checkedCount / state.length) * 100;
                    }
                    
                    const getGrade = (p: number) => {
                      if (p >= 90) return { grade: "A Setup", color: "text-emerald-500", bgColor: "bg-emerald-500/20" };
                      if (p >= 75) return { grade: "B Setup", color: "text-blue-500", bgColor: "bg-blue-500/20" };
                      if (p >= 60) return { grade: "C Setup", color: "text-yellow-500", bgColor: "bg-yellow-500/20" };
                      return { grade: "D Setup", color: "text-red-500", bgColor: "bg-red-500/20" };
                    };
                    
                    const { grade, color, bgColor } = getGrade(percentage);
                    
                    return (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Grade</span>
                        <Badge className={cn("text-[10px] px-1.5 py-0 border-0", bgColor, color)}>
                          {grade}
                        </Badge>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
            
            {/* Checklist Details */}
            {linkedTrade.checklistState && linkedTrade.checklistState.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-2">Checklist Items</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {linkedTrade.checklistState.map((item: any, index: number) => (
                    <div 
                      key={item.id || index}
                      className={cn(
                        "flex items-center gap-1.5 text-[10px]",
                        item.checked ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      <div className={cn(
                        "w-3 h-3 rounded-sm border flex items-center justify-center shrink-0",
                        item.checked 
                          ? "bg-primary/20 border-primary/50" 
                          : "border-border"
                      )}>
                        {item.checked && (
                          <CheckSquare className="w-2 h-2 text-primary" />
                        )}
                      </div>
                      <span className={cn(item.checked && "line-through")}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trade Chart Image */}
            {linkedTrade.chartImage && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-2">Chart</div>
                <img
                  src={linkedTrade.chartImage}
                  alt="Trade chart"
                  className="w-full rounded-lg border border-border/30 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setImagePreview(linkedTrade.chartImage!)}
                />
              </div>
            )}
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

      {/* Image Preview Modal */}
      {imagePreview && (
        <div 
          className={cn(
            "fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md transition-all duration-300",
            isImagePreviewClosing ? "opacity-0" : "opacity-100"
          )}
          onClick={() => {
            setIsImagePreviewClosing(true);
            setTimeout(() => {
              setImagePreview(null);
              setIsImagePreviewClosing(false);
            }, 300);
          }}
        >
          <div 
            className={cn(
              "relative max-w-[90vw] max-h-[90vh] transition-all duration-300 ease-out",
              isImagePreviewClosing 
                ? "scale-90 opacity-0 translate-y-4" 
                : "scale-100 opacity-100 translate-y-0"
            )}
            style={{
              animation: !isImagePreviewClosing ? 'imageZoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined
            }}
          >
            <img
              src={imagePreview}
              alt="Trade chart preview"
              className="max-w-full max-h-[90vh] rounded-xl border border-border/50 shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-transform hover:scale-110"
              onClick={(e) => {
                e.stopPropagation();
                setIsImagePreviewClosing(true);
                setTimeout(() => {
                  setImagePreview(null);
                  setIsImagePreviewClosing(false);
                }, 300);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes imageZoomIn {
          0% {
            opacity: 0;
            transform: scale(0.8) translateY(20px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>

      {/* Right-click Context Menu for Text Color/Highlight */}
      <AnimatePresence>
        {contextMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 25, duration: 0.2 }}
            className="fixed z-[9999] bg-background/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl p-1.5 min-w-[180px]"
            style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted/80 rounded-lg transition-all duration-200"
              onClick={() => setShowTextColorPicker(!showTextColorPicker)}
            >
              <Type className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 text-left">Text Color</span>
              <motion.div
                animate={{ rotate: showTextColorPicker ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </motion.div>
            </motion.button>
            <AnimatePresence>
              {showTextColorPicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-1.5 p-2 border-t border-border/30 mt-1">
                    {TEXT_COLORS.map((color, index) => (
                      <motion.button
                        key={color.id}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.03 }}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => applyTextColor(color.color)}
                        className="w-7 h-7 rounded-lg border border-border/50 shadow-sm hover:shadow-md transition-shadow"
                        style={{ backgroundColor: color.id === 'default' ? 'transparent' : color.color }}
                        title={color.label}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted/80 rounded-lg transition-all duration-200"
              onClick={() => setShowHighlightColorPicker(!showHighlightColorPicker)}
            >
              <div className="w-4 h-4 rounded bg-gradient-to-br from-yellow-300/60 to-yellow-400/60" />
              <span className="flex-1 text-left">Highlight</span>
              <motion.div
                animate={{ rotate: showHighlightColorPicker ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </motion.div>
            </motion.button>
            <AnimatePresence>
              {showHighlightColorPicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-1.5 p-2 border-t border-border/30 mt-1">
                    {HIGHLIGHT_COLORS.map((color, index) => (
                      <motion.button
                        key={color.id}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.03 }}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => applyHighlightColor(color.color)}
                        className="w-7 h-7 rounded-lg border border-border/50 shadow-sm hover:shadow-md transition-shadow"
                        style={{ backgroundColor: color.color }}
                        title={color.label}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}