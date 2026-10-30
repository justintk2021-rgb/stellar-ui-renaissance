import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queries/keys";

export function StudyNoteMentions({
  tradeId,
  onOpen,
}: {
  tradeId: string;
  onOpen?: (noteId: string) => void;
}) {
  const mentions = useQuery({
    queryKey: [...queryKeys.study.mentions(tradeId), tradeId],
    queryFn: async () => {
      const { data: links, error } = await supabase.from("study_note_trades").select("note_id").eq("trade_id", tradeId);
      if (error) throw error;
      const ids = (links ?? []).map((link) => link.note_id);
      if (!ids.length) return [];
      const { data: notes, error: notesError } = await supabase.from("study_notes").select("id, title").in("id", ids);
      if (notesError) throw notesError;
      return notes ?? [];
    },
    retry: false,
  });

  if (!mentions.data?.length) return null;

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Study notes mentioning this trade</p>
      {mentions.data.map((note) => (
        <button
          key={note.id}
          type="button"
          onClick={() => onOpen?.(note.id)}
          className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-left text-sm hover:border-primary/40 hover:bg-primary/5"
        >
          <span className="truncate font-medium">{note.title || "Untitled note"}</span>
          <span className="shrink-0 text-[11px] text-primary">Open</span>
        </button>
      ))}
    </div>
  );
}
