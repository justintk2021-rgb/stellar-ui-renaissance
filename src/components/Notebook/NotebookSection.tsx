import type { ComponentProps } from "react";
import { NotebookView } from "@/components/Notebook/NotebookView";
import { StudyArea } from "@/components/study/StudyArea";
import type { StudyCategory } from "@/lib/studyArea";

export const NOTEBOOK_VIEW_KEY = "nsync-notebook-view";

type NotebookProps = ComponentProps<typeof NotebookView>;

export function NotebookSection({
  view,
  category,
  focusStudyNoteId,
  onStudyFocusHandled,
  ...notebookProps
}: NotebookProps & {
  view: "notebook" | "study";
  category: StudyCategory;
  focusStudyNoteId?: string | null;
  onStudyFocusHandled?: () => void;
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
    />
  );
}
