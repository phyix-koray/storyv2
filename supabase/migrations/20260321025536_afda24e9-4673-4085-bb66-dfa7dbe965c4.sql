
-- Add plan fields to user_credits table
ALTER TABLE public.user_credits 
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_started_at timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamp with time zone DEFAULT NULL;
