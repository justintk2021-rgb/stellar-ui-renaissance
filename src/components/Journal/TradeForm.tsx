import { useState, useEffect, useRef } from "react";
import { Trade } from "@/types/trade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ImagePlus, Trash2, ClipboardList, ChevronDown } from "lucide-react";
import { useChecklists } from "@/hooks/useChecklists";
import { cn } from "@/lib/utils";

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

interface TradeFormProps {
  editingTrade: Trade | null;
  onSubmit: (trade: Omit<Trade, 'id'>) => void;
  onCancelEdit: () => void;
}

export function TradeForm({ editingTrade, onSubmit, onCancelEdit }: TradeFormProps) {
  const { checklists, isAuthenticated } = useChecklists();
  const [isExpanded, setIsExpanded] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    pair: '',
    direction: 'Long' as 'Long' | 'Short',
    result: '',
    session: '',
    notes: '',
    checklistId: '',
  });
  const [chartImage, setChartImage] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-expand when editing a trade
  useEffect(() => {
    if (editingTrade) {
      setIsExpanded(true);
    }
  }, [editingTrade]);

  // Click outside to collapse
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        if (!editingTrade) {
          setIsExpanded(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingTrade]);

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
    }
  }, [editingTrade]);

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
    });
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      pair: '',
      direction: 'Long',
      result: '',
      session: '',
      notes: '',
      checklistId: '',
    });
    setChartImage(undefined);
  };

  return (
    <div 
      ref={formRef}
      className={cn(
        "glass rounded-2xl border border-border/40 shadow-card transition-all duration-300 ease-out overflow-hidden",
        isExpanded 
          ? "p-5 ring-2 ring-primary/20 shadow-glow-sm" 
          : "p-4 hover:border-primary/30 hover:shadow-md cursor-pointer"
      )}
      onMouseEnter={() => !isExpanded && setIsExpanded(true)}
    >
      {/* Header - Always visible */}
      <div 
        className={cn(
          "flex items-center justify-between transition-all duration-200",
          isExpanded ? "mb-4" : "mb-0"
        )}
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center transition-all duration-300",
            isExpanded ? "scale-100" : "scale-90"
          )}>
            <Plus className={cn(
              "w-4 h-4 text-primary transition-transform duration-300",
              isExpanded ? "rotate-0" : "rotate-0"
            )} />
          </div>
          <div>
            <h3 className="text-base font-semibold">
              {editingTrade ? 'Edit Trade' : 'New Trade'}
            </h3>
            {!isExpanded && (
              <p className="text-xs text-muted-foreground mt-0.5 animate-fade-in">
                Hover to expand • Click to add trade
              </p>
            )}
            {isExpanded && (
              <p className="text-xs text-muted-foreground mt-0.5 animate-fade-in">
                Log each trade with quick context
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/40 text-muted-foreground text-xs">
            Journal
          </Badge>
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-300",
            isExpanded ? "rotate-180" : "rotate-0"
          )} />
        </div>
      </div>

      {/* Form Content - Collapsible */}
      <div className={cn(
        "transition-all duration-300 ease-out",
        isExpanded 
          ? "max-h-[1000px] opacity-100" 
          : "max-h-0 opacity-0 pointer-events-none"
      )}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <SelectContent>
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
          <div className="space-y-2">
            <Label htmlFor="checklist" className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ClipboardList className="w-3 h-3" />
              Checklist Used
            </Label>
            <Select
              value={formData.checklistId || "none"}
              onValueChange={(value) => setFormData(prev => ({ ...prev, checklistId: value === "none" ? "" : value }))}
              disabled={!isAuthenticated || checklists.length === 0}
            >
              <SelectTrigger className="bg-muted/50 border-border/50 focus:border-primary/50">
                <SelectValue placeholder={!isAuthenticated ? "Login required" : checklists.length === 0 ? "No checklists" : "Select checklist..."} />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="none">None</SelectItem>
                {checklists.map((checklist) => (
                  <SelectItem key={checklist.id} value={checklist.id}>
                    {checklist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                className="w-full h-40 object-cover"
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
              className="w-full h-24 border-2 border-dashed border-border/50 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Click to upload chart image</span>
            </button>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
          {editingTrade && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancelEdit}
              className="text-xs border-border/50"
            >
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            className="bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90 shadow-glow-sm text-xs font-semibold"
          >
            <Plus className="w-3 h-3 mr-1" />
            {editingTrade ? 'Update Trade' : 'Add Trade'}
          </Button>
        </div>
        </form>
      </div>
    </div>
  );
}
