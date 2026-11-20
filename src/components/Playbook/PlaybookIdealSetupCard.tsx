import { useRef, type MouseEvent } from "react";
import { ImagePlus, Trash2, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { compressTradeImage } from "@/lib/tradeImage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Checklist } from "@/lib/playbookChecklist";

export function PlaybookIdealSetupCard({
  checklist,
  onSaveIdealImage,
}: {
  checklist: Checklist;
  onSaveIdealImage: (idealImage: string | null) => Promise<void> | void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confluences = checklist.items.filter((item) => item.isConfluence);
  const image = checklist.idealImage;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressTradeImage(file);
      await onSaveIdealImage(dataUrl);
      toast.success("Ideal setup saved");
    } catch {
      toast.error("Could not upload image");
    }
    e.target.value = "";
  };

  const handleRemove = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await onSaveIdealImage(null);
    toast.success("Ideal setup removed");
  };

  return (
    <div className="glass rounded-xl border border-border/30 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Ideal setup</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            The chart every future trade gets compared against
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="w-4 h-4 mr-1.5" />
            {image ? "Replace" : "Upload"}
          </Button>
          {image ? (
            <Button type="button" size="sm" variant="ghost" onClick={handleRemove}>
              <Trash2 className="w-4 h-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {!image ? (
        <p className="text-sm text-muted-foreground">
          Upload the perfect example of this setup — the chart every future trade gets compared against.
        </p>
      ) : (
        <div className="space-y-3">
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="relative group block w-full overflow-hidden rounded-lg border border-border/40"
              >
                <img src={image} alt="Ideal setup" className="w-full max-h-72 object-contain bg-muted/20" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                  <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl p-2">
              <img src={image} alt="Ideal setup enlarged" className="w-full h-auto rounded-md" />
            </DialogContent>
          </Dialog>

          {confluences.length > 0 ? (
            <ol className="space-y-1.5">
              {confluences.map((item, index) => (
                <li key={item.id} className="flex items-start gap-2 text-sm">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                      "bg-primary/15 text-primary text-[11px] font-semibold",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="text-muted-foreground">{item.text}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      )}
    </div>
  );
}
