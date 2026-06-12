/**
 * Supabase-backed save/load adapter for TradingView Advanced Charts.
 *
 * Implements the IExternalSaveLoadAdapter contract so users' chart layouts,
 * drawings, and templates persist per-account (RLS keyed on auth.uid()).
 *
 * The Charting Library itself is NOT yet installed — this module has no
 * dependency on it. Once the library lands in public/charting_library, pass
 * `createChartStorageAdapter(userId)` as `save_load_adapter` in the widget
 * constructor, along with:
 *
 *   saveload_separate_drawings_storage: true
 *
 * Types below mirror the library's interfaces structurally, so the adapter
 * satisfies IExternalSaveLoadAdapter without importing it.
 */
import { supabase } from "@/integrations/supabase/client";

/* ----- Structural types (mirror Charting Library shapes) ----- */

export interface ChartMetaInfo {
  id: string;
  name: string;
  symbol: string;
  resolution: string;
  timestamp: number;
}

export interface ChartData {
  id?: string;
  name: string;
  symbol: string;
  resolution: string;
  content: string;
}

interface StudyTemplateMetaInfo {
  name: string;
}

interface StudyTemplateData {
  name: string;
  content: string;
}

type LineToolsAndGroupsState = {
  sources?: Map<string, unknown> | Record<string, unknown> | null;
  groups?: Map<string, unknown> | Record<string, unknown> | null;
};

/** Convert Maps to plain objects so they survive JSON serialization. */
function mapToRecord(value: LineToolsAndGroupsState[keyof LineToolsAndGroupsState]): Record<string, unknown> {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  return value as Record<string, unknown>;
}

export function createChartStorageAdapter(userId: string) {
  return {
    /* ----- Chart layouts ----- */

    async getAllCharts(): Promise<ChartMetaInfo[]> {
      const { data, error } = await supabase
        .from("chart_layouts")
        .select("id, name, symbol, resolution, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        symbol: row.symbol as string,
        resolution: row.resolution as string,
        timestamp: Math.round(new Date(row.updated_at as string).getTime() / 1000),
      }));
    },

    async saveChart(chartData: ChartData): Promise<string> {
      if (chartData.id) {
        const { error } = await supabase
          .from("chart_layouts")
          .update({
            name: chartData.name,
            symbol: chartData.symbol,
            resolution: chartData.resolution,
            content: chartData.content,
          })
          .eq("id", chartData.id)
          .eq("user_id", userId);
        if (error) throw error;
        return chartData.id;
      }
      const { data, error } = await supabase
        .from("chart_layouts")
        .insert({
          user_id: userId,
          name: chartData.name,
          symbol: chartData.symbol,
          resolution: chartData.resolution,
          content: chartData.content,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },

    async getChartContent(chartId: string): Promise<string> {
      const { data, error } = await supabase
        .from("chart_layouts")
        .select("content")
        .eq("id", String(chartId))
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return data.content as string;
    },

    async removeChart(chartId: string): Promise<void> {
      const { error } = await supabase
        .from("chart_layouts")
        .delete()
        .eq("id", String(chartId))
        .eq("user_id", userId);
      if (error) throw error;
    },

    /* ----- Drawings (separate storage) ----- */

    async saveLineToolsAndGroups(
      layoutId: string | undefined,
      chartId: string | number,
      state: LineToolsAndGroupsState,
    ): Promise<void> {
      const layout = layoutId ?? "__unsaved__";
      const { error } = await supabase.from("chart_drawings").upsert(
        {
          user_id: userId,
          layout_id: layout,
          chart_id: String(chartId),
          state: {
            sources: mapToRecord(state.sources),
            groups: mapToRecord(state.groups),
          },
        },
        { onConflict: "user_id,layout_id,chart_id" },
      );
      if (error) throw error;
    },

    async loadLineToolsAndGroups(
      layoutId: string | undefined,
      chartId: string | number,
    ): Promise<Partial<LineToolsAndGroupsState> | null> {
      const layout = layoutId ?? "__unsaved__";
      const { data, error } = await supabase
        .from("chart_drawings")
        .select("state")
        .eq("user_id", userId)
        .eq("layout_id", layout)
        .eq("chart_id", String(chartId))
        .maybeSingle();
      if (error) throw error;
      if (!data?.state) return null;
      const state = data.state as { sources?: Record<string, unknown>; groups?: Record<string, unknown> };
      return {
        sources: new Map(Object.entries(state.sources ?? {})),
        groups: new Map(Object.entries(state.groups ?? {})),
      };
    },

    /* ----- Study (indicator) templates ----- */

    async getAllStudyTemplates(): Promise<StudyTemplateMetaInfo[]> {
      const { data, error } = await supabase
        .from("chart_study_templates")
        .select("name")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => ({ name: r.name as string }));
    },

    async saveStudyTemplate(studyTemplateData: StudyTemplateData): Promise<void> {
      const { error } = await supabase.from("chart_study_templates").upsert(
        {
          user_id: userId,
          name: studyTemplateData.name,
          content: studyTemplateData.content,
        },
        { onConflict: "user_id,name" },
      );
      if (error) throw error;
    },

    async getStudyTemplateContent(studyTemplateData: StudyTemplateMetaInfo): Promise<string> {
      const { data, error } = await supabase
        .from("chart_study_templates")
        .select("content")
        .eq("user_id", userId)
        .eq("name", studyTemplateData.name)
        .single();
      if (error) throw error;
      return data.content as string;
    },

    async removeStudyTemplate(studyTemplateData: StudyTemplateMetaInfo): Promise<void> {
      const { error } = await supabase
        .from("chart_study_templates")
        .delete()
        .eq("user_id", userId)
        .eq("name", studyTemplateData.name);
      if (error) throw error;
    },

    /* ----- Drawing templates ----- */

    async getDrawingTemplates(toolName: string): Promise<string[]> {
      const { data, error } = await supabase
        .from("chart_drawing_templates")
        .select("name")
        .eq("user_id", userId)
        .eq("tool_name", toolName);
      if (error) throw error;
      return (data ?? []).map((r) => r.name as string);
    },

    async saveDrawingTemplate(toolName: string, templateName: string, content: string): Promise<void> {
      const { error } = await supabase.from("chart_drawing_templates").upsert(
        {
          user_id: userId,
          tool_name: toolName,
          name: templateName,
          content,
        },
        { onConflict: "user_id,tool_name,name" },
      );
      if (error) throw error;
    },

    async loadDrawingTemplate(toolName: string, templateName: string): Promise<string> {
      const { data, error } = await supabase
        .from("chart_drawing_templates")
        .select("content")
        .eq("user_id", userId)
        .eq("tool_name", toolName)
        .eq("name", templateName)
        .single();
      if (error) throw error;
      return data.content as string;
    },

    async removeDrawingTemplate(toolName: string, templateName: string): Promise<void> {
      const { error } = await supabase
        .from("chart_drawing_templates")
        .delete()
        .eq("user_id", userId)
        .eq("tool_name", toolName)
        .eq("name", templateName);
      if (error) throw error;
    },

    /* ----- Chart templates (optional; not supported yet) ----- */

    async getAllChartTemplates(): Promise<string[]> {
      return [];
    },
    async saveChartTemplate(): Promise<void> {
      /* not supported */
    },
    async removeChartTemplate(): Promise<void> {
      /* not supported */
    },
    async getChartTemplateContent(): Promise<{ content: undefined }> {
      return { content: undefined };
    },
  };
}

export type ChartStorageAdapter = ReturnType<typeof createChartStorageAdapter>;
