import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Pipette } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  hexToHslComponents,
  hslComponentsToHex,
  normalizeHex,
  type HslComponents,
} from "@/lib/colorUtils";

interface CustomAccentColorPickerProps {
  value: string;
  onCommit: (color: string) => void;
  selected?: boolean;
  className?: string;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export const CustomAccentColorPicker = memo(function CustomAccentColorPicker({
  value,
  onCommit,
  selected = false,
  className,
}: CustomAccentColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [draftHex, setDraftHex] = useState(normalizeHex(value));
  const [hsl, setHsl] = useState<HslComponents>(() => hexToHslComponents(value));
  const committedRef = useRef(normalizeHex(value));
  const slRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const next = normalizeHex(value);
    committedRef.current = next;
    if (!open) {
      setDraftHex(next);
      setHsl(hexToHslComponents(next));
    }
  }, [value, open]);

  const applyHsl = useCallback((next: HslComponents) => {
    const hex = hslComponentsToHex(next.h, next.s, next.l);
    setHsl(next);
    setDraftHex(hex);
  }, []);

  const updateFromHex = useCallback((hex: string) => {
    const normalized = normalizeHex(hex);
    setDraftHex(normalized);
    setHsl(hexToHslComponents(normalized));
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) {
        const current = normalizeHex(value);
        committedRef.current = current;
        setDraftHex(current);
        setHsl(hexToHslComponents(current));
        return;
      }

      const finalHex = normalizeHex(draftHex);
      if (finalHex !== committedRef.current) {
        committedRef.current = finalHex;
        onCommit(finalHex);
      }
    },
    [draftHex, onCommit, value],
  );

  const pickSaturationLightness = useCallback(
    (clientX: number, clientY: number) => {
      const el = slRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((clientY - rect.top) / rect.height, 0, 1);
      applyHsl({
        h: hsl.h,
        s: Math.round(x * 100),
        l: Math.round((1 - y) * 100),
      });
    },
    [applyHsl, hsl.h],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      pickSaturationLightness(e.clientX, e.clientY);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [pickSaturationLightness]);

  const pointerX = `${hsl.s}%`;
  const pointerY = `${100 - hsl.l}%`;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Custom accent color"
          aria-label="Custom accent color"
          className={cn(
            "relative w-7 h-7 rounded-lg border-2 border-border/50 shadow-inner shrink-0",
            "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            selected && "ring-2 ring-offset-2 ring-offset-background ring-foreground/50",
            className,
          )}
          style={{ backgroundColor: open ? draftHex : value }}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[260px] p-3 space-y-3 border-border/50 bg-popover/95 backdrop-blur-sm shadow-xl data-[state=open]:animate-none data-[state=closed]:animate-none"
      >
        <div className="flex items-center gap-2">
          <Pipette className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs font-semibold text-foreground">Custom accent</p>
        </div>

        <div
          ref={slRef}
          className="relative h-36 w-full rounded-lg cursor-crosshair touch-none select-none overflow-hidden border border-border/40"
          style={{ backgroundColor: `hsl(${hsl.h} 100% 50%)` }}
          onPointerDown={(e) => {
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            pickSaturationLightness(e.clientX, e.clientY);
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
          <div
            className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md pointer-events-none"
            style={{ left: pointerX, top: pointerY, backgroundColor: draftHex }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Hue</label>
          <input
            type="range"
            min={0}
            max={360}
            value={hsl.h}
            onChange={(e) => applyHsl({ ...hsl, h: Number(e.target.value) })}
            className="w-full h-2.5 rounded-full appearance-none cursor-pointer accent-primary"
            style={{
              background:
                "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <div
            className="w-10 h-10 rounded-lg border border-border/40 shrink-0 shadow-inner"
            style={{ backgroundColor: draftHex }}
          />
          <Input
            value={draftHex}
            onChange={(e) => updateFromHex(e.target.value)}
            onBlur={() => updateFromHex(draftHex)}
            className="font-mono text-xs h-9 bg-background/60"
            spellCheck={false}
          />
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Pick a color here — your dashboard accent updates when you close this panel.
        </p>
      </PopoverContent>
    </Popover>
  );
});
