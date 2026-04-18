
CREATE TABLE public.story_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  story_language text DEFAULT 'tr',
  story_topic text DEFAULT '',
  frame_count integer,
  art_style text DEFAULT 'default',
  image_format text DEFAULT 'square',
  per_frame_mode boolean DEFAULT false,
  frame_prompts jsonb DEFAULT '[]'::jsonb,
  use_character_avatars boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.story_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates" ON public.story_templates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own templates" ON public.story_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON public.story_templates FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON public.story_templates FOR DELETE TO authenticated USING (auth.uid() = user_id);
