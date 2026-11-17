import { useRef, type MouseEvent } from "react";
import { ImagePlus, Trash2, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTradeDetail } from "@/hooks/useTrades";
import { compressTradeImage } from "@/lib/tradeImage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

interface TradeScreenshotProps {
  tradeId: string;
  userId?: string;
  /** Skip fetch when the parent already has the image (e.g. edit form). */
  chartImage?: string;
  compact?: boolean;
  editable?: boolean;
  onUpdate?: (chartImage: string | null) => void | Promise<void>;
  className?: string;
}

export function TradeScreenshot({
  tradeId,
  userId,
  chartImage: chartImageProp,
  compact = false,
  editable = false,
  onUpdate,
  className,
}: TradeScreenshotProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldFetch = chartImageProp === undefined && !!userId && !!tradeId;
  const { data: detail, isLoading } = useTradeDetail(
    shouldFetch ? userId : undefined,
    shouldFetch ? tradeId : null,
  );
  const chartImage = chartImageProp ?? detail?.chartImage;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdate) return;
    try {
      const dataUrl = await compressTradeImage(file);
      await onUpdate(dataUrl);
      toast.success("Screenshot attached");
    } catch {
      toast.error("Could not upload image");
    }
    e.target.value = "";
  };

  const handleRemove = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onUpdate) return;
    await onUpdate(null);
    toast.success("Screenshot removed");
  };

  if (isLoading && shouldFetch) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/30 bg-muted/20 animate-pulse",
          compact ? "h-20" : "h-32",
          className,
        )}
      />
    );
  }

  if (chartImage) {
    return (
      <div className={cn("relative group", className)}>
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className={cn(
                "relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-lg border border-border/40 bg-background/40 text-left",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                compact ? "h-24" : !className?.includes("h-") && "h-56",
              )}
            >
              <img
                src={chartImage}
                alt="Trade screenshot"
                loading="lazy"
                className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-background/0 transition-colors group-hover:bg-background/20">
                <ZoomIn className="h-5 w-5 text-foreground opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
              </span>
            </button>
          </DialogTrigger>
          <DialogContent className="w-[min(96vw,72rem)] max-w-[96vw] p-2 sm:p-3 bg-card/95 border-border/50">
            <img
              src={chartImage}
              alt="Trade screenshot full size"
              decoding="sync"
              className="mx-auto block h-auto max-h-[85vh] w-auto max-w-full rounded-md object-contain"
              style={{ imageRendering: "auto" }}
            />
          </DialogContent>
        </Dialog>
        {editable && onUpdate && (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            aria-label="Delete screenshot"
            className="absolute top-1.5 right-1.5 h-7 w-7 z-20 shadow-md"
            onClick={handleRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  if (!editable || !onUpdate) return null;

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "w-full border-2 border-dashed border-border/50 rounded-lg flex items-center justify-center gap-2",
          "hover:border-primary/50 hover:bg-muted/30 transition-colors text-muted-foreground",
          compact ? "h-16 text-xs" : "h-20 text-xs",
        )}
      >
        <ImagePlus className="h-4 w-4" />
        Add trade screenshot
      </button>
    </div>
  );
}
