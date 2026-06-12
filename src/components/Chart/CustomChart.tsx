// Chart page entry: uses the self-hosted TradingView Advanced Charts library
// when present (public/charting_library), otherwise falls back to the free
// embed widget. See AdvancedChart.tsx for setup instructions.
import { lazy, Suspense, useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AdvancedChart } from "./AdvancedChart";

const LotSizeCalculator = lazy(() =>
  import("@/components/Calculator/LotSizeCalculator").then((m) => ({
    default: m.LotSizeCalculator,
  })),
);

export function CustomChart() {
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);

  const openCalculator = () => {
    // Snapshot the chart's current symbol so the calculator pre-selects it.
    setChartSymbol(localStorage.getItem("chart-symbol"));
    setCalculatorOpen(true);
  };

  return (
    <div className="space-y-2">
      {/* Lot-size calculator trigger */}
      <div className="flex justify-end">
        <Button
          onClick={openCalculator}
          size="icon"
          title="Lot size calculator"
          aria-label="Lot size calculator"
          className="shadow-lg shadow-primary/20"
        >
          <Calculator className="w-4 h-4" />
        </Button>
      </div>

      <AdvancedChart />

      <Sheet open={calculatorOpen} onOpenChange={setCalculatorOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              Lot Size Calculator
            </SheetTitle>
            <SheetDescription>
              Size your position before placing the trade. Live rates included.
            </SheetDescription>
          </SheetHeader>
          {calculatorOpen && (
            <Suspense
              fallback={
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
                  ))}
                </div>
              }
            >
              <LotSizeCalculator compact initialSymbol={chartSymbol ?? undefined} />
            </Suspense>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
