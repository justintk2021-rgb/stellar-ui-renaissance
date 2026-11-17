import { useEffect, useRef, useState, useMemo } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Image as ImageIcon,
  Italic,
  Link,
  List,
  Underline,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  STUDY_VIDEO_DEFAULT_WIDTH,
  STUDY_VIDEO_MIN_WIDTH,
} from "@/lib/studyArea";

export const NOTEBOOK_FONTS = [
  { id: "inter", name: "Inter", family: "'Inter', sans-serif", category: "Sans Serif" },
  { id: "roboto", name: "Roboto", family: "'Roboto', sans-serif", category: "Sans Serif" },
  { id: "open-sans", name: "Open Sans", family: "'Open Sans', sans-serif", category: "Sans Serif" },
  { id: "lato", name: "Lato", family: "'Lato', sans-serif", category: "Sans Serif" },
  { id: "montserrat", name: "Montserrat", family: "'Montserrat', sans-serif", category: "Sans Serif" },
  { id: "poppins", name: "Poppins", family: "'Poppins', sans-serif", category: "Sans Serif" },
  { id: "raleway", name: "Raleway", family: "'Raleway', sans-serif", category: "Sans Serif" },
  { id: "nunito", name: "Nunito", family: "'Nunito', sans-serif", category: "Sans Serif" },
  { id: "ubuntu", name: "Ubuntu", family: "'Ubuntu', sans-serif", category: "Sans Serif" },
  { id: "rubik", name: "Rubik", family: "'Rubik', sans-serif", category: "Sans Serif" },
  { id: "oswald", name: "Oswald", family: "'Oswald', sans-serif", category: "Sans Serif" },
  { id: "dm-sans", name: "DM Sans", family: "'DM Sans', sans-serif", category: "Sans Serif" },
  { id: "space-grotesk", name: "Space Grotesk", family: "'Space Grotesk', sans-serif", category: "Sans Serif" },
  { id: "outfit", name: "Outfit", family: "'Outfit', sans-serif", category: "Sans Serif" },
  { id: "work-sans", name: "Work Sans", family: "'Work Sans', sans-serif", category: "Sans Serif" },
  { id: "plus-jakarta", name: "Plus Jakarta Sans", family: "'Plus Jakarta Sans', sans-serif", category: "Sans Serif" },
  { id: "manrope", name: "Manrope", family: "'Manrope', sans-serif", category: "Sans Serif" },
  { id: "sora", name: "Sora", family: "'Sora', sans-serif", category: "Sans Serif" },
  { id: "lexend", name: "Lexend", family: "'Lexend', sans-serif", category: "Sans Serif" },
  { id: "urbanist", name: "Urbanist", family: "'Urbanist', sans-serif", category: "Sans Serif" },
  { id: "figtree", name: "Figtree", family: "'Figtree', sans-serif", category: "Sans Serif" },
  { id: "archivo", name: "Archivo", family: "'Archivo', sans-serif", category: "Sans Serif" },
  { id: "barlow", name: "Barlow", family: "'Barlow', sans-serif", category: "Sans Serif" },
  { id: "karla", name: "Karla", family: "'Karla', sans-serif", category: "Sans Serif" },
  { id: "quicksand", name: "Quicksand", family: "'Quicksand', sans-serif", category: "Sans Serif" },
  { id: "comfortaa", name: "Comfortaa", family: "'Comfortaa', sans-serif", category: "Sans Serif" },
  { id: "varela-round", name: "Varela Round", family: "'Varela Round', sans-serif", category: "Sans Serif" },
  { id: "merriweather", name: "Merriweather", family: "'Merriweather', serif", category: "Serif" },
  { id: "playfair", name: "Playfair Display", family: "'Playfair Display', serif", category: "Serif" },
  { id: "libre-baskerville", name: "Libre Baskerville", family: "'Libre Baskerville', serif", category: "Serif" },
  { id: "crimson", name: "Crimson Text", family: "'Crimson Text', serif", category: "Serif" },
  { id: "source-serif", name: "Source Serif 4", family: "'Source Serif 4', serif", category: "Serif" },
  { id: "cormorant", name: "Cormorant Garamond", family: "'Cormorant Garamond', serif", category: "Serif" },
  { id: "eb-garamond", name: "EB Garamond", family: "'EB Garamond', serif", category: "Serif" },
  { id: "spectral", name: "Spectral", family: "'Spectral', serif", category: "Serif" },
  { id: "bitter", name: "Bitter", family: "'Bitter', serif", category: "Serif" },
  { id: "lora", name: "Lora", family: "'Lora', serif", category: "Serif" },
  { id: "source-code", name: "Source Code Pro", family: "'Source Code Pro', monospace", category: "Monospace" },
  { id: "fira-code", name: "Fira Code", family: "'Fira Code', monospace", category: "Monospace" },
  { id: "jetbrains", name: "JetBrains Mono", family: "'JetBrains Mono', monospace", category: "Monospace" },
  { id: "ibm-plex", name: "IBM Plex Mono", family: "'IBM Plex Mono', monospace", category: "Monospace" },
  { id: "space-mono", name: "Space Mono", family: "'Space Mono', monospace", category: "Monospace" },
  { id: "roboto-mono", name: "Roboto Mono", family: "'Roboto Mono', monospace", category: "Monospace" },
  { id: "cousine", name: "Cousine", family: "'Cousine', monospace", category: "Monospace" },
  { id: "anonymous", name: "Anonymous Pro", family: "'Anonymous Pro', monospace", category: "Monospace" },
  { id: "overpass-mono", name: "Overpass Mono", family: "'Overpass Mono', monospace", category: "Monospace" },
  { id: "inconsolata", name: "Inconsolata", family: "'Inconsolata', monospace", category: "Monospace" },
] as const;

export const FONT_SIZE_OPTIONS = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"] as const;

export const TEXT_COLORS = [
  { id: "default", label: "Default", color: "inherit" },
  { id: "red", label: "Red", color: "#ef4444" },
  { id: "orange", label: "Orange", color: "#f97316" },
  { id: "yellow", label: "Yellow", color: "#eab308" },
  { id: "green", label: "Green", color: "#22c55e" },
  { id: "blue", label: "Blue", color: "#3b82f6" },
  { id: "purple", label: "Purple", color: "#a855f7" },
  { id: "pink", label: "Pink", color: "#ec4899" },
  { id: "gray", label: "Gray", color: "#6b7280" },
] as const;

export const EDITOR_SURFACE_CLASS = cn(
  "min-h-0 flex-1 w-full overflow-y-auto outline-none focus:outline-none caret-primary rounded-[8px] border border-border/50 bg-background/40",
  "px-6 py-5 leading-relaxed",
  "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3",
  "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2",
  "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2",
  "[&_p]:mb-3 [&_p]:text-foreground/90",
  "[&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-3 [&_ul]:space-y-1.5",
  "[&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-3 [&_ol]:space-y-1.5",
  "[&_li]:text-foreground/90 [&_li]:pl-1",
  "[&_blockquote]:border-l-4 [&_blockquote]:border-primary/60 [&_blockquote]:pl-4 [&_blockquote]:py-1 [&_blockquote]:italic [&_blockquote]:text-foreground/80 [&_blockquote]:my-4",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_em]:italic",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  /* Dock-to-note chrome details live in index.css (.notebook-media--dock) */
  "[&_.notebook-table-wrapper]:relative",
  "[&_.notebook-table]:rounded-xl [&_.notebook-table]:overflow-hidden",
  "[&_.notebook-table_td]:bg-background/50 [&_.notebook-table_td]:hover:bg-muted/50",
  "[&_.notebook-table_td:focus]:outline-none [&_.notebook-table_td:focus]:ring-2 [&_.notebook-table_td:focus]:ring-primary/30 [&_.notebook-table_td:focus]:ring-inset",
  "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none",
);

const DOCK_WIDTH_ATTR = "data-dock-width";

/** Study “dock to note” shell — centered card, default 720px, image keeps its aspect. */
export function notebookImageHtml(src: string, width = STUDY_VIDEO_DEFAULT_WIDTH) {
  const safe = src.replace(/"/g, "&quot;");
  const w = Math.max(STUDY_VIDEO_MIN_WIDTH, Math.round(width));
  return `<div class="notebook-media notebook-media--dock" contenteditable="false" ${DOCK_WIDTH_ATTR}="${w}" style="width:${w}px"><div class="notebook-media__stage"><img src="${safe}" alt="" draggable="false" /><button type="button" class="notebook-media__resize" aria-label="Resize image" contenteditable="false"></button></div></div><p><br></p>`;
}

function ensureDockChrome(wrap: HTMLElement, img: HTMLImageElement) {
  wrap.classList.add("notebook-media", "notebook-media--dock");
  wrap.contentEditable = "false";
  img.removeAttribute("style");
  img.removeAttribute("width");
  img.removeAttribute("height");
  img.draggable = false;

  let stage = wrap.querySelector<HTMLElement>(":scope > .notebook-media__stage");
  if (!stage) {
    stage = document.createElement("div");
    stage.className = "notebook-media__stage";
    wrap.appendChild(stage);
  }
  if (img.parentElement !== stage) {
    stage.appendChild(img);
  }

  if (!stage.querySelector(":scope > .notebook-media__resize")) {
    const resize = document.createElement("button");
    resize.type = "button";
    resize.className = "notebook-media__resize";
    resize.setAttribute("aria-label", "Resize image");
    resize.contentEditable = "false";
    stage.appendChild(resize);
  }

  const stored = Number(wrap.getAttribute(DOCK_WIDTH_ATTR));
  const width =
    Number.isFinite(stored) && stored > 0
      ? Math.max(STUDY_VIDEO_MIN_WIDTH, Math.round(stored))
      : STUDY_VIDEO_DEFAULT_WIDTH;
  wrap.setAttribute(DOCK_WIDTH_ATTR, String(width));
  wrap.style.width = `${width}px`;
  wrap.style.maxWidth = "100%";
}

/** Upgrade images to study dock-to-note chrome (centered, resizable card). */
export function enhanceNotebookMedia(root: HTMLElement | null) {
  if (!root) return;
  root.querySelectorAll("img").forEach((img) => {
    const existing = img.closest<HTMLElement>(".notebook-media");
    if (existing) {
      ensureDockChrome(existing, img);
      return;
    }
    const wrap = document.createElement("div");
    img.parentNode?.insertBefore(wrap, img);
    wrap.appendChild(img);
    ensureDockChrome(wrap, img);
  });
  bindNotebookMediaDock(root);
}

/** Pointer-resize for docked notebook images (same feel as study video dock). */
export function bindNotebookMediaDock(root: HTMLElement | null) {
  if (!root || (root as HTMLElement & { __notebookDockBound?: boolean }).__notebookDockBound) {
    return;
  }
  (root as HTMLElement & { __notebookDockBound?: boolean }).__notebookDockBound = true;

  let active: {
    wrap: HTMLElement;
    startX: number;
    startW: number;
  } | null = null;

  const onMove = (event: PointerEvent) => {
    if (!active) return;
    const parentW = root.clientWidth || STUDY_VIDEO_DEFAULT_WIDTH * 1.5;
    const delta = event.clientX - active.startX;
    // Grow from center like docked study video (2× delta).
    const next = Math.round(
      Math.min(
        parentW,
        Math.max(STUDY_VIDEO_MIN_WIDTH, active.startW + delta * 2),
      ),
    );
    active.wrap.style.width = `${next}px`;
    active.wrap.setAttribute(DOCK_WIDTH_ATTR, String(next));
  };

  const onUp = () => {
    active = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    root.dispatchEvent(new Event("input", { bubbles: true }));
  };

  root.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement | null;
    const handle = target?.closest?.(".notebook-media__resize");
    if (!handle || !root.contains(handle)) return;
    const wrap = handle.closest<HTMLElement>(".notebook-media--dock");
    if (!wrap) return;
    event.preventDefault();
    event.stopPropagation();
    active = {
      wrap,
      startX: event.clientX,
      startW: wrap.getBoundingClientRect().width,
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });
}

const toolbarBtnClass =
  "h-8 w-8 p-0 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground";

export interface NotebookEditorToolbarProps {
  disabled?: boolean;
  notebookFont?: string;
  onFontChange?: (fontId: string) => void;
  fontSize: string;
  onFontSizeChange: (size: string) => void;
  activeTextColor: string;
  onTextColorChange: (color: string) => void;
  onInsertImage: () => void;
}

export function NotebookEditorToolbar({
  disabled = false,
  notebookFont = "inter",
  onFontChange,
  fontSize,
  onFontSizeChange,
  activeTextColor,
  onTextColorChange,
  onInsertImage,
}: NotebookEditorToolbarProps) {
  const selectedFontFamily =
    NOTEBOOK_FONTS.find((f) => f.id === notebookFont)?.family || "'Inter', sans-serif";

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-1 py-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 rounded-md text-xs gap-1.5 min-w-[7.5rem] justify-between text-foreground hover:bg-muted/60"
            disabled={disabled}
          >
            <span className="truncate" style={{ fontFamily: selectedFontFamily }}>
              {NOTEBOOK_FONTS.find((f) => f.id === notebookFont)?.name || "Inter"}
            </span>
            <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto bg-background border border-border z-[80]">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 bg-background">
            Sans Serif
          </div>
          {NOTEBOOK_FONTS.filter((f) => f.category === "Sans Serif").map((font) => (
            <DropdownMenuItem
              key={font.id}
              onClick={() => onFontChange?.(font.id)}
              className={cn("text-xs cursor-pointer", notebookFont === font.id && "bg-primary/10")}
              style={{ fontFamily: font.family }}
            >
              {font.name}
            </DropdownMenuItem>
          ))}
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 bg-background mt-1">
            Serif
          </div>
          {NOTEBOOK_FONTS.filter((f) => f.category === "Serif").map((font) => (
            <DropdownMenuItem
              key={font.id}
              onClick={() => onFontChange?.(font.id)}
              className={cn("text-xs cursor-pointer", notebookFont === font.id && "bg-primary/10")}
              style={{ fontFamily: font.family }}
            >
              {font.name}
            </DropdownMenuItem>
          ))}
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 bg-background mt-1">
            Monospace
          </div>
          {NOTEBOOK_FONTS.filter((f) => f.category === "Monospace").map((font) => (
            <DropdownMenuItem
              key={font.id}
              onClick={() => onFontChange?.(font.id)}
              className={cn("text-xs cursor-pointer", notebookFont === font.id && "bg-primary/10")}
              style={{ fontFamily: font.family }}
            >
              {font.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 rounded-md text-xs gap-1 min-w-[4.25rem] justify-between text-foreground hover:bg-muted/60"
            disabled={disabled}
          >
            <span>{fontSize}</span>
            <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-28 bg-background border border-border z-[80]">
          {FONT_SIZE_OPTIONS.map((size) => (
            <DropdownMenuItem
              key={size}
              onClick={() => onFontSizeChange(size)}
              className={cn("text-xs cursor-pointer", fontSize === size && "bg-primary/10")}
            >
              {size}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-1.5 h-5 w-px bg-border/60" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => document.execCommand("bold")}
        className={toolbarBtnClass}
        disabled={disabled}
        title="Bold"
      >
        <Bold className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => document.execCommand("italic")}
        className={toolbarBtnClass}
        disabled={disabled}
        title="Italic"
      >
        <Italic className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => document.execCommand("underline")}
        className={toolbarBtnClass}
        disabled={disabled}
        title="Underline"
      >
        <Underline className="w-3.5 h-3.5" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(toolbarBtnClass, "relative")}
            disabled={disabled}
            title="Text color"
          >
            <span
              className="h-3.5 w-3.5 rounded-full border border-border/70"
              style={{
                background: activeTextColor === "inherit" ? "hsl(var(--foreground))" : activeTextColor,
              }}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="p-2 bg-background border border-border z-[80]">
          <div className="grid grid-cols-4 gap-1.5">
            {TEXT_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                title={color.label}
                onClick={() => onTextColorChange(color.color)}
                className="h-6 w-6 rounded-full border border-border/60 hover:scale-110 transition-transform"
                style={{
                  background: color.color === "inherit" ? "hsl(var(--foreground))" : color.color,
                }}
              />
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-1.5 h-5 w-px bg-border/60" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => document.execCommand("justifyLeft")}
        className={toolbarBtnClass}
        disabled={disabled}
        title="Align left"
      >
        <AlignLeft className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => document.execCommand("justifyCenter")}
        className={toolbarBtnClass}
        disabled={disabled}
        title="Align center"
      >
        <AlignCenter className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => document.execCommand("justifyRight")}
        className={toolbarBtnClass}
        disabled={disabled}
        title="Align right"
      >
        <AlignRight className="w-3.5 h-3.5" />
      </Button>

      <div className="mx-1.5 h-5 w-px bg-border/60" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => document.execCommand("insertUnorderedList")}
        className={toolbarBtnClass}
        disabled={disabled}
        title="Bulleted list"
      >
        <List className="w-3.5 h-3.5" />
      </Button>

      <div className="mx-1.5 h-5 w-px bg-border/60" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          const url = prompt("Enter URL:");
          if (url) document.execCommand("createLink", false, url);
        }}
        className={toolbarBtnClass}
        disabled={disabled}
        title="Insert link"
      >
        <Link className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onInsertImage}
        className={toolbarBtnClass}
        disabled={disabled}
        title="Insert image"
      >
        <ImageIcon className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeightClass?: string;
  notebookFont?: string;
  onFontChange?: (fontId: string) => void;
  showCharCount?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing…",
  disabled = false,
  className,
  minHeightClass = "min-h-[12rem]",
  notebookFont = "inter",
  onFontChange,
  showCharCount = true,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [fontSize, setFontSize] = useState("16px");
  const [activeTextColor, setActiveTextColor] = useState("inherit");
  const [charCount, setCharCount] = useState(0);
  const skipNextSync = useRef(false);

  const selectedFontFamily = useMemo(
    () => NOTEBOOK_FONTS.find((f) => f.id === notebookFont)?.family || "'Inter', sans-serif",
    [notebookFont],
  );

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    if (document.activeElement === el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || "";
      enhanceNotebookMedia(el);
      const text = el.innerText.trim();
      setCharCount(text.length);
    }
  }, [value]);

  const emitChange = () => {
    const el = editorRef.current;
    if (!el) return;
    skipNextSync.current = true;
    const html = el.innerHTML;
    const text = el.innerText.trim();
    setCharCount(text.length);
    onChange(html);
  };

  const focusEditor = () => {
    editorRef.current?.focus();
    return editorRef.current;
  };

  const applyFontSize = (size: string) => {
    setFontSize(size);
    const target = focusEditor();
    if (!target || disabled) return;
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("fontSize", false, "7");
    target.querySelectorAll('font[size="7"]').forEach((fontEl) => {
      const span = document.createElement("span");
      span.style.fontSize = size;
      while (fontEl.firstChild) span.appendChild(fontEl.firstChild);
      fontEl.parentNode?.replaceChild(span, fontEl);
    });
    emitChange();
  };

  const applyTextColor = (color: string) => {
    setActiveTextColor(color);
    focusEditor();
    if (disabled) return;
    if (color === "inherit") {
      document.execCommand("removeFormat", false);
    } else {
      document.execCommand("foreColor", false, color);
    }
    emitChange();
  };

  const insertImage = (file: File) => {
    if (disabled) return;
    const reader = new FileReader();
    reader.onload = () => {
      focusEditor();
      const src = typeof reader.result === "string" ? reader.result : "";
      if (!src) return;
      document.execCommand("insertHTML", false, notebookImageHtml(src));
      enhanceNotebookMedia(editorRef.current);
      emitChange();
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) insertImage(file);
          e.target.value = "";
        }}
      />
      <div className="shrink-0 border-b border-border/20">
        <NotebookEditorToolbar
          disabled={disabled}
          notebookFont={notebookFont}
          onFontChange={onFontChange}
          fontSize={fontSize}
          onFontSizeChange={applyFontSize}
          activeTextColor={activeTextColor}
          onTextColorChange={applyTextColor}
          onInsertImage={() => imageInputRef.current?.click()}
        />
      </div>
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emitChange}
        style={{ fontFamily: selectedFontFamily, fontSize }}
        className={cn(
          EDITOR_SURFACE_CLASS,
          minHeightClass,
          "mt-2",
          disabled && "cursor-not-allowed opacity-70",
        )}
      />
      {showCharCount ? (
        <p className="mt-2 shrink-0 text-xs text-muted-foreground tabular-nums">
          {charCount.toLocaleString()} characters
        </p>
      ) : null}
    </div>
  );
}
