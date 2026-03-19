
-- Convert column to text first
ALTER TABLE public.sdr_leads 
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE text USING status::text;

-- Map old values to new
UPDATE public.sdr_leads SET status = 'Abordado' WHERE status IN ('Novo', 'Em contato');
UPDATE public.sdr_leads SET status = '1 mensagem' WHERE status = 'Qualificado';
UPDATE public.sdr_leads SET status = 'Descartado' WHERE status IN ('No-show', 'Descartado');
-- 'Agendado' stays as is

-- Drop old enum and create new
DROP TYPE public.lead_status;
CREATE TYPE public.lead_status AS ENUM ('Abordado', '1 mensagem', 'Agendado', 'Descartado');

-- Convert back to enum
ALTER TABLE public.sdr_leads 
  ALTER COLUMN status TYPE public.lead_status USING status::public.lead_status,
  ALTER COLUMN status SET DEFAULT 'Abordado'::public.lead_status;
