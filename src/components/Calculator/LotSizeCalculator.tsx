import { useState, useMemo } from "react";
import { Calculator, DollarSign, Percent, TrendingDown, BarChart3, RefreshCw, Search, Wifi, WifiOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { useLiveRates } from "@/hooks/useLiveRates";
import {
  INSTRUMENTS,
  type InstrumentCategory,
  type InstrumentSpec,
  computeLotSize,
  findInstrumentForChartSymbol,
  forexPairPrice,
  pipLabel,
  unitLabel,
} from "@/lib/positionSizing";

const CATEGORIES: { id: InstrumentCategory; label: string }[] = [
  { id: "forex", label: "Forex" },
  { id: "crypto", label: "Crypto" },
  { id: "commodities", label: "Commodities" },
  { id: "indices", label: "Indices" },
  { id: "synthetic", label: "Synthetics" },
  { id: "stocks", label: "Stocks" },
  { id: "futures", label: "Futures" },
];

const CRYPTO_BINANCE_SYMBOLS = INSTRUMENTS
  .filter((i) => i.binanceSymbol)
  .map((i) => i.binanceSymbol!) as string[];

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

/** Decimals needed to display a lot size cleanly (based on the step). */
function lotDecimals(step: number): number {
  if (step >= 1) return 0;
  return Math.min(4, Math.max(0, Math.ceil(-Math.log10(step))));
}

interface LotSizeCalculatorProps {
  compact?: boolean;
  /** Raw chart ticker (e.g. "OANDA:EURUSD") to pre-select on mount. */
  initialSymbol?: string;
}

export function LotSizeCalculator({ compact = false, initialSymbol }: LotSizeCalculatorProps) {
  // Resolved once on mount — the sheet remounts the calculator each open.
  const [initialSpec] = useState<InstrumentSpec | null>(
    () => findInstrumentForChartSymbol(initialSymbol),
  );

  const [accountBalance, setAccountBalance] = useState<string>("10000");
  const [riskPercentage, setRiskPercentage] = useState<string>("1");
  const [riskUsd, setRiskUsd] = useState<string>("100");
  const [riskMode, setRiskMode] = useState<'percent' | 'usd'>('percent');
  const [stopLoss, setStopLoss] = useState<string>("50");
  const [slModeOverride, setSlModeOverride] = useState<'pips' | 'price' | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(initialSpec?.symbol ?? "EUR/USD");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<InstrumentCategory>(initialSpec?.category ?? "forex");

  // Custom instrument settings
  const [customPipValue, setCustomPipValue] = useState<string>("10");
  const [customContractSize, setCustomContractSize] = useState<string>("100000");
  const [useCustom, setUseCustom] = useState<boolean>(false);

  const { usdRates, fxIsLive, fxUpdatedAt, cryptoPrices } = useLiveRates(CRYPTO_BINANCE_SYMBOLS);

  const selectedInstrument = useMemo(
    () => INSTRUMENTS.find((i) => i.symbol === selectedSymbol),
    [selectedSymbol],
  );

  const slMode: 'pips' | 'price' =
    slModeOverride ?? selectedInstrument?.defaultSlMode ?? 'pips';

  const filteredInstruments = useMemo(() => {
    return INSTRUMENTS.filter((i) => {
      const matchesCategory = i.category === activeCategory;
      const matchesSearch = searchQuery === "" ||
        i.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  /** Live reference price for the selected instrument (when derivable). */
  const livePrice = useMemo(() => {
    if (!selectedInstrument) return null;
    if (selectedInstrument.binanceSymbol) {
      return cryptoPrices[selectedInstrument.binanceSymbol] ?? null;
    }
    if (selectedInstrument.category === "forex" && fxIsLive) {
      return forexPairPrice(selectedInstrument, usdRates);
    }
    return null;
  }, [selectedInstrument, cryptoPrices, fxIsLive, usdRates]);

  const calculations = useMemo(() => {
    const spec: InstrumentSpec = selectedInstrument ?? INSTRUMENTS[0];
    const balance = parseFloat(accountBalance) || 0;
    const riskPercent = parseFloat(riskPercentage) || 0;
    const riskDollar = parseFloat(riskUsd) || 0;
    const sl = parseFloat(stopLoss) || 0;

    const riskAmount = riskMode === 'percent'
      ? (balance * riskPercent) / 100
      : riskDollar;

    const result = computeLotSize({
      spec,
      riskUSD: riskAmount,
      stopLoss: sl,
      slMode,
      usdRates,
      customPipValueUSD: useCustom ? (parseFloat(customPipValue) || undefined) : undefined,
      customContractSize: useCustom ? (parseFloat(customContractSize) || undefined) : undefined,
    });

    return {
      riskAmount,
      ...result,
      pipSize: spec.pipSize,
      unitLabel: unitLabel(spec.category),
      pipLabel: pipLabel(spec.category),
      notionalUSD: livePrice ? result.positionUnits * livePrice : null,
    };
  }, [accountBalance, riskPercentage, riskUsd, riskMode, stopLoss, slMode, selectedInstrument, usdRates, useCustom, customPipValue, customContractSize, livePrice]);

  const handleReset = () => {
    setAccountBalance("10000");
    setRiskPercentage("1");
    setRiskUsd("100");
    setRiskMode("percent");
    setStopLoss("50");
    setSlModeOverride(null);
    setSelectedSymbol("EUR/USD");
    setSearchQuery("");
    setActiveCategory("forex");
    setUseCustom(false);
  };

  const handleSelectInstrument = (symbol: string) => {
    setSelectedSymbol(symbol);
    setSlModeOverride(null);
    setUseCustom(false);
  };

  const lotDp = lotDecimals(calculations.lotStep);
  const pipName = calculations.pipLabel.slice(0, -1); // pip / point / tick

  const slModeToggle = (
    <div className="flex rounded-lg overflow-hidden border border-border/50">
      {(['pips', 'price'] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => setSlModeOverride(mode)}
          className={cn(
            "px-2 py-1 text-[10px] font-medium transition-all capitalize",
            slMode === mode
              ? "bg-primary text-primary-foreground"
              : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
          )}
        >
          {mode === 'pips' ? calculations.pipLabel : 'Price Δ'}
        </button>
      ))}
    </div>
  );

  const liveBadge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border",
        fxIsLive
          ? "text-primary border-primary/40 bg-primary/10"
          : "text-amber-500 border-amber-500/40 bg-amber-500/10"
      )}
      title={fxUpdatedAt ? `FX rates updated ${fxUpdatedAt}` : undefined}
    >
      {fxIsLive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {fxIsLive ? "Live rates" : "Offline — approximate rates"}
    </span>
  );

  // Compact mode for sidebar integration
  if (compact) {
    return (
      <div className="space-y-4 animate-fade-in">
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
            <div className="flex items-center justify-between">
              <Label htmlFor="sl-compact" className="text-xs text-muted-foreground">
                Stop Loss
              </Label>
              {slModeToggle}
            </div>
            <div className="relative">
              <TrendingDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="sl-compact"
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="pl-9 font-mono h-9 text-sm"
                placeholder={slMode === 'pips' ? "50" : "1.50"}
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
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium transition-all",
                    activeCategory === cat.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {cat.label}
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
            {selectedInstrument && (
              <p className="text-xs font-semibold mb-1">
                {selectedInstrument.symbol}
                <span className="text-muted-foreground font-normal ml-1.5">{selectedInstrument.name}</span>
              </p>
            )}
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Recommended Size</p>
            <AnimatedResult
              value={calculations.lots}
              suffix={` ${calculations.unitLabel}`}
              decimals={lotDp}
              className="text-2xl font-bold text-primary"
            />
            {calculations.belowMinimum && (
              <div className="mt-2 text-[10px] text-amber-500 bg-amber-500/10 rounded px-2 py-1">
                ⚠️ Min lot: {calculations.minLot} (risk ${calculations.actualRiskUSD.toFixed(2)})
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted/30 rounded p-2 text-center">
              <p className="text-muted-foreground text-[10px]">Risk Amount</p>
              <AnimatedResult value={calculations.riskAmount} prefix="$" decimals={2} className="font-semibold" />
            </div>
            <div className="bg-muted/30 rounded p-2 text-center">
              <p className="text-muted-foreground text-[10px]">{pipName} value/lot</p>
              <AnimatedResult value={calculations.pipValueUSD} prefix="$" decimals={2} className="font-semibold" />
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Calculator className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold">Position Size Calculator</h2>
              {liveBadge}
            </div>
            <p className="text-xs text-muted-foreground">
              Forex, crypto, commodities, indices, Deriv synthetics, stocks & futures
            </p>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="stopLoss" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Stop Loss
                </Label>
                {slModeToggle}
              </div>
              <div className="relative">
                <TrendingDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="stopLoss"
                  type="number"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="pl-9 font-mono"
                  placeholder={slMode === 'pips' ? "50" : "1.50"}
                  min="0"
                  step="any"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {slMode === 'pips'
                  ? `1 ${pipName} = ${calculations.pipSize} price movement · SL ≈ ${calculations.slPips.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${calculations.pipLabel}`
                  : `Enter the raw price distance to your stop (e.g. entry 2350.00, SL 2345.00 → 5.00) · ≈ ${calculations.slPips.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${calculations.pipLabel}`}
              </p>
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
            <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as InstrumentCategory)}>
              <TabsList className="flex w-full h-auto flex-wrap gap-1 justify-start">
                {CATEGORIES.map((cat) => (
                  <TabsTrigger key={cat.id} value={cat.id} className="text-xs px-2.5 py-1.5">
                    {cat.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {CATEGORIES.map(({ id }) => (
                <TabsContent key={id} value={id} className="mt-3">
                  <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                    {filteredInstruments.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No instruments found</p>
                    ) : (
                      filteredInstruments.map((instrument) => {
                        const pv = computeLotSize({
                          spec: instrument,
                          riskUSD: 0,
                          stopLoss: 0,
                          slMode: 'pips',
                          usdRates,
                        }).pipValueUSD;
                        return (
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
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ${pv >= 100 ? pv.toFixed(0) : pv.toFixed(2)}/{pipLabel(instrument.category).slice(0, -1)}
                            </span>
                          </button>
                        );
                      })
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
                      Pip Value ($/lot)
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
            <div className="glass rounded-xl p-4 border border-border/40 flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-bold">{selectedInstrument.symbol}</div>
                <div className="text-xs text-muted-foreground">{selectedInstrument.name}</div>
              </div>
              <div className="flex items-center gap-5 text-right">
                {livePrice != null && (
                  <div>
                    <div className="text-xs text-muted-foreground">Live Price</div>
                    <div className="font-mono text-sm text-primary">
                      {livePrice.toLocaleString(undefined, {
                        minimumFractionDigits: livePrice < 10 ? 4 : 2,
                        maximumFractionDigits: livePrice < 10 ? 4 : 2,
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground">Contract Size</div>
                  <div className="font-mono text-sm">{calculations.contractSize.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Min Lot</div>
                  <div className="font-mono text-sm">{calculations.minLot}</div>
                </div>
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
                value={calculations.lots}
                decimals={lotDp}
                className="text-4xl font-bold font-mono text-primary"
              />
              <span className="text-lg text-muted-foreground">{calculations.unitLabel}</span>
            </div>
            {calculations.belowMinimum && (
              <div className="mt-3 text-xs text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
                ⚠️ The risk-based size ({calculations.rawLots.toFixed(Math.max(lotDp, 3))}) is below the
                broker minimum of <span className="font-mono font-semibold">{calculations.minLot}</span>.
                Using the minimum risks <span className="font-mono font-semibold">${calculations.actualRiskUSD.toFixed(2)}</span> instead
                of ${calculations.riskAmount.toFixed(2)} — consider a tighter stop or higher risk budget.
              </div>
            )}
            {selectedInstrument?.category === 'forex' && (
              <div className="mt-3 flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Mini: </span>
                  <span className="font-mono font-medium">{(calculations.lots * 10).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Micro: </span>
                  <span className="font-mono font-medium">{(calculations.lots * 100).toFixed(2)}</span>
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
                decimals={calculations.positionUnits < 10 ? 2 : 0}
                className="text-xl font-bold font-mono"
              />
              {calculations.notionalUSD != null && (
                <span className="block text-[10px] text-muted-foreground mt-0.5">
                  ≈ ${calculations.notionalUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })} notional
                </span>
              )}
            </div>

            <div className="glass rounded-xl p-4 border border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {pipName.charAt(0).toUpperCase() + pipName.slice(1)} Value (1 lot)
              </div>
              <AnimatedResult
                value={calculations.pipValueUSD}
                prefix="$"
                decimals={calculations.pipValueUSD < 0.1 ? 4 : 2}
                className="text-xl font-bold font-mono"
              />
              <span className="text-xs text-muted-foreground ml-1">/{pipName}</span>
            </div>

            <div className="glass rounded-xl p-4 border border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Max Loss at SL
              </div>
              <AnimatedResult
                value={calculations.actualRiskUSD}
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
              Position Size = Risk Amount ÷ (Stop Loss in {calculations.pipLabel} × {pipName} value per lot).
              {pipName === 'pip' && ' Pip values for non-USD quote currencies are converted with live exchange rates.'}
              {selectedInstrument?.category === 'synthetic' && ' For Deriv synthetics, P&L = lots × price movement (contract size 1), so entering the SL as a price distance is most accurate.'}
              {' '}The result is rounded down to the broker volume step so your actual risk never exceeds the budget.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
