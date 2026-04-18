
ALTER TABLE public.project_frames 
ADD COLUMN IF NOT EXISTS dialogues jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.project_frames 
ADD COLUMN IF NOT EXISTS shot_breakdown jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS project_frames_project_frame_unique 
ON public.project_frames (project_id, frame_number);
