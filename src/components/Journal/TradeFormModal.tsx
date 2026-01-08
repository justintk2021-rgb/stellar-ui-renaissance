import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Trade, ChecklistItemState } from "@/types/trade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, X, ImagePlus, Trash2, ClipboardList, Award, GitBranch, ListChecks } from "lucide-react";
import { useChecklists, GradeCriteria } from "@/hooks/useChecklists";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ChecklistPopup } from "./ChecklistPopup";
import { Badge } from "@/components/ui/badge";
import { getGradeFromCriteria } from "@/lib/gradeUtils";

// Common trading pairs and assets
const TRADING_PAIRS = [
  // Forex Majors
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD",
  // Forex Crosses
  "EURGBP", "EURJPY", "GBPJPY", "AUDJPY", "CADJPY", "CHFJPY", "NZDJPY",
  "EURAUD", "EURCHF", "EURCAD", "EURNZD", "GBPAUD", "GBPCAD", "GBPCHF", "GBPNZD",
  "AUDCAD", "AUDCHF", "AUDNZD", "CADCHF", "NZDCAD", "NZDCHF",
  // Commodities
  "XAUUSD", "XAGUSD", "XAUEUR", "XAGEUR", "USOIL", "UKOIL", "NATGAS",
  // Indices
  "US30", "US100", "US500", "GER40", "UK100", "FRA40", "JPN225", "AUS200",
  "NAS100", "SPX500", "DJ30",
  // Crypto
  "BTCUSD", "ETHUSD", "XRPUSD", "LTCUSD", "BCHUSD", "ADAUSD", "DOTUSD", "SOLUSD",
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT", "AVAXUSDT",
  // Stocks (popular)
  "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "AMD", "NFLX", "DIS",
];

interface PairAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
}

function PairAutocomplete({ value, onChange }: PairAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredPairs, setFilteredPairs] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.length > 0) {
      const filtered = TRADING_PAIRS.filter(pair =>
        pair.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 8);
      setFilteredPairs(filtered);
      setIsOpen(filtered.length > 0);
    } else {
      setFilteredPairs([]);
      setIsOpen(false);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (pair: string) => {
    onChange(pair);
    setIsOpen(false);
  };

  return (
    <div className="space-y-2 relative" ref={wrapperRef}>
      <Label htmlFor="pair" className="text-xs text-muted-foreground">Pair / Asset</Label>
      <Input
        id="pair"
        type="text"
        placeholder="XAUUSD, EURUSD..."
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onFocus={() => value.length > 0 && filteredPairs.length > 0 && setIsOpen(true)}
        className="bg-muted/50 border-border/50 focus:border-primary/50"
        autoComplete="off"
        required
      />
      {isOpen && filteredPairs.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {filteredPairs.map((pair) => (
            <button
              key={pair}
              type="button"
              onClick={() => handleSelect(pair)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted/80 transition-colors flex items-center justify-between"
            >
              <span className="font-medium">{pair}</span>
              <span className="text-xs text-muted-foreground">
                {pair.includes("USD") && !pair.includes("USDT") ? "Forex" : 
                 pair.includes("USDT") ? "Crypto" :
                 pair.includes("XAU") || pair.includes("XAG") || pair.includes("OIL") || pair.includes("GAS") ? "Commodity" :
                 pair.match(/^US\d|^GER|^UK|^FRA|^JPN|^AUS|^NAS|^SPX|^DJ/) ? "Index" : "Stock"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface TradeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTrade: Trade | null;
  onSubmit: (trade: Omit<Trade, 'id'>) => void;
  onCancelEdit: () => void;
  initialDate?: string; // Optional initial date for the trade
}

export function TradeFormModal({ isOpen, onClose, editingTrade, onSubmit, onCancelEdit, initialDate }: TradeFormModalProps) {
  const { checklists, isAuthenticated } = useChecklists();
  const [formData, setFormData] = useState({
    date: initialDate || new Date().toISOString().slice(0, 10),
    pair: '',
    direction: 'Long' as 'Long' | 'Short',
    result: '',
    session: '',
    notes: '',
    checklistId: '',
  });
  const [chartImage, setChartImage] = useState<string | undefined>(undefined);
  const [checklistState, setChecklistState] = useState<ChecklistItemState[] | undefined>(undefined);
  const [showChecklistPopup, setShowChecklistPopup] = useState(false);
  const [pendingChecklistId, setPendingChecklistId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to get grade from checklist state
  const getGradeFromState = (state?: ChecklistItemState[], gradeCriteria?: GradeCriteria): { grade: string; color: string; percentage: number } | null => {
    if (!state || state.length === 0) return null;
    
    const result = getGradeFromCriteria(state, gradeCriteria);
    return { grade: result.gradeLabel, color: result.color, percentage: result.percentage };
  };

  useEffect(() => {
    if (editingTrade) {
      setFormData({
        date: editingTrade.date,
        pair: editingTrade.pair,
        direction: editingTrade.direction,
        result: editingTrade.result.toString(),
        session: editingTrade.session || '',
        notes: editingTrade.notes || '',
        checklistId: editingTrade.checklistId || '',
      });
      setChartImage(editingTrade.chartImage);
      setChecklistState(editingTrade.checklistState);
    } else {
      resetForm();
    }
  }, [editingTrade, isOpen]);

  // Update date when initialDate changes (e.g., opening from calendar)
  useEffect(() => {
    if (!editingTrade && initialDate) {
      setFormData(prev => ({ ...prev, date: initialDate }));
    }
  }, [initialDate, editingTrade]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setChartImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      date: formData.date,
      pair: formData.pair,
      direction: formData.direction,
      result: parseFloat(formData.result) || 0,
      session: formData.session,
      notes: formData.notes,
      chartImage: chartImage,
      checklistId: formData.checklistId || undefined,
      checklistState: checklistState,
    });
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setFormData({
      date: initialDate || new Date().toISOString().slice(0, 10),
      pair: '',
      direction: 'Long',
      result: '',
      session: '',
      notes: '',
      checklistId: '',
    });
    setChartImage(undefined);
    setChecklistState(undefined);
  };

  // Handle checklist selection - opens popup
  const handleChecklistSelect = (checklistId: string) => {
    if (checklistId === "none") {
      setFormData(prev => ({ ...prev, checklistId: "" }));
      setChecklistState(undefined);
      return;
    }
    
    setPendingChecklistId(checklistId);
    setShowChecklistPopup(true);
  };

  // Handle checklist popup confirmation
  const handleChecklistConfirm = (items: ChecklistItemState[]) => {
    if (pendingChecklistId) {
      setFormData(prev => ({ ...prev, checklistId: pendingChecklistId }));
      setChecklistState(items);
      setPendingChecklistId(null);
    }
  };

  const selectedChecklist = checklists.find(c => c.id === (pendingChecklistId || formData.checklistId));
  const currentGrade = getGradeFromState(checklistState, selectedChecklist?.gradeCriteria);

  const handleClose = () => {
    if (editingTrade) {
      onCancelEdit();
    }
    onClose();
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg bg-card rounded-2xl border border-border/40 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">
                      {editingTrade ? 'Edit Trade' : 'New Trade'}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Log each trade with quick context
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-8 w-8 rounded-full hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-xs text-muted-foreground">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="bg-muted/50 border-border/50 focus:border-primary/50"
                      required
                    />
                  </div>

                  <PairAutocomplete
                    value={formData.pair}
                    onChange={(value) => setFormData(prev => ({ ...prev, pair: value }))}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="direction" className="text-xs text-muted-foreground">Direction</Label>
                    <Select
                      value={formData.direction}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, direction: value as 'Long' | 'Short' }))}
                    >
                      <SelectTrigger className="bg-muted/50 border-border/50 focus:border-primary/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        <SelectItem value="Long">Long</SelectItem>
                        <SelectItem value="Short">Short</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="result" className="text-xs text-muted-foreground">Result (P/L)</Label>
                    <Input
                      id="result"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 45.5 or -20"
                      value={formData.result}
                      onChange={(e) => setFormData(prev => ({ ...prev, result: e.target.value }))}
                      className="bg-muted/50 border-border/50 focus:border-primary/50 font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="session" className="text-xs text-muted-foreground">Session (optional)</Label>
                    <Input
                      id="session"
                      type="text"
                      placeholder="London, NY, Asia..."
                      value={formData.session}
                      onChange={(e) => setFormData(prev => ({ ...prev, session: e.target.value }))}
                      className="bg-muted/50 border-border/50 focus:border-primary/50"
                    />
                  </div>

                  {/* Checklist Selector */}
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="checklist" className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <ClipboardList className="w-3 h-3" />
                      Checklist Used
                    </Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={formData.checklistId || "none"}
                        onValueChange={handleChecklistSelect}
                        disabled={!isAuthenticated || checklists.length === 0}
                      >
                        <SelectTrigger className="bg-muted/50 border-border/50 focus:border-primary/50 flex-1">
                          <SelectValue placeholder={!isAuthenticated ? "Login required" : checklists.length === 0 ? "No checklists" : "Select checklist..."} />
                        </SelectTrigger>
                        <SelectContent className="z-[200] bg-popover">
                          <SelectItem value="none">None</SelectItem>
                          {checklists.map((checklist) => (
                            <SelectItem key={checklist.id} value={checklist.id}>
                              <div className="flex items-center gap-2">
                                {checklist.type === "conditional" ? (
                                  <GitBranch className="w-3.5 h-3.5 text-amber-500" />
                                ) : (
                                  <ListChecks className="w-3.5 h-3.5 text-primary" />
                                )}
                                <span>{checklist.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formData.checklistId && currentGrade && (
                        <Badge className={cn("shrink-0 gap-1", currentGrade.color, "bg-muted/50 border-border/50")}>
                          <Award className="w-3 h-3" />
                          {currentGrade.grade}
                        </Badge>
                      )}
                    </div>
                    {formData.checklistId && checklistState && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPendingChecklistId(formData.checklistId);
                          setShowChecklistPopup(true);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ClipboardList className="w-3 h-3 mr-1" />
                        Edit checklist ({checklistState.filter(i => i.checked).length}/{checklistState.length} checked)
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-xs text-muted-foreground">Quick Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Short note about the trade..."
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="bg-muted/50 border-border/50 focus:border-primary/50 min-h-[80px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Trade Screenshot (optional)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  {chartImage ? (
                    <div className="relative rounded-lg overflow-hidden border border-border/50 bg-muted/30">
                      <img
                        src={chartImage}
                        alt="Trade chart"
                        className="w-full h-32 object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7"
                        onClick={() => setChartImage(undefined)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-20 border-2 border-dashed border-border/50 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    >
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Click to upload chart image</span>
                    </button>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-border/30">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleClose}
                    className="text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:opacity-90 shadow-glow-sm text-sm font-semibold"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {editingTrade ? 'Update Trade' : 'Add Trade'}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Use portal to render at document body level
  return (
    <>
      {createPortal(modalContent, document.body)}
      
      {/* Checklist Popup */}
      {selectedChecklist && (
        <ChecklistPopup
          isOpen={showChecklistPopup}
          onClose={() => {
            setShowChecklistPopup(false);
            setPendingChecklistId(null);
          }}
          checklist={selectedChecklist}
          onConfirm={handleChecklistConfirm}
          initialState={formData.checklistId === pendingChecklistId ? checklistState : undefined}
        />
      )}
    </>
  );
}
