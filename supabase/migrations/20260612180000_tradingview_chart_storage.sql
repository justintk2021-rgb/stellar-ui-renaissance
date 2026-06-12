-- TradingView Advanced Charts storage: layouts, drawings, and templates.
-- Backs the IExternalSaveLoadAdapter implemented in src/lib/chartStorage.ts.

-- Saved chart layouts (one row per saved chart)
CREATE TABLE public.chart_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT '',
  resolution TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drawings stored separately from layouts (saveload_separate_drawings_storage).
-- One row per (layout, chart) pair; state holds the full line-tools map.
CREATE TABLE public.chart_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  layout_id TEXT NOT NULL,
  chart_id TEXT NOT NULL,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, layout_id, chart_id)
);

-- Saved indicator (study) templates
CREATE TABLE public.chart_study_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

-- Saved drawing templates (per drawing tool)
CREATE TABLE public.chart_drawing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tool_name, name)
);

CREATE INDEX idx_chart_layouts_user ON public.chart_layouts(user_id);
CREATE INDEX idx_chart_drawings_user_layout ON public.chart_drawings(user_id, layout_id);
CREATE INDEX idx_chart_study_templates_user ON public.chart_study_templates(user_id);
CREATE INDEX idx_chart_drawing_templates_user ON public.chart_drawing_templates(user_id);

-- RLS: each user can only touch their own rows
ALTER TABLE public.chart_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_study_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_drawing_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chart layouts"
  ON public.chart_layouts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own chart drawings"
  ON public.chart_drawings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own study templates"
  ON public.chart_study_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own drawing templates"
  ON public.chart_drawing_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chart_layouts_touch
  BEFORE UPDATE ON public.chart_layouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER chart_drawings_touch
  BEFORE UPDATE ON public.chart_drawings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
