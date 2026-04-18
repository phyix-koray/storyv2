ALTER TABLE public.project_videos ADD COLUMN IF NOT EXISTS frame_number integer;

-- Add UPDATE policy for project_videos so we can upsert
CREATE POLICY "Users can update own videos" ON public.project_videos
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM story_projects
  WHERE story_projects.id = project_videos.project_id
    AND story_projects.user_id = auth.uid()
));

-- Add unique constraint for upsert by project_id + frame_number
ALTER TABLE public.project_videos ADD CONSTRAINT project_videos_project_frame_unique UNIQUE (project_id, frame_number);