import { useState, useMemo } from "react";
import { Calculator, DollarSign, Percent, TrendingDown, BarChart3, RefreshCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";

// Instrument types with their characteristics
interface Instrument {
  symbol: string;
  name: string;
  pipValue: number;        // Value per pip/point for 1 standard lot
  contractSize: number;    // Units per standard lot
  pipSize: number;         // What constitutes 1 pip (0.0001, 0.01, 1, etc.)
  category: 'forex' | 'stocks' | 'futures' | 'indices';
}

const instruments: Instrument[] = [
  // Forex Majors
  { symbol: "EUR/USD", name: "Euro / US Dollar", pipValue: 10, contractSize: 100000, pipSize: 0.0001, category: 'forex' },
  { symbol: "GBP/USD", name: "British Pound / US Dollar", pipValue: 10, contractSize: 100000, pipSize: 0.0001, category: 'forex' },
  { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", pipValue: 9.10, contractSize: 100000, pipSize: 0.01, category: 'forex' },
  { symbol: "USD/CHF", name: "US Dollar / Swiss Franc", pipValue: 10.15, contractSize: 100000, pipSize: 0.0001, category: 'forex' },
  { symbol: "AUD/USD", name: "Australian Dollar / US Dollar", pipValue: 10, contractSize: 100000, pipSize: 0.0001, category: 'forex' },
  { symbol: "USD/CAD", name: "US Dollar / Canadian Dollar", pipValue: 7.63, contractSize: 100000, pipSize: 0.0001, category: 'forex' },
  { symbol: "NZD/USD", name: "New Zealand Dollar / US Dollar", pipValue: 10, contractSize: 100000, pipSize: 0.0001, category: 'forex' },
  // Forex Minors
  { symbol: "EUR/GBP", name: "Euro / British Pound", pipValue: 12.70, contractSize: 100000, pipSize: 0.0001, category: 'forex' },
  { symbol: "EUR/JPY", name: "Euro / Japanese Yen", pipValue: 9.10, contractSize: 100000, pipSize: 0.01, category: 'forex' },
  { symbol: "GBP/JPY", name: "British Pound / Japanese Yen", pipValue: 9.10, contractSize: 100000, pipSize: 0.01, category: 'forex' },
  { symbol: "EUR/AUD", name: "Euro / Australian Dollar", pipValue: 6.50, contractSize: 100000, pipSize: 0.0001, category: 'forex' },
  { symbol: "EUR/CAD", name: "Euro / Canadian Dollar", pipValue: 7.63, contractSize: 100000, pipSize: 0.0001, category: 'forex' },
  { symbol: "EUR/CHF", name: "Euro / Swiss Franc", pipValue: 10.15, contractSize: 100000, pipSize: 0.0001, category: 'forex' },
  { symbol: "GBP/AUD", name: "British Pound / Australian Dollar", pipValue: 6.50, contractSize: 100000, pipSize: 0.0001, category: 'forex' },
  { symbol: "GBP/CAD", name: "British Pound / Canadian Dollar", pipValue: 7.63, contractSize: 100000, pipSize: 0.0001, category: 'forex' },
  { symbol: "AUD/JPY", name: "Australian Dollar / Japanese Yen", pipValue: 9.10, contractSize: 100000, pipSize: 0.01, category: 'forex' },
  { symbol: "CAD/JPY", name: "Canadian Dollar / Japanese Yen", pipValue: 9.10, contractSize: 100000, pipSize: 0.01, category: 'forex' },
  { symbol: "CHF/JPY", name: "Swiss Franc / Japanese Yen", pipValue: 9.10, contractSize: 100000, pipSize: 0.01, category: 'forex' },
  { symbol: "NZD/JPY", name: "New Zealand Dollar / Japanese Yen", pipValue: 9.10, contractSize: 100000, pipSize: 0.01, category: 'forex' },
  // Forex Exotics
  { symbol: "USD/MXN", name: "US Dollar / Mexican Peso", pipValue: 0.55, contractSize: 100000, pipSize: 0.0001, category: 'forex' },
  { symbol: "USD/ZAR", name: "US Dollar / South African Rand", pipValue: 0.55, contractSize: 100000, pipSize: 0.0001, category: 'forex' },
  { symbol: "USD/SGD", name: "US Dollar / Singapore Dollar", pipValue: 7.50, contractSize: 100000, pipSize: 0.0001, category: 'forex' },
  { symbol: "USD/HKD", name: "US Dollar / Hong Kong Dollar", pipValue: 1.28, contractSize: 100000, pipSize: 0.0001, category: 'forex' },
  { symbol: "XAU/USD", name: "Gold / US Dollar", pipValue: 10, contractSize: 100, pipSize: 0.01, category: 'forex' },
  { symbol: "XAG/USD", name: "Silver / US Dollar", pipValue: 50, contractSize: 5000, pipSize: 0.001, category: 'forex' },
  
  // Stocks (CFDs - typical contract sizes)
  { symbol: "AAPL", name: "Apple Inc.", pipValue: 1, contractSize: 1, pipSize: 0.01, category: 'stocks' },
  { symbol: "MSFT", name: "Microsoft Corporation", pipValue: 1, contractSize: 1, pipSize: 0.01, category: 'stocks' },
  { symbol: "GOOGL", name: "Alphabet Inc.", pipValue: 1, contractSize: 1, pipSize: 0.01, category: 'stocks' },
  { symbol: "AMZN", name: "Amazon.com Inc.", pipValue: 1, contractSize: 1, pipSize: 0.01, category: 'stocks' },
  { symbol: "TSLA", name: "Tesla Inc.", pipValue: 1, contractSize: 1, pipSize: 0.01, category: 'stocks' },
  { symbol: "META", name: "Meta Platforms Inc.", pipValue: 1, contractSize: 1, pipSize: 0.01, category: 'stocks' },
  { symbol: "NVDA", name: "NVIDIA Corporation", pipValue: 1, contractSize: 1, pipSize: 0.01, category: 'stocks' },
  { symbol: "AMD", name: "Advanced Micro Devices", pipValue: 1, contractSize: 1, pipSize: 0.01, category: 'stocks' },
  { symbol: "NFLX", name: "Netflix Inc.", pipValue: 1, contractSize: 1, pipSize: 0.01, category: 'stocks' },
  { symbol: "DIS", name: "Walt Disney Company", pipValue: 1, contractSize: 1, pipSize: 0.01, category: 'stocks' },
  { symbol: "BA", name: "Boeing Company", pipValue: 1, contractSize: 1, pipSize: 0.01, category: 'stocks' },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", pipValue: 1, contractSize: 1, pipSize: 0.01, category: 'stocks' },
  { symbol: "V", name: "Visa Inc.", pipValue: 1, contractSize: 1, pipSize: 0.01, category: 'stocks' },
  { symbol: "MA", name: "Mastercard Inc.", pipValue: 1, contractSize: 1, pipSize: 0.01, category: 'stocks' },
  { symbol: "KO", name: "Coca-Cola Company", pipValue: 1, contractSize: 1, pipSize: 0.01, category: 'stocks' },
  
  // Futures
  { symbol: "ES", name: "E-mini S&P 500", pipValue: 12.50, contractSize: 1, pipSize: 0.25, category: 'futures' },
  { symbol: "NQ", name: "E-mini NASDAQ 100", pipValue: 5, contractSize: 1, pipSize: 0.25, category: 'futures' },
  { symbol: "YM", name: "E-mini Dow Jones", pipValue: 5, contractSize: 1, pipSize: 1, category: 'futures' },
  { symbol: "RTY", name: "E-mini Russell 2000", pipValue: 5, contractSize: 1, pipSize: 0.1, category: 'futures' },
  { symbol: "GC", name: "Gold Futures", pipValue: 10, contractSize: 100, pipSize: 0.1, category: 'futures' },
  { symbol: "SI", name: "Silver Futures", pipValue: 25, contractSize: 5000, pipSize: 0.005, category: 'futures' },
  { symbol: "CL", name: "Crude Oil WTI", pipValue: 10, contractSize: 1000, pipSize: 0.01, category: 'futures' },
  { symbol: "NG", name: "Natural Gas", pipValue: 10, contractSize: 10000, pipSize: 0.001, category: 'futures' },
  { symbol: "ZB", name: "30-Year T-Bond", pipValue: 31.25, contractSize: 1, pipSize: 0.03125, category: 'futures' },
  { symbol: "ZN", name: "10-Year T-Note", pipValue: 15.625, contractSize: 1, pipSize: 0.015625, category: 'futures' },
  { symbol: "6E", name: "Euro FX Futures", pipValue: 12.50, contractSize: 125000, pipSize: 0.0001, category: 'futures' },
  { symbol: "6B", name: "British Pound Futures", pipValue: 6.25, contractSize: 62500, pipSize: 0.0001, category: 'futures' },
  { symbol: "MES", name: "Micro E-mini S&P 500", pipValue: 1.25, contractSize: 1, pipSize: 0.25, category: 'futures' },
  { symbol: "MNQ", name: "Micro E-mini NASDAQ", pipValue: 0.50, contractSize: 1, pipSize: 0.25, category: 'futures' },
  { symbol: "MGC", name: "Micro Gold Futures", pipValue: 1, contractSize: 10, pipSize: 0.1, category: 'futures' },
  
  // Indices (CFDs)
  { symbol: "US500", name: "S&P 500 Index", pipValue: 1, contractSize: 1, pipSize: 0.1, category: 'indices' },
  { symbol: "US100", name: "NASDAQ 100 Index", pipValue: 1, contractSize: 1, pipSize: 0.1, category: 'indices' },
  { symbol: "US30", name: "Dow Jones 30 Index", pipValue: 1, contractSize: 1, pipSize: 1, category: 'indices' },
  { symbol: "UK100", name: "FTSE 100 Index", pipValue: 1, contractSize: 1, pipSize: 0.1, category: 'indices' },
  { symbol: "GER40", name: "DAX 40 Index", pipValue: 1, contractSize: 1, pipSize: 0.1, category: 'indices' },
  { symbol: "FRA40", name: "CAC 40 Index", pipValue: 1, contractSize: 1, pipSize: 0.1, category: 'indices' },
  { symbol: "JPN225", name: "Nikkei 225 Index", pipValue: 0.009, contractSize: 1, pipSize: 1, category: 'indices' },
  { symbol: "AUS200", name: "ASX 200 Index", pipValue: 0.65, contractSize: 1, pipSize: 0.1, category: 'indices' },
  { symbol: "HK50", name: "Hang Seng 50 Index", pipValue: 0.13, contractSize: 1, pipSize: 1, category: 'indices' },
  { symbol: "EU50", name: "Euro Stoxx 50 Index", pipValue: 1, contractSize: 1, pipSize: 0.1, category: 'indices' },
  { symbol: "VIX", name: "Volatility Index", pipValue: 100, contractSize: 1, pipSize: 0.01, category: 'indices' },
  { symbol: "SPX", name: "S&P 500 (Full)", pipValue: 1, contractSize: 1, pipSize: 0.01, category: 'indices' },
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

interface LotSizeCalculatorProps {
  compact?: boolean;
}

export function LotSizeCalculator({ compact = false }: LotSizeCalculatorProps) {
  const [accountBalance, setAccountBalance] = useState<string>("10000");
  const [riskPercentage, setRiskPercentage] = useState<string>("1");
  const [riskUsd, setRiskUsd] = useState<string>("100");
  const [riskMode, setRiskMode] = useState<'percent' | 'usd'>('percent');
  const [stopLoss, setStopLoss] = useState<string>("50");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("EUR/USD");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("forex");
  
  // Custom instrument settings
  const [customPipValue, setCustomPipValue] = useState<string>("10");
  const [customContractSize, setCustomContractSize] = useState<string>("100000");
  const [useCustom, setUseCustom] = useState<boolean>(false);

  const selectedInstrument = useMemo(() => {
    return instruments.find(i => i.symbol === selectedSymbol);
  }, [selectedSymbol]);

  const filteredInstruments = useMemo(() => {
    return instruments.filter(i => {
      const matchesCategory = i.category === activeCategory;
      const matchesSearch = searchQuery === "" || 
        i.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const calculations = useMemo(() => {
    const balance = parseFloat(accountBalance) || 0;
    const riskPercent = parseFloat(riskPercentage) || 0;
    const riskDollar = parseFloat(riskUsd) || 0;
    const sl = parseFloat(stopLoss) || 0;
    
    const pipValue = useCustom 
      ? (parseFloat(customPipValue) || 10) 
      : (selectedInstrument?.pipValue || 10);
    
    const contractSize = useCustom
      ? (parseFloat(customContractSize) || 100000)
      : (selectedInstrument?.contractSize || 100000);

    const pipSize = selectedInstrument?.pipSize || 0.0001;

    // Risk amount in dollars - based on mode
    const riskAmount = riskMode === 'percent' 
      ? (balance * riskPercent) / 100 
      : riskDollar;

    // Lot size calculation: Risk Amount / (Stop Loss × Pip Value)
    const lotSize = sl > 0 ? riskAmount / (sl * pipValue) : 0;

    // Position size in units
    const positionUnits = lotSize * contractSize;

    // Potential loss at stop loss
    const potentialLoss = lotSize * sl * pipValue;

    // Get the correct unit label based on instrument type
    const getUnitLabel = () => {
      if (!selectedInstrument) return "units";
      switch (selectedInstrument.category) {
        case 'forex': return "lots";
        case 'stocks': return "shares";
        case 'futures': return "contracts";
        case 'indices': return "contracts";
        default: return "units";
      }
    };

    const getPipLabel = () => {
      if (!selectedInstrument) return "pips";
      switch (selectedInstrument.category) {
        case 'forex': return "pips";
        case 'stocks': return "points";
        case 'futures': return "ticks";
        case 'indices': return "points";
        default: return "pips";
      }
    };

    return {
      riskAmount,
      lotSize: Math.max(0, lotSize),
      positionUnits: Math.max(0, positionUnits),
      potentialLoss: Math.max(0, potentialLoss),
      pipValue,
      contractSize,
      pipSize,
      unitLabel: getUnitLabel(),
      pipLabel: getPipLabel()
    };
  }, [accountBalance, riskPercentage, riskUsd, riskMode, stopLoss, selectedInstrument, useCustom, customPipValue, customContractSize]);

  const handleReset = () => {
    setAccountBalance("10000");
    setRiskPercentage("1");
    setRiskUsd("100");
    setRiskMode("percent");
    setStopLoss("50");
    setSelectedSymbol("EUR/USD");
    setSearchQuery("");
    setActiveCategory("forex");
    setUseCustom(false);
    setUseCustom(false);
  };

  const handleSelectInstrument = (symbol: string) => {
    setSelectedSymbol(symbol);
    setUseCustom(false);
  };

  // Compact mode for sidebar integration
  if (compact) {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* Trade Parameters - Compact */}
        <div className="space-y-4">
          {/* Account Balance */}
          <div className="space-y-1.5">
            <Label htmlFor="balance-compact" className="text-xs text-muted-foreground">
              Account Balance ($)
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="balance-compact"
                type="number"
                value={accountBalance}
                onChange={(e) => setAccountBalance(e.target.value)}
                className="pl-9 font-mono h-9 text-sm"
                placeholder="10000"
              />
            </div>
          </div>

          {/* Risk Per Trade */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Risk Per Trade</Label>
              <div className="flex rounded-md overflow-hidden border border-border/50">
                <button
                  onClick={() => setRiskMode('percent')}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-medium transition-all",
                    riskMode === 'percent'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  %
                </button>
                <button
                  onClick={() => setRiskMode('usd')}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-medium transition-all",
                    riskMode === 'usd'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  $
                </button>
              </div>
            </div>
            <div className="relative">
              {riskMode === 'percent' ? (
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              ) : (
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              )}
              <Input
                type="number"
                value={riskMode === 'percent' ? riskPercentage : riskUsd}
                onChange={(e) => riskMode === 'percent' ? setRiskPercentage(e.target.value) : setRiskUsd(e.target.value)}
                className="pl-9 font-mono h-9 text-sm"
                placeholder={riskMode === 'percent' ? "1" : "100"}
              />
            </div>
          </div>

          {/* Stop Loss */}
          <div className="space-y-1.5">
            <Label htmlFor="sl-compact" className="text-xs text-muted-foreground">
              Stop Loss (pips)
            </Label>
            <div className="relative">
              <TrendingDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="sl-compact"
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="pl-9 font-mono h-9 text-sm"
                placeholder="50"
              />
            </div>
          </div>

          {/* Instrument Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Instrument</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
                placeholder="Search..."
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['forex', 'stocks', 'futures', 'indices'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-all",
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1 bg-muted/20 rounded-lg p-2">
              {filteredInstruments.slice(0, 10).map((inst) => (
                <button
                  key={inst.symbol}
                  onClick={() => handleSelectInstrument(inst.symbol)}
                  className={cn(
                    "w-full text-left px-2 py-1 rounded text-xs transition-all",
                    selectedSymbol === inst.symbol
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted/50"
                  )}
                >
                  <span className="font-medium">{inst.symbol}</span>
                  <span className="text-muted-foreground ml-1 text-[10px]">{inst.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results - Compact */}
        <div className="glass rounded-lg p-4 border border-border/40 space-y-3">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Recommended Size</p>
            <AnimatedResult
              value={calculations.lotSize}
              suffix=" lots"
              decimals={2}
              className="text-2xl font-bold text-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted/30 rounded p-2 text-center">
              <p className="text-muted-foreground text-[10px]">Risk Amount</p>
              <AnimatedResult value={calculations.riskAmount} prefix="$" decimals={2} className="font-semibold" />
            </div>
            <div className="bg-muted/30 rounded p-2 text-center">
              <p className="text-muted-foreground text-[10px]">Position Units</p>
              <AnimatedResult value={calculations.positionUnits} decimals={0} className="font-semibold" />
            </div>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={handleReset} className="w-full gap-2 h-8 text-xs">
          <RefreshCw className="w-3 h-3" />
          Reset
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Calculator className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Position Size Calculator</h2>
            <p className="text-xs text-muted-foreground">Calculate lot size based on risk for any instrument</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-5">
          {/* Trade Parameters */}
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

            {/* Risk Per Trade */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Risk Per Trade
                </Label>
                <div className="flex rounded-lg overflow-hidden border border-border/50">
                  <button
                    onClick={() => setRiskMode('percent')}
                    className={cn(
                      "px-2 py-1 text-[10px] font-medium transition-all",
                      riskMode === 'percent'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    %
                  </button>
                  <button
                    onClick={() => setRiskMode('usd')}
                    className={cn(
                      "px-2 py-1 text-[10px] font-medium transition-all",
                      riskMode === 'usd'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    $
                  </button>
                </div>
              </div>
              
              {riskMode === 'percent' ? (
                <>
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
                </>
              ) : (
                <>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="riskUsd"
                      type="number"
                      value={riskUsd}
                      onChange={(e) => setRiskUsd(e.target.value)}
                      className="pl-9 font-mono"
                      placeholder="100"
                      min="1"
                    />
                  </div>
                  <div className="flex gap-2">
                    {[50, 100, 200, 500].map((r) => (
                      <button
                        key={r}
                        onClick={() => setRiskUsd(r.toString())}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                          parseFloat(riskUsd) === r
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        ${r}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Stop Loss */}
            <div className="space-y-2">
              <Label htmlFor="stopLoss" className="text-xs uppercase tracking-wider text-muted-foreground">
                Stop Loss ({calculations.pipLabel})
              </Label>
              <div className="relative">
                <TrendingDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="stopLoss"
                  type="number"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="pl-9 font-mono"
                  placeholder="50"
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* Instrument Selection */}
          <div className="glass rounded-xl p-5 border border-border/40 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Select Instrument
            </h3>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                placeholder="Search instruments..."
              />
            </div>

            {/* Category Tabs */}
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="forex" className="text-xs">Forex</TabsTrigger>
                <TabsTrigger value="stocks" className="text-xs">Stocks</TabsTrigger>
                <TabsTrigger value="futures" className="text-xs">Futures</TabsTrigger>
                <TabsTrigger value="indices" className="text-xs">Indices</TabsTrigger>
              </TabsList>

              {['forex', 'stocks', 'futures', 'indices'].map((category) => (
                <TabsContent key={category} value={category} className="mt-3">
                  <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                    {filteredInstruments.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No instruments found</p>
                    ) : (
                      filteredInstruments.map((instrument) => (
                        <button
                          key={instrument.symbol}
                          onClick={() => handleSelectInstrument(instrument.symbol)}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                            selectedSymbol === instrument.symbol
                              ? "bg-primary/20 border border-primary/50 text-foreground"
                              : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{instrument.symbol}</span>
                            <span className="text-[10px] text-muted-foreground">{instrument.name}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            ${instrument.pipValue}/pip
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            {/* Custom Values Toggle */}
            <div className="pt-2 border-t border-border/40">
              <button
                onClick={() => setUseCustom(!useCustom)}
                className={cn(
                  "text-xs font-medium transition-colors",
                  useCustom ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {useCustom ? "✓ Using custom values" : "Use custom pip value?"}
              </button>
              
              {useCustom && (
                <div className="grid grid-cols-2 gap-3 mt-3 animate-fade-in">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Pip Value ($)
                    </Label>
                    <Input
                      type="number"
                      value={customPipValue}
                      onChange={(e) => setCustomPipValue(e.target.value)}
                      className="font-mono text-sm h-9"
                      placeholder="10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Contract Size
                    </Label>
                    <Input
                      type="number"
                      value={customContractSize}
                      onChange={(e) => setCustomContractSize(e.target.value)}
                      className="font-mono text-sm h-9"
                      placeholder="100000"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          {/* Selected Instrument Info */}
          {selectedInstrument && (
            <div className="glass rounded-xl p-4 border border-border/40 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">{selectedInstrument.symbol}</div>
                <div className="text-xs text-muted-foreground">{selectedInstrument.name}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Contract Size</div>
                <div className="font-mono text-sm">{calculations.contractSize.toLocaleString()}</div>
              </div>
            </div>
          )}

          {/* Main Result */}
          <div className="glass rounded-xl p-5 border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Recommended Position Size
            </div>
            <div className="flex items-baseline gap-2">
              <AnimatedResult
                value={calculations.lotSize}
                decimals={2}
                className="text-4xl font-bold font-mono text-primary"
              />
              <span className="text-lg text-muted-foreground">{calculations.unitLabel}</span>
            </div>
            {selectedInstrument?.category === 'forex' && (
              <div className="mt-3 flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Mini: </span>
                  <span className="font-mono font-medium">{(calculations.lotSize * 10).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Micro: </span>
                  <span className="font-mono font-medium">{(calculations.lotSize * 100).toFixed(2)}</span>
                </div>
              </div>
            )}
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
                Position Units
              </div>
              <AnimatedResult
                value={calculations.positionUnits}
                decimals={0}
                className="text-xl font-bold font-mono"
              />
            </div>

            <div className="glass rounded-xl p-4 border border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {calculations.pipLabel.charAt(0).toUpperCase() + calculations.pipLabel.slice(1)} Value
              </div>
              <AnimatedResult
                value={calculations.pipValue}
                prefix="$"
                decimals={2}
                className="text-xl font-bold font-mono"
              />
              <span className="text-xs text-muted-foreground ml-1">/{calculations.pipLabel.slice(0, -1)}</span>
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
              Position Size = Risk Amount ÷ (Stop Loss × {calculations.pipLabel.charAt(0).toUpperCase() + calculations.pipLabel.slice(1)} Value). 
              This ensures you only risk the specified percentage of your account on each trade, 
              regardless of where you place your stop loss.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
