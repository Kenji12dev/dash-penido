
-- Create enums for lead status and classification
CREATE TYPE public.lead_status AS ENUM ('Novo', 'Em contato', 'Qualificado', 'Agendado', 'No-show', 'Descartado');
CREATE TYPE public.lead_classification AS ENUM ('Quente', 'Morno', 'Frio');

-- Create sdr_leads table
CREATE TABLE public.sdr_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sdr_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  instagram TEXT NOT NULL DEFAULT '',
  status lead_status NOT NULL DEFAULT 'Novo',
  classificacao lead_classification NOT NULL DEFAULT 'Morno',
  follow_up_date TIMESTAMP WITH TIME ZONE,
  observacoes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sdr_leads ENABLE ROW LEVEL SECURITY;

-- SDRs can view own leads, admins can view all
CREATE POLICY "SDRs view own leads, admins view all"
  ON public.sdr_leads FOR SELECT TO authenticated
  USING (
    sdr_id IN (SELECT id FROM public.collaborators WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- SDRs can insert own leads
CREATE POLICY "SDRs insert own leads"
  ON public.sdr_leads FOR INSERT TO authenticated
  WITH CHECK (
    sdr_id IN (SELECT id FROM public.collaborators WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- SDRs can update own leads, admins can update all
CREATE POLICY "SDRs update own leads, admins update all"
  ON public.sdr_leads FOR UPDATE TO authenticated
  USING (
    sdr_id IN (SELECT id FROM public.collaborators WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- SDRs can delete own leads, admins can delete all
CREATE POLICY "SDRs delete own leads, admins delete all"
  ON public.sdr_leads FOR DELETE TO authenticated
  USING (
    sdr_id IN (SELECT id FROM public.collaborators WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sdr_leads;
