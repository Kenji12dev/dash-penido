
-- Fix 1: Replace overly permissive RLS policies on google_calendar_tokens
-- Only allow users to access tokens for their own linked collaborator (or admins)

DROP POLICY "Authenticated users can view tokens" ON public.google_calendar_tokens;
DROP POLICY "Authenticated users can insert tokens" ON public.google_calendar_tokens;
DROP POLICY "Authenticated users can update tokens" ON public.google_calendar_tokens;
DROP POLICY "Authenticated users can delete tokens" ON public.google_calendar_tokens;

CREATE POLICY "Users can view own tokens"
  ON public.google_calendar_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.collaborators c
      WHERE c.id = collaborator_id
      AND (c.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Users can insert own tokens"
  ON public.google_calendar_tokens FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.collaborators c
      WHERE c.id = collaborator_id
      AND (c.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Users can update own tokens"
  ON public.google_calendar_tokens FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.collaborators c
      WHERE c.id = collaborator_id
      AND (c.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Users can delete own tokens"
  ON public.google_calendar_tokens FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.collaborators c
      WHERE c.id = collaborator_id
      AND (c.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );
