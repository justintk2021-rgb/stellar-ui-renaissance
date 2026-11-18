import { ChartCandlestick } from "lucide-react";

export function CustomChart() {
  return (
    <div className="relative flex h-[calc(100dvh-1.5rem)] min-h-[36rem] flex-col gap-2 sm:h-[calc(100dvh-2rem)] lg:h-[calc(100dvh-3rem)]">
      <div
        className="pointer-events-none select-none absolute inset-0 overflow-hidden rounded-2xl border border-foreground/10 bg-[#131722]"
        aria-hidden
      >
        <div className="absolute inset-0 opacity-40">
          <div className="absolute left-[8%] top-[18%] h-px w-[70%] bg-white/10" />
          <div className="absolute left-[8%] top-[32%] h-px w-[70%] bg-white/10" />
          <div className="absolute left-[8%] top-[46%] h-px w-[70%] bg-white/10" />
          <div className="absolute left-[8%] top-[60%] h-px w-[70%] bg-white/10" />
          <div className="absolute left-[12%] bottom-[22%] h-[38%] w-1.5 rounded-sm bg-[#2962FF]/70" />
          <div className="absolute left-[18%] bottom-[28%] h-[28%] w-1.5 rounded-sm bg-black/80" />
          <div className="absolute left-[24%] bottom-[20%] h-[44%] w-1.5 rounded-sm bg-[#2962FF]/70" />
          <div className="absolute left-[30%] bottom-[30%] h-[24%] w-1.5 rounded-sm bg-black/80" />
          <div className="absolute left-[36%] bottom-[18%] h-[48%] w-1.5 rounded-sm bg-[#2962FF]/70" />
          <div className="absolute left-[42%] bottom-[26%] h-[32%] w-1.5 rounded-sm bg-black/80" />
          <div className="absolute left-[48%] bottom-[22%] h-[40%] w-1.5 rounded-sm bg-[#2962FF]/70" />
          <div className="absolute left-[54%] bottom-[34%] h-[20%] w-1.5 rounded-sm bg-black/80" />
          <div className="absolute left-[60%] bottom-[16%] h-[50%] w-1.5 rounded-sm bg-[#2962FF]/70" />
          <div className="absolute left-[66%] bottom-[24%] h-[36%] w-1.5 rounded-sm bg-black/80" />
          <div className="absolute left-[72%] bottom-[20%] h-[42%] w-1.5 rounded-sm bg-[#2962FF]/70" />
        </div>
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[2px]">
        <div className="rounded-2xl border border-border/40 bg-card/90 px-10 py-8 text-center shadow-lg">
          <ChartCandlestick className="mx-auto mb-3 h-8 w-8 text-primary" />
          <p className="text-xl font-semibold tracking-tight text-foreground">Coming soon</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Chart trading is on the way.
          </p>
        </div>
      </div>
    </div>
  );
}
