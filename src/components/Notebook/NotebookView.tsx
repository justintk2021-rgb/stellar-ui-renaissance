import { Trade } from "@/types/trade";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRef, useEffect } from "react";
import { Bold, List, Heading1, Save } from "lucide-react";
import { toast } from "sonner";

interface NotebookViewProps {
  trades: Trade[];
  selectedTradeId: string | null;
  onSelectTrade: (id: string) => void;
  onSaveNotes: (id: string, notes: string) => void;
}

export function NotebookView({ trades, selectedTradeId, onSelectTrade, onSaveNotes }: NotebookViewProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectedTrade = trades.find((t) => t.id === selectedTradeId);

  useEffect(() => {
    if (editorRef.current && selectedTrade) {
      if (selectedTrade.notebook?.trim()) {
        editorRef.current.innerHTML = selectedTrade.notebook;
      } else {
        editorRef.current.innerHTML = `
          <h3>📋 Plan</h3>
          <ul><li>Why did I take this trade?</li></ul>
          <h3>⚙ Execution</h3>
          <ul><li>Entry, management, exit.</li></ul>
          <h3>🧠 Review</h3>
          <ul><li>What did I learn?</li></ul>
        `;
      }
    }
  }, [selectedTrade]);

  const execCommand = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const handleSave = () => {
    if (!selectedTradeId || !editorRef.current) return;
    onSaveNotes(selectedTradeId, editorRef.current.innerHTML);
    toast.success("Notes saved!");
  };

  const pl = selectedTrade?.result || 0;
  const isProfit = pl >= 0;

  return (
    <div className="glass rounded-2xl p-5 border border-border/40 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Notebook</h3>
          <p className="text-xs text-muted-foreground mt-1">Detailed notes per trade</p>
        </div>
        <Badge variant="outline" className="border-primary/40 text-muted-foreground text-xs">
          Notes
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.4fr] gap-4">
        {/* Trade list */}
        <div className="rounded-xl border border-secondary/30 overflow-hidden h-[300px] bg-card">
          <div className="px-3 py-2.5 border-b border-secondary/30 bg-muted/30 flex justify-between items-center">
            <span className="text-xs font-medium">Trades</span>
            <span className="text-[10px] text-muted-foreground">Select one →</span>
          </div>
          <div className="overflow-y-auto h-[calc(100%-40px)] custom-scrollbar p-2">
            {trades.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-4">
                No trades yet. Add one in Journal.
              </div>
            ) : (
              trades.map((trade) => {
                const tpl = trade.result || 0;
                const tIsProfit = tpl >= 0;
                const isActive = trade.id === selectedTradeId;

                return (
                  <div
                    key={trade.id}
                    onClick={() => onSelectTrade(trade.id)}
                    className={cn(
                      "rounded-lg p-3 mb-2 cursor-pointer border transition-all duration-200",
                      isActive
                        ? "bg-gradient-to-r from-primary/20 to-secondary/10 border-primary/50"
                        : "border-transparent hover:bg-primary/10 hover:border-primary/30"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-medium">{trade.date || '-'}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {trade.pair || '-'} • {trade.direction}
                        </div>
                      </div>
                      <span className={cn(
                        "text-sm font-bold font-mono",
                        tIsProfit ? "text-primary" : "text-destructive"
                      )}>
                        {tIsProfit ? '+' : ''}{tpl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="rounded-xl border border-secondary/30 p-4 flex flex-col h-[300px] bg-card">
          {selectedTrade ? (
            <>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold">
                    {selectedTrade.pair} • {selectedTrade.date}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Direction: {selectedTrade.direction} • Session: {selectedTrade.session || 'n/a'}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono text-xs",
                    isProfit
                      ? "border-primary/50 text-primary bg-primary/10"
                      : "border-destructive/50 text-destructive bg-destructive/10"
                  )}
                >
                  P/L {isProfit ? '+' : ''}{pl.toFixed(2)}
                </Badge>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-[10px] border-border/50">
                  Setup: {selectedTrade.strategy || 'n/a'}
                </Badge>
              </div>

              <div className="flex gap-1 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => execCommand('bold')}
                  className="w-7 h-7 p-0 border-secondary/50 hover:border-primary/50 hover:bg-primary/10"
                >
                  <Bold className="w-3 h-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => execCommand('insertUnorderedList')}
                  className="w-7 h-7 p-0 border-secondary/50 hover:border-primary/50 hover:bg-primary/10"
                >
                  <List className="w-3 h-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => execCommand('formatBlock', 'h3')}
                  className="w-7 h-7 p-0 border-secondary/50 hover:border-primary/50 hover:bg-primary/10"
                >
                  <Heading1 className="w-3 h-3" />
                </Button>
              </div>

              <div
                ref={editorRef}
                contentEditable
                className="flex-1 rounded-lg border border-dashed border-border/50 p-3 text-sm overflow-y-auto custom-scrollbar bg-muted/20 focus:outline-none focus:border-primary/50 focus:border-solid [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:ml-4 [&_li]:text-muted-foreground"
              />

              <div className="flex justify-end mt-3">
                <Button
                  onClick={handleSave}
                  className="bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90 shadow-glow-sm text-xs font-semibold"
                >
                  <Save className="w-3 h-3 mr-1" />
                  Save Notes
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a trade from the left to view notes
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
