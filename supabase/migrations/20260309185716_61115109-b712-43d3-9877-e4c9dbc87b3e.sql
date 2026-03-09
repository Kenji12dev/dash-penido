
ALTER TABLE public.sdr_goals ADD COLUMN week_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.sdr_goals DROP CONSTRAINT sdr_goals_collaborator_id_month_year_key;
ALTER TABLE public.sdr_goals ADD CONSTRAINT sdr_goals_collaborator_id_month_year_week_key UNIQUE (collaborator_id, month, year, week_number);
