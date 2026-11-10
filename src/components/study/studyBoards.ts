const BOARDS_KEY = "nsync-study-boards";

export type StudyBoard = { id: string; name: string; folderId: string | null };

export function readBoards(): StudyBoard[] {
  try {
    const raw = localStorage.getItem(BOARDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<StudyBoard>>;
    return Array.isArray(parsed)
      ? parsed
          .filter((board): board is Partial<StudyBoard> & { id: string; name: string } => !!board?.id && !!board?.name)
          .map((board) => ({ id: board.id, name: board.name, folderId: board.folderId ?? null }))
      : [];
  } catch {
    return [];
  }
}

export function persistBoards(boards: StudyBoard[]) {
  try {
    localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
  } catch {
    // Board names stay in memory if storage is blocked.
  }
}
