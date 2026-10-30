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
  color: string | null;
  sort_order: number;
  updated_at?: string;
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

type StudyTree = { folders: StudyFolder[]; notes: StudyNote[] };

function storeKey(userId: string) {
  return `nsync-study-tree:${userId}`;
}

function readLocal(userId: string): StudyTree {
  try {
    const raw = localStorage.getItem(storeKey(userId));
    if (!raw) return { folders: [], notes: [] };
    const parsed = JSON.parse(raw) as Partial<StudyTree>;
    return { folders: parsed.folders ?? [], notes: parsed.notes ?? [] };
  } catch {
    return { folders: [], notes: [] };
  }
}

function writeLocal(userId: string, tree: StudyTree) {
  try {
    localStorage.setItem(storeKey(userId), JSON.stringify(tree));
  } catch {
    // Persistence is best-effort if storage is blocked.
  }
}

function mergeById<T extends { id: string }>(remote: T[], local: T[]): T[] {
  const seen = new Set(remote.map((item) => item.id));
  return [...remote, ...local.filter((item) => !seen.has(item.id))];
}

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

async function loadTree(userId: string): Promise<StudyTree> {
  const local = readLocal(userId);
  const full = await Promise.all([
    supabase.from("study_folders").select("id, user_id, parent_id, name, category, color, sort_order, updated_at").eq("user_id", userId).order("sort_order"),
    supabase.from("study_notes").select("id, user_id, folder_id, title, category, content, updated_at").eq("user_id", userId).order("updated_at", { ascending: false }),
  ]);
  const foldersResult = full[0].error
    ? await supabase.from("study_folders").select("id, user_id, parent_id, name, category, sort_order, updated_at").eq("user_id", userId).order("sort_order")
    : full[0];
  const foldersFallback = foldersResult.error
    ? await supabase.from("study_folders").select("id, user_id, parent_id, name, sort_order").eq("user_id", userId).order("sort_order")
    : foldersResult;
  const notesResult = full[1].error
    ? await supabase.from("study_notes").select("id, user_id, folder_id, title, content, updated_at").eq("user_id", userId).order("updated_at", { ascending: false })
    : full[1];

  const remoteFolders = foldersFallback.error ? [] : (foldersFallback.data ?? []).map((folder) => ({
    id: folder.id,
    user_id: folder.user_id,
    parent_id: folder.parent_id,
    name: folder.name,
    sort_order: folder.sort_order,
    updated_at: "updated_at" in folder && typeof folder.updated_at === "string" ? folder.updated_at : undefined,
    color: "color" in folder && typeof folder.color === "string" && folder.color ? folder.color : null,
    category: "category" in folder && typeof folder.category === "string" && folder.category ? folder.category : "individual",
  }));
  const remoteNotes = notesResult.error ? [] : (notesResult.data ?? []).map((note) => ({
    id: note.id,
    user_id: note.user_id,
    folder_id: note.folder_id,
    title: note.title,
    updated_at: note.updated_at,
    category: "category" in note && typeof note.category === "string" && note.category ? note.category : "individual",
    content: (note.content as JSONContent) ?? EMPTY_STUDY_DOC,
  }));

  const tree = {
    folders: mergeById(remoteFolders, local.folders),
    notes: mergeById(remoteNotes, local.notes),
  };
  writeLocal(userId, tree);
  return tree;
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
      if (notesError || linksError) return [];
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
  return (next?: StudyTree) => {
    if (!userId) return;
    if (next) {
      writeLocal(userId, next);
      queryClient.setQueryData(queryKeys.study.tree(userId), next);
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.study.tree(userId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.study.mentions(userId) });
  };
}

function currentTree(userId: string, queryClient: ReturnType<typeof useQueryClient>): StudyTree {
  return queryClient.getQueryData<StudyTree>(queryKeys.study.tree(userId)) ?? readLocal(userId);
}

export function useStudyMutations(userId: string | undefined) {
  const invalidate = useInvalidate(userId);
  const queryClient = useQueryClient();

  const createFolder = useMutation({
    mutationFn: async (input: { name: string; parentId: string | null; category: string; color?: string | null }) => {
      if (!userId) throw new Error("Sign in to create a folder.");
      const folder: StudyFolder = {
        id: newId(),
        user_id: userId,
        parent_id: input.parentId,
        name: input.name.trim() || "Untitled folder",
        category: input.category,
        color: input.color ?? null,
        sort_order: 0,
        updated_at: nowIso(),
      };
      const payload = {
        id: folder.id,
        user_id: userId,
        name: folder.name,
        parent_id: input.parentId,
        category: input.category,
        color: input.color ?? null,
      };
      const withColor = await supabase.from("study_folders").insert(payload);
      if (withColor.error) {
        const { color: _color, ...withoutColor } = payload;
        await supabase.from("study_folders").insert(withoutColor);
      }
      const tree = currentTree(userId, queryClient);
      const next = { ...tree, folders: [...tree.folders, folder] };
      invalidate(next);
      return folder.id;
    },
  });

  const renameFolder = useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      if (!userId) throw new Error("Sign in to rename a folder.");
      await supabase.from("study_folders").update({ name: input.name }).eq("id", input.id).eq("user_id", userId);
      const tree = currentTree(userId, queryClient);
      invalidate({
        ...tree,
        folders: tree.folders.map((folder) => folder.id === input.id ? { ...folder, name: input.name, updated_at: nowIso() } : folder),
      });
    },
  });

  const moveFolder = useMutation({
    mutationFn: async (input: { id: string; parentId: string | null }) => {
      if (!userId) throw new Error("Sign in to move a folder.");
      await supabase.from("study_folders").update({ parent_id: input.parentId }).eq("id", input.id).eq("user_id", userId);
      const tree = currentTree(userId, queryClient);
      invalidate({
        ...tree,
        folders: tree.folders.map((folder) => folder.id === input.id ? { ...folder, parent_id: input.parentId } : folder),
      });
    },
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("Sign in to delete a folder.");
      await supabase.from("study_folders").delete().eq("id", id).eq("user_id", userId);
      const tree = currentTree(userId, queryClient);
      invalidate({
        folders: tree.folders.filter((folder) => folder.id !== id),
        notes: tree.notes.map((note) => note.folder_id === id ? { ...note, folder_id: null } : note),
      });
    },
  });

  const createNote = useMutation({
    mutationFn: async (input: { folderId: string | null; category: string }) => {
      if (!userId) throw new Error("Sign in to create a note.");
      const note: StudyNote = {
        id: newId(),
        user_id: userId,
        folder_id: input.folderId,
        title: "Untitled note",
        category: input.category,
        content: EMPTY_STUDY_DOC,
        updated_at: nowIso(),
      };
      const inserted = await supabase.from("study_notes").insert({
        id: note.id,
        user_id: userId,
        folder_id: input.folderId,
        category: input.category,
        title: note.title,
        content: EMPTY_STUDY_DOC as Json,
      }).select("id").single();
      if (!inserted.error && inserted.data?.id) note.id = inserted.data.id;
      const tree = currentTree(userId, queryClient);
      invalidate({ ...tree, notes: [note, ...tree.notes] });
      return note.id;
    },
  });

  const saveNote = useMutation({
    mutationFn: async (input: { id: string; title: string; content: JSONContent }) => {
      if (!userId) throw new Error("Sign in to save a note.");
      await supabase.from("study_notes").update({
        title: input.title,
        content: input.content as Json,
      }).eq("id", input.id).eq("user_id", userId);
      const ids = tradeIdsInDoc(input.content);
      await supabase.from("study_note_trades").delete().eq("note_id", input.id);
      if (ids.length) {
        await supabase.from("study_note_trades").insert(ids.map((tradeId) => ({ note_id: input.id, trade_id: tradeId })));
      }
      const tree = currentTree(userId, queryClient);
      invalidate({
        ...tree,
        notes: tree.notes.map((note) => note.id === input.id
          ? { ...note, title: input.title, content: input.content, updated_at: nowIso() }
          : note),
      });
    },
  });

  const moveNote = useMutation({
    mutationFn: async (input: { id: string; folderId: string | null }) => {
      if (!userId) throw new Error("Sign in to move a note.");
      await supabase.from("study_notes").update({ folder_id: input.folderId }).eq("id", input.id).eq("user_id", userId);
      const tree = currentTree(userId, queryClient);
      invalidate({
        ...tree,
        notes: tree.notes.map((note) => note.id === input.id ? { ...note, folder_id: input.folderId, updated_at: nowIso() } : note),
      });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("Sign in to delete a note.");
      await supabase.from("study_notes").delete().eq("id", id).eq("user_id", userId);
      const tree = currentTree(userId, queryClient);
      invalidate({ ...tree, notes: tree.notes.filter((note) => note.id !== id) });
    },
  });

  return { createFolder, renameFolder, moveFolder, deleteFolder, createNote, saveNote, moveNote, deleteNote };
}
