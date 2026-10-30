import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/core";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queries/keys";
import { EMPTY_STUDY_DOC, tradeIdsInDoc } from "@/lib/studyArea";

export interface StudyFolder {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  category: string;
  sort_order: number;
}

export interface StudyNote {
  id: string;
  user_id: string;
  folder_id: string | null;
  title: string;
  category: string;
  content: JSONContent;
  updated_at: string;
}

export interface StudyMention {
  tradeId: string;
  noteId: string;
  title: string;
}

async function loadTree(userId: string): Promise<{ folders: StudyFolder[]; notes: StudyNote[] }> {
  const [folders, notes] = await Promise.all([
    supabase.from("study_folders").select("id, user_id, parent_id, name, category, sort_order").eq("user_id", userId).order("sort_order"),
    supabase.from("study_notes").select("id, user_id, folder_id, title, category, content, updated_at").eq("user_id", userId).order("updated_at", { ascending: false }),
  ]);
  if (folders.error) throw folders.error;
  if (notes.error) throw notes.error;
  return {
    folders: folders.data ?? [],
    notes: (notes.data ?? []).map((note) => ({
      ...note,
      content: (note.content as JSONContent) ?? EMPTY_STUDY_DOC,
    })),
  };
}

export function useStudyTree(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.study.tree(userId ?? ""),
    queryFn: () => loadTree(userId!),
    enabled: !!userId,
  });
}

export function useStudyMentions(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.study.mentions(userId ?? ""),
    enabled: !!userId,
    queryFn: async (): Promise<StudyMention[]> => {
      const [{ data: notes, error: notesError }, { data: links, error: linksError }] = await Promise.all([
        supabase.from("study_notes").select("id, title").eq("user_id", userId!),
        supabase.from("study_note_trades").select("note_id, trade_id"),
      ]);
      if (notesError) throw notesError;
      if (linksError) throw linksError;
      const titles = new Map((notes ?? []).map((note) => [note.id, note.title || "Untitled note"]));
      return (links ?? [])
        .filter((link) => titles.has(link.note_id))
        .map((link) => ({
          tradeId: link.trade_id,
          noteId: link.note_id,
          title: titles.get(link.note_id) || "Untitled note",
        }));
    },
  });
}

function useInvalidate(userId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.study.tree(userId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.study.mentions(userId) });
  };
}

export function useStudyMutations(userId: string | undefined) {
  const invalidate = useInvalidate(userId);

  const createFolder = useMutation({
    mutationFn: async (input: { name: string; parentId: string | null; category: string }) => {
      const { error } = await supabase.from("study_folders").insert({
        user_id: userId!,
        name: input.name,
        parent_id: input.parentId,
        category: input.category,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const renameFolder = useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase.from("study_folders").update({ name: input.name }).eq("id", input.id).eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const moveFolder = useMutation({
    mutationFn: async (input: { id: string; parentId: string | null }) => {
      const { error } = await supabase.from("study_folders").update({ parent_id: input.parentId }).eq("id", input.id).eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("study_folders").delete().eq("id", id).eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const createNote = useMutation({
    mutationFn: async (input: { folderId: string | null; category: string }) => {
      const { data, error } = await supabase.from("study_notes").insert({
        user_id: userId!,
        folder_id: input.folderId,
        category: input.category,
        title: "Untitled note",
        content: EMPTY_STUDY_DOC as Json,
      }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalidate,
  });

  const saveNote = useMutation({
    mutationFn: async (input: { id: string; title: string; content: JSONContent }) => {
      const ids = tradeIdsInDoc(input.content);
      const { error } = await supabase.from("study_notes").update({
        title: input.title,
        content: input.content as Json,
      }).eq("id", input.id).eq("user_id", userId!);
      if (error) throw error;
      const { error: clearError } = await supabase.from("study_note_trades").delete().eq("note_id", input.id);
      if (clearError) throw clearError;
      if (ids.length) {
        const { error: linkError } = await supabase.from("study_note_trades").insert(
          ids.map((tradeId) => ({ note_id: input.id, trade_id: tradeId })),
        );
        if (linkError) throw linkError;
      }
    },
    onSuccess: invalidate,
  });

  const moveNote = useMutation({
    mutationFn: async (input: { id: string; folderId: string | null }) => {
      const { error } = await supabase.from("study_notes").update({ folder_id: input.folderId }).eq("id", input.id).eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("study_notes").delete().eq("id", id).eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { createFolder, renameFolder, moveFolder, deleteFolder, createNote, saveNote, moveNote, deleteNote };
}
