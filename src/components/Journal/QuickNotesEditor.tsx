import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  AlignCenter,
  AlignLeft,
  Bold,
  ImageIcon,
  Italic,
  Link2,
  List,
  Sparkles,
  Underline,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { compressTradeImage } from "@/lib/tradeImage";
import { plainTextToNotebookHtml } from "@/lib/notebookSync";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TEXT_COLORS = [
  { id: "fg", label: "Default", color: "inherit" },
  { id: "red", label: "Red", color: "#ef4444" },
  { id: "amber", label: "Amber", color: "#f59e0b" },
  { id: "green", label: "Green", color: "#22c55e" },
  { id: "blue", label: "Blue", color: "#3b82f6" },
  { id: "violet", label: "Violet", color: "#8b5cf6" },
  { id: "pink", label: "Pink", color: "#ec4899" },
  { id: "slate", label: "Slate", color: "#94a3b8" },
] as const;

function toEditorHtml(value: string) {
  if (!value.trim()) return "";
  if (/<[a-z][\s\S]*>/i.test(value)) return value;
  return plainTextToNotebookHtml(value);
}

interface QuickNotesEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function QuickNotesEditor({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Add notes for this trade…",
}: QuickNotesEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [activeColor, setActiveColor] = useState<string>("inherit");

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    // Don't rewrite the DOM while the user is typing — that resets the caret.
    if (document.activeElement === el) return;
    const html = toEditorHtml(value);
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value]);

  const run = (command: string, arg?: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, arg);
    onChange(editorRef.current?.innerHTML ?? "");
  };

  const syncFromEditor = () => {
    onChange(editorRef.current?.innerHTML ?? "");
  };

  const toolbarBtn =
    "h-8 w-8 shrink-0 rounded-lg p-0 text-muted-foreground hover:bg-muted/70 hover:text-foreground";

  const stopMouseDown = (event: MouseEvent) => {
    event.preventDefault();
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-2", className)}>
      <div
        className={cn(
          "flex shrink-0 flex-wrap items-center gap-0.5 self-start rounded-2xl border border-border/50",
          "bg-background/80 px-1.5 py-1 shadow-md shadow-black/10 backdrop-blur-md",
        )}
        role="toolbar"
        aria-label="Quick notes formatting"
        onMouseDown={stopMouseDown}
      >
        <Button type="button" variant="ghost" size="sm" className={toolbarBtn} title="Bold" disabled={disabled} onClick={() => run("bold")}>
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={toolbarBtn} title="Italic" disabled={disabled} onClick={() => run("italic")}>
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={toolbarBtn} title="Underline" disabled={disabled} onClick={() => run("underline")}>
          <Underline className="h-3.5 w-3.5" />
        </Button>

        <div className="mx-1 h-5 w-px bg-border/60" />

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className={cn(toolbarBtn, "relative")} title="Text color" disabled={disabled}>
              <span
                className="h-3.5 w-3.5 rounded-full border border-border/70"
                style={{
                  background: activeColor === "inherit" ? "hsl(var(--foreground))" : activeColor,
                }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="z-[80] w-auto border-border bg-background p-2">
            <div className="grid grid-cols-4 gap-1.5">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  title={color.label}
                  className="h-6 w-6 rounded-full border border-border/60 transition-transform hover:scale-110"
                  style={{
                    background: color.color === "inherit" ? "hsl(var(--foreground))" : color.color,
                  }}
                  onMouseDown={stopMouseDown}
                  onClick={() => {
                    setActiveColor(color.color);
                    if (color.color === "inherit") {
                      run("removeFormat");
                    } else {
                      run("foreColor", color.color);
                    }
                  }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="mx-1 h-5 w-px bg-border/60" />

        <Button type="button" variant="ghost" size="sm" className={toolbarBtn} title="Align left" disabled={disabled} onClick={() => run("justifyLeft")}>
          <AlignLeft className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={toolbarBtn} title="Align center" disabled={disabled} onClick={() => run("justifyCenter")}>
          <AlignCenter className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={toolbarBtn} title="Bulleted list" disabled={disabled} onClick={() => run("insertUnorderedList")}>
          <List className="h-3.5 w-3.5" />
        </Button>

        <div className="mx-1 h-5 w-px bg-border/60" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={toolbarBtn}
          title="Insert link"
          disabled={disabled}
          onClick={() => {
            const url = window.prompt("Enter URL:");
            if (url) run("createLink", url);
          }}
        >
          <Link2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={toolbarBtn}
          title="Insert image"
          disabled={disabled}
          onClick={() => imageInputRef.current?.click()}
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={toolbarBtn}
          title="Highlight"
          disabled={disabled}
          onClick={() => run("hiliteColor", "hsla(var(--primary), 0.28)")}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </Button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file || disabled) return;
            try {
              const src = await compressTradeImage(file);
              run("insertHTML", `<img src="${src}" alt="" style="max-width:100%;border-radius:0.5rem;margin:0.35rem 0;" />`);
            } catch {
              toast.error("Could not insert image");
            }
          }}
        />
      </div>

      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label="Quick notes"
        aria-disabled={disabled}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={syncFromEditor}
        onBlur={syncFromEditor}
        data-placeholder={placeholder}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/40 bg-background/40 px-3 py-2.5 text-sm leading-relaxed outline-none",
          "focus-visible:ring-1 focus-visible:ring-ring",
          "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
          "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-primary [&_a]:underline",
          "[&_img]:max-w-full [&_img]:rounded-lg",
          disabled && "pointer-events-none opacity-60",
        )}
      />
    </div>
  );
}
