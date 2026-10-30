import { useEffect, useState, type ComponentProps } from "react";
import { NotebookView } from "@/components/Notebook/NotebookView";
import { StudyArea } from "@/components/study/StudyArea";
import { cn } from "@/lib/utils";

export const NOTEBOOK_VIEW_KEY = "nsync-notebook-view";

type NotebookProps = ComponentProps<typeof NotebookView>;

export function NotebookSection({
  focusStudyNoteId,
  onStudyFocusHandled,
  ...notebookProps
}: NotebookProps & {
  focusStudyNoteId?: string | null;
  onStudyFocusHandled?: () => void;
}) {
  const [view, setView] = useState<"notebook" | "study">(() => {
    try {
      return localStorage.getItem(NOTEBOOK_VIEW_KEY) === "study" ? "study" : "notebook";
    } catch {
      return "notebook";
    }
  });

  useEffect(() => {
    if (focusStudyNoteId) setView("study");
  }, [focusStudyNoteId]);

  useEffect(() => {
    try {
      localStorage.setItem(NOTEBOOK_VIEW_KEY, view);
    } catch {
      // Preference is optional if storage is blocked.
    }
  }, [view]);

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Notebook view" className="inline-flex rounded-xl border border-border/60 bg-card/70 p-1 shadow-sm backdrop-blur">
        {(["notebook", "study"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={cn(
              "h-9 rounded-lg border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              view === id
                ? "border-primary/40 bg-primary text-primary-foreground"
                : "border-transparent bg-transparent text-foreground hover:border-border hover:bg-muted/60",
            )}
          >
            {id === "notebook" ? "Notebook" : "Study Area"}
          </button>
        ))}
      </div>
      {view === "notebook" ? (
        <div className="notebook-theme">
          <NotebookView {...notebookProps} />
        </div>
      ) : (
        <StudyArea
          userId={notebookProps.userId}
          trades={notebookProps.trades}
          focusNoteId={focusStudyNoteId}
          onFocusHandled={onStudyFocusHandled}
        />
      )}
    </div>
  );
}
