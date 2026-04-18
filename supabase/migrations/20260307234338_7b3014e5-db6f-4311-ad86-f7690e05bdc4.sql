
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- user_credits table
CREATE TABLE public.user_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  credits INTEGER NOT NULL DEFAULT 100,
  is_unlimited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own credits" ON public.user_credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credits" ON public.user_credits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own credits" ON public.user_credits FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_user_credits_updated_at BEFORE UPDATE ON public.user_credits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create credits row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, credits, is_unlimited) VALUES (NEW.id, 100, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created_credits AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();

-- story_projects table
CREATE TABLE public.story_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_topic TEXT,
  style TEXT DEFAULT 'default',
  story_language TEXT DEFAULT 'tr',
  frame_count INTEGER,
  image_format TEXT DEFAULT 'square',
  folder_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.story_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own projects" ON public.story_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.story_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.story_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.story_projects FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_story_projects_updated_at BEFORE UPDATE ON public.story_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- project_frames table
CREATE TABLE public.project_frames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.story_projects(id) ON DELETE CASCADE,
  frame_number INTEGER NOT NULL,
  scene_description TEXT,
  image_path TEXT,
  text_overlays JSONB DEFAULT '[]'::jsonb,
  duration REAL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.project_frames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own frames" ON public.project_frames FOR SELECT USING (EXISTS (SELECT 1 FROM public.story_projects WHERE id = project_frames.project_id AND user_id = auth.uid()));
CREATE POLICY "Users can insert own frames" ON public.project_frames FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.story_projects WHERE id = project_frames.project_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own frames" ON public.project_frames FOR UPDATE USING (EXISTS (SELECT 1 FROM public.story_projects WHERE id = project_frames.project_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own frames" ON public.project_frames FOR DELETE USING (EXISTS (SELECT 1 FROM public.story_projects WHERE id = project_frames.project_id AND user_id = auth.uid()));

-- project_videos table
CREATE TABLE public.project_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.story_projects(id) ON DELETE CASCADE,
  video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.project_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own videos" ON public.project_videos FOR SELECT USING (EXISTS (SELECT 1 FROM public.story_projects WHERE id = project_videos.project_id AND user_id = auth.uid()));
CREATE POLICY "Users can insert own videos" ON public.project_videos FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.story_projects WHERE id = project_videos.project_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own videos" ON public.project_videos FOR DELETE USING (EXISTS (SELECT 1 FROM public.story_projects WHERE id = project_videos.project_id AND user_id = auth.uid()));

-- saved_characters table
CREATE TABLE public.saved_characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  features TEXT DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own characters" ON public.saved_characters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own characters" ON public.saved_characters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own characters" ON public.saved_characters FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own characters" ON public.saved_characters FOR DELETE USING (auth.uid() = user_id);

-- saved_objects table
CREATE TABLE public.saved_objects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own objects" ON public.saved_objects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own objects" ON public.saved_objects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own objects" ON public.saved_objects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own objects" ON public.saved_objects FOR DELETE USING (auth.uid() = user_id);

-- story_folders table
CREATE TABLE public.story_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.story_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own folders" ON public.story_folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own folders" ON public.story_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own folders" ON public.story_folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own folders" ON public.story_folders FOR DELETE USING (auth.uid() = user_id);

-- Add folder_id FK to story_projects
ALTER TABLE public.story_projects ADD CONSTRAINT fk_story_projects_folder FOREIGN KEY (folder_id) REFERENCES public.story_folders(id) ON DELETE SET NULL;

-- Storage bucket for story images
INSERT INTO storage.buckets (id, name, public) VALUES ('story-images', 'story-images', false);
CREATE POLICY "Users can upload own images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'story-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own images" ON storage.objects FOR SELECT USING (bucket_id = 'story-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own images" ON storage.objects FOR DELETE USING (bucket_id = 'story-images' AND auth.uid()::text = (storage.foldername(name))[1]);
