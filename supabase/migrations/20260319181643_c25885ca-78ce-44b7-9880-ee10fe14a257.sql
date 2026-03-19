
ALTER TABLE public.sdr_leads 
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE text USING status::text;

UPDATE public.sdr_leads SET status = '1º Mensagem' WHERE status = '1 mensagem';

DROP TYPE public.lead_status;
CREATE TYPE public.lead_status AS ENUM ('Abordado', '1º Mensagem', 'Agendado', 'Descartado');

ALTER TABLE public.sdr_leads 
  ALTER COLUMN status TYPE public.lead_status USING status::public.lead_status,
  ALTER COLUMN status SET DEFAULT 'Abordado'::public.lead_status;
