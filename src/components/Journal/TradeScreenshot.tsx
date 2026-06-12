import { useRef } from "react";
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
  onUpdate?: (chartImage: string | undefined) => void | Promise<void>;
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

  const handleRemove = async () => {
    if (!onUpdate) return;
    await onUpdate(undefined);
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
                "relative w-full rounded-lg overflow-hidden border border-border/40 bg-muted/20 text-left",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <img
                src={chartImage}
                alt="Trade screenshot"
                loading="lazy"
                className={cn(
                  "w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]",
                  compact ? "h-24" : "max-h-56 object-contain bg-muted/10",
                )}
              />
              <span className="absolute inset-0 flex items-center justify-center bg-background/0 group-hover:bg-background/30 transition-colors">
                <ZoomIn className="w-5 h-5 text-foreground opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
              </span>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl p-2 bg-card/95 border-border/50">
            <img
              src={chartImage}
              alt="Trade screenshot full size"
              className="w-full max-h-[80vh] object-contain rounded-md"
            />
          </DialogContent>
        </Dialog>
        {editable && onUpdate && (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
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
