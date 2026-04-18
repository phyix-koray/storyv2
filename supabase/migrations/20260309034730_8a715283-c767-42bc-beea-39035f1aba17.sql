ALTER TABLE public.story_templates 
ADD COLUMN IF NOT EXISTS character_ids jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS object_ids jsonb DEFAULT '[]'::jsonb;