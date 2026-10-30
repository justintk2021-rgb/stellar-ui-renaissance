import { createContext, useContext } from "react";
import type { Trade } from "@/types/trade";

export interface StudyPlaybook {
  id: string;
  name: string;
}

interface StudyEditorData {
  trades: Trade[];
  playbooks: StudyPlaybook[];
  onOpenJournal?: (tradeId: string) => void;
  onOpenPlaybook?: (playbookId: string | null) => void;
}

const StudyEditorDataContext = createContext<StudyEditorData>({ trades: [], playbooks: [] });

export const StudyEditorDataProvider = StudyEditorDataContext.Provider;

export function useStudyEditorData(): StudyEditorData {
  return useContext(StudyEditorDataContext);
}
