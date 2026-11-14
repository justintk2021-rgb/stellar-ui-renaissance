import type { ComponentProps } from "react";
import { NotebookView } from "@/components/Notebook/NotebookView";
import { PsychologyJournalView } from "@/components/Notebook/PsychologyJournalView";
import { StudyArea } from "@/components/study/StudyArea";
import type { StudyCategory } from "@/lib/studyArea";

export const NOTEBOOK_VIEW_KEY = "nsync-notebook-view";

type NotebookProps = ComponentProps<typeof NotebookView>;

export function NotebookSection({
  view,
  category,
  displayName,
  focusStudyNoteId,
  onStudyFocusHandled,
  onOpenStudyJournal,
  onOpenStudyPlaybook,
  selectedCategory,
  onSelectedCategoryChange,
  ...notebookProps
}: NotebookProps & {
  view: "notebook" | "study";
  category: StudyCategory;
  displayName?: string;
  focusStudyNoteId?: string | null;
  onStudyFocusHandled?: () => void;
  onOpenStudyJournal?: (tradeId: string) => void;
  onOpenStudyPlaybook?: (playbookId: string | null) => void;
  selectedCategory?: string;
  onSelectedCategoryChange?: (category: string) => void;
}) {
  if (view === "notebook") {
    if (selectedCategory === "journal") {
      return (
        <div className="notebook-theme">
          <PsychologyJournalView
            trades={notebookProps.trades}
            userId={notebookProps.userId}
            notebookEntries={notebookProps.notebookEntries}
            onSaveEntry={notebookProps.onSaveEntry}
            focusTradeId={notebookProps.selectedTradeId}
            onFocusHandled={() => notebookProps.onSelectTrade?.(null)}
          />
        </div>
      );
    }

    return (
      <div className="notebook-theme">
        <NotebookView
          {...notebookProps}
          selectedCategory={selectedCategory === "journal" ? "all" : selectedCategory}
          onSelectedCategoryChange={onSelectedCategoryChange}
        />
      </div>
    );
  }

  return (
    <StudyArea
      userId={notebookProps.userId}
      trades={notebookProps.trades}
      notebookEntries={notebookProps.notebookEntries}
      focusNoteId={focusStudyNoteId}
      onFocusHandled={onStudyFocusHandled}
      category={category}
      displayName={displayName}
      onOpenJournal={onOpenStudyJournal}
      onOpenPlaybook={onOpenStudyPlaybook}
    />
  );
}
