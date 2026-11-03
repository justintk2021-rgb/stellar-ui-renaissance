import type { ComponentProps } from "react";
import { NotebookView } from "@/components/Notebook/NotebookView";
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
  ...notebookProps
}: NotebookProps & {
  view: "notebook" | "study";
  category: StudyCategory;
  displayName?: string;
  focusStudyNoteId?: string | null;
  onStudyFocusHandled?: () => void;
  onOpenStudyJournal?: (tradeId: string) => void;
  onOpenStudyPlaybook?: (playbookId: string | null) => void;
}) {
  if (view === "notebook") {
    return (
      <div className="notebook-theme">
        <NotebookView {...notebookProps} />
      </div>
    );
  }

  return (
    <StudyArea
      userId={notebookProps.userId}
      trades={notebookProps.trades}
      focusNoteId={focusStudyNoteId}
      onFocusHandled={onStudyFocusHandled}
      category={category}
      displayName={displayName}
      onOpenJournal={onOpenStudyJournal}
      onOpenPlaybook={onOpenStudyPlaybook}
    />
  );
}
