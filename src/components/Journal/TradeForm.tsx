import { useState, useEffect } from "react";
import { Trade } from "@/types/trade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Trash2 } from "lucide-react";

interface TradeFormProps {
  editingTrade: Trade | null;
  onSubmit: (trade: Omit<Trade, 'id'>) => void;
  onCancelEdit: () => void;
  onClearAll: () => void;
}

export function TradeForm({ editingTrade, onSubmit, onCancelEdit, onClearAll }: TradeFormProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    pair: '',
    direction: 'Long' as 'Long' | 'Short',
    result: '',
    session: '',
    strategy: '',
    notes: '',
  });

  useEffect(() => {
    if (editingTrade) {
      setFormData({
        date: editingTrade.date,
        pair: editingTrade.pair,
        direction: editingTrade.direction,
        result: editingTrade.result.toString(),
        session: editingTrade.session || '',
        strategy: editingTrade.strategy || '',
        notes: editingTrade.notes || '',
      });
    }
  }, [editingTrade]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      date: formData.date,
      pair: formData.pair,
      direction: formData.direction,
      result: parseFloat(formData.result) || 0,
      session: formData.session,
      strategy: formData.strategy,
      notes: formData.notes,
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
      strategy: '',
      notes: '',
    });
  };

  return (
    <div className="glass rounded-2xl p-5 border border-border/40 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">
            {editingTrade ? 'Edit Trade' : 'New Trade'}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Log each trade with quick context</p>
        </div>
        <Badge variant="outline" className="border-primary/40 text-muted-foreground text-xs">
          Journal
        </Badge>
      </div>

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

          <div className="space-y-2">
            <Label htmlFor="pair" className="text-xs text-muted-foreground">Pair / Asset</Label>
            <Input
              id="pair"
              type="text"
              placeholder="XAUUSD, EURUSD..."
              value={formData.pair}
              onChange={(e) => setFormData(prev => ({ ...prev, pair: e.target.value }))}
              className="bg-muted/50 border-border/50 focus:border-primary/50"
              required
            />
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="strategy" className="text-xs text-muted-foreground">Setup / Strategy</Label>
            <Input
              id="strategy"
              type="text"
              placeholder="ATP break & retest..."
              value={formData.strategy}
              onChange={(e) => setFormData(prev => ({ ...prev, strategy: e.target.value }))}
              className="bg-muted/50 border-border/50 focus:border-primary/50"
            />
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

        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClearAll}
            className="text-xs border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Clear All
          </Button>

          <div className="flex gap-2">
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
        </div>
      </form>
    </div>
  );
}
