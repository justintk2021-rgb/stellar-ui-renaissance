import type { ReactNode } from "react";
import { FileText, Home, LayoutGrid, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { studyFolderColor } from "@/lib/studyArea";
import type { StudyTab } from "./studyTabs";

export function StudyTabStrip({
  tabs,
  activeKey,
  onActivate,
  onClose,
  onNewWorkspace,
  className,
}: {
  tabs: StudyTab[];
  activeKey: string;
  onActivate: (key: string) => void;
  onClose: (key: string) => void;
  onNewWorkspace?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-end gap-1 overflow-x-auto border-b border-border/40 bg-muted/25 px-1.5 pt-1.5 scrollbar-thin",
        className,
      )}
      role="tablist"
      aria-label="Study tabs"
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        const rawColor = tab.kind === "note" || tab.kind === "board" ? tab.color : null;
        const accent = rawColor != null && rawColor !== "" ? studyFolderColor(rawColor) : null;
        return (
          <div
            key={tab.key}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            onClick={() => onActivate(tab.key)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onActivate(tab.key);
              }
            }}
            className={cn(
              "group relative flex max-w-[11rem] min-w-[7rem] shrink-0 cursor-pointer items-center gap-1.5 rounded-t-lg border border-b-0 px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
              active
                ? "z-[1] border-border/50 bg-background text-foreground shadow-[0_-1px_0_hsl(var(--background))]"
                : "border-transparent bg-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
            style={
              accent
                ? active
                  ? { boxShadow: `inset 0 2px 0 0 ${accent}`, borderTopColor: accent }
                  : { borderTopColor: accent, borderTopWidth: 2 }
                : undefined
            }
          >
            <TabIcon kind={tab.kind} accent={accent} />
            <span className="min-w-0 flex-1 truncate">{tab.title}</span>
            {tab.kind !== "home" ? (
              <button
                type="button"
                aria-label={`Close ${tab.title}`}
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                  !active && "opacity-0 group-hover:opacity-100",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(tab.key);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            ) : (
              <span className="h-4 w-4 shrink-0" />
            )}
          </div>
        );
      })}
      {onNewWorkspace ? (
        <button
          type="button"
          aria-label="New workspace"
          title="New workspace"
          onClick={onNewWorkspace}
          className="mb-0.5 ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function TabIcon({
  kind,
  accent,
}: {
  kind: StudyTab["kind"];
  accent: string | null;
}): ReactNode {
  if (kind === "home") return <Home className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  if (kind === "board") {
    return (
      <LayoutGrid
        className={cn("h-3.5 w-3.5 shrink-0", !accent && "text-muted-foreground")}
        style={accent ? { color: accent } : undefined}
      />
    );
  }
  return (
    <FileText
      className={cn("h-3.5 w-3.5 shrink-0", !accent && "text-muted-foreground")}
      style={accent ? { color: accent } : undefined}
    />
  );
}
