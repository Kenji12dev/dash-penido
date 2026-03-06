
CREATE TABLE public.individual_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  month integer NOT NULL,
  year integer NOT NULL,
  week_number integer, -- NULL for monthly goals
  period_type text NOT NULL DEFAULT 'monthly', -- 'monthly' or 'weekly'
  goal_value numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (collaborator_id, month, year, period_type, week_number)
);

ALTER TABLE public.individual_goals ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view goals
CREATE POLICY "Authenticated users can view individual goals"
  ON public.individual_goals FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert individual goals"
  ON public.individual_goals FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update
CREATE POLICY "Admins can update individual goals"
  ON public.individual_goals FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "Admins can delete individual goals"
  ON public.individual_goals FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
