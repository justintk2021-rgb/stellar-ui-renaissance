import { useState, useMemo } from "react";
import { Calculator, DollarSign, Percent, TrendingDown, BarChart3, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";

// Common currency pairs with their pip values (for standard lot = 100,000 units)
const currencyPairs = [
  { pair: "EUR/USD", pipValue: 10 },
  { pair: "GBP/USD", pipValue: 10 },
  { pair: "USD/JPY", pipValue: 9.10 },
  { pair: "USD/CHF", pipValue: 10.15 },
  { pair: "AUD/USD", pipValue: 10 },
  { pair: "NZD/USD", pipValue: 10 },
  { pair: "USD/CAD", pipValue: 7.63 },
  { pair: "EUR/GBP", pipValue: 12.70 },
  { pair: "EUR/JPY", pipValue: 9.10 },
  { pair: "GBP/JPY", pipValue: 9.10 },
  { pair: "XAU/USD", pipValue: 10 },
  { pair: "Custom", pipValue: 10 },
];

function AnimatedResult({ value, prefix = "", suffix = "", decimals = 2, className = "" }: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const { formattedValue, isAnimating } = useCountUp({
    end: value,
    duration: 800,
    decimals,
    prefix,
    suffix
  });

  return (
    <span className={cn(className, "transition-transform duration-200", isAnimating && "scale-105")}>
      {formattedValue}
    </span>
  );
}

export function LotSizeCalculator() {
  const [accountBalance, setAccountBalance] = useState<string>("10000");
  const [riskPercentage, setRiskPercentage] = useState<string>("1");
  const [stopLossPips, setStopLossPips] = useState<string>("50");
  const [selectedPair, setSelectedPair] = useState<string>("EUR/USD");
  const [customPipValue, setCustomPipValue] = useState<string>("10");

  const calculations = useMemo(() => {
    const balance = parseFloat(accountBalance) || 0;
    const riskPercent = parseFloat(riskPercentage) || 0;
    const slPips = parseFloat(stopLossPips) || 0;
    
    const pairData = currencyPairs.find(p => p.pair === selectedPair);
    const pipValue = selectedPair === "Custom" 
      ? (parseFloat(customPipValue) || 10) 
      : (pairData?.pipValue || 10);

    // Risk amount in dollars
    const riskAmount = (balance * riskPercent) / 100;

    // Lot size calculation: Risk Amount / (Stop Loss in Pips × Pip Value)
    const lotSize = slPips > 0 ? riskAmount / (slPips * pipValue) : 0;

    // Mini lots (0.1) and micro lots (0.01)
    const miniLots = lotSize * 10;
    const microLots = lotSize * 100;

    // Position size in units
    const positionUnits = lotSize * 100000;

    // Potential loss at stop loss
    const potentialLoss = lotSize * slPips * pipValue;

    return {
      riskAmount,
      lotSize: Math.max(0, lotSize),
      miniLots: Math.max(0, miniLots),
      microLots: Math.max(0, microLots),
      positionUnits: Math.max(0, positionUnits),
      potentialLoss: Math.max(0, potentialLoss),
      pipValue
    };
  }, [accountBalance, riskPercentage, stopLossPips, selectedPair, customPipValue]);

  const handleReset = () => {
    setAccountBalance("10000");
    setRiskPercentage("1");
    setStopLossPips("50");
    setSelectedPair("EUR/USD");
    setCustomPipValue("10");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Calculator className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Lot Size Calculator</h2>
            <p className="text-xs text-muted-foreground">Calculate position size based on risk</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="glass rounded-xl p-5 border border-border/40 space-y-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Trade Parameters
          </h3>

          {/* Account Balance */}
          <div className="space-y-2">
            <Label htmlFor="balance" className="text-xs uppercase tracking-wider text-muted-foreground">
              Account Balance ($)
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="balance"
                type="number"
                value={accountBalance}
                onChange={(e) => setAccountBalance(e.target.value)}
                className="pl-9 font-mono"
                placeholder="10000"
              />
            </div>
          </div>

          {/* Risk Percentage */}
          <div className="space-y-2">
            <Label htmlFor="risk" className="text-xs uppercase tracking-wider text-muted-foreground">
              Risk Per Trade (%)
            </Label>
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="risk"
                type="number"
                value={riskPercentage}
                onChange={(e) => setRiskPercentage(e.target.value)}
                className="pl-9 font-mono"
                placeholder="1"
                step="0.1"
                min="0.1"
                max="100"
              />
            </div>
            <div className="flex gap-2">
              {[0.5, 1, 2, 3].map((r) => (
                <button
                  key={r}
                  onClick={() => setRiskPercentage(r.toString())}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                    parseFloat(riskPercentage) === r
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {r}%
                </button>
              ))}
            </div>
          </div>

          {/* Stop Loss Pips */}
          <div className="space-y-2">
            <Label htmlFor="stopLoss" className="text-xs uppercase tracking-wider text-muted-foreground">
              Stop Loss (Pips)
            </Label>
            <div className="relative">
              <TrendingDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="stopLoss"
                type="number"
                value={stopLossPips}
                onChange={(e) => setStopLossPips(e.target.value)}
                className="pl-9 font-mono"
                placeholder="50"
                min="1"
              />
            </div>
          </div>

          {/* Currency Pair */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Currency Pair
            </Label>
            <Select value={selectedPair} onValueChange={setSelectedPair}>
              <SelectTrigger>
                <SelectValue placeholder="Select pair" />
              </SelectTrigger>
              <SelectContent>
                {currencyPairs.map((p) => (
                  <SelectItem key={p.pair} value={p.pair}>
                    {p.pair}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Pip Value */}
          {selectedPair === "Custom" && (
            <div className="space-y-2 animate-fade-in">
              <Label htmlFor="pipValue" className="text-xs uppercase tracking-wider text-muted-foreground">
                Pip Value ($ per standard lot)
              </Label>
              <Input
                id="pipValue"
                type="number"
                value={customPipValue}
                onChange={(e) => setCustomPipValue(e.target.value)}
                className="font-mono"
                placeholder="10"
              />
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          {/* Main Result */}
          <div className="glass rounded-xl p-5 border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Recommended Lot Size
            </div>
            <div className="flex items-baseline gap-2">
              <AnimatedResult
                value={calculations.lotSize}
                decimals={2}
                className="text-4xl font-bold font-mono text-primary"
              />
              <span className="text-lg text-muted-foreground">lots</span>
            </div>
            <div className="mt-3 flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Mini: </span>
                <span className="font-mono font-medium">{calculations.miniLots.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Micro: </span>
                <span className="font-mono font-medium">{calculations.microLots.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Additional Results Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass rounded-xl p-4 border border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Risk Amount
              </div>
              <AnimatedResult
                value={calculations.riskAmount}
                prefix="$"
                decimals={2}
                className="text-xl font-bold font-mono text-destructive"
              />
            </div>

            <div className="glass rounded-xl p-4 border border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Position Size
              </div>
              <AnimatedResult
                value={calculations.positionUnits}
                decimals={0}
                className="text-xl font-bold font-mono"
              />
              <span className="text-xs text-muted-foreground ml-1">units</span>
            </div>

            <div className="glass rounded-xl p-4 border border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Pip Value
              </div>
              <AnimatedResult
                value={calculations.pipValue}
                prefix="$"
                decimals={2}
                className="text-xl font-bold font-mono"
              />
              <span className="text-xs text-muted-foreground ml-1">/pip</span>
            </div>

            <div className="glass rounded-xl p-4 border border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Max Loss at SL
              </div>
              <AnimatedResult
                value={calculations.potentialLoss}
                prefix="$"
                decimals={2}
                className="text-xl font-bold font-mono text-destructive"
              />
            </div>
          </div>

          {/* Info Box */}
          <div className="glass rounded-xl p-4 border border-border/40 bg-muted/20">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              How it works
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Lot Size = Risk Amount ÷ (Stop Loss Pips × Pip Value). This ensures you only risk the 
              specified percentage of your account on each trade, regardless of where you place your stop loss.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
