-- Leads no Kanban de vendas.
--
-- Os leads entram na mesma tabela `sales` com status Aplicacao (valores
-- zerados, closer/produto em branco), passam por 'Ativado' e viram
-- 'Pendente' quando a call e agendada. 'Descartado' encerra o lead.
-- So esquema: nenhum dado existente e alterado.
-- (ASCII puro: o status com acento vem de chr(), o editor do painel corrompe acentos.)

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS instagram text,
  -- Respostas do formulario, "Pergunta: resposta" por linha. `notes` fica para o SDR.
  ADD COLUMN IF NOT EXISTS form_answers text,
  -- Id da resposta no formulario externo (Respondi).
  ADD COLUMN IF NOT EXISTS external_submission_id text,
  -- Primeira entrada em 'Ativado', para medir o tempo ate a abordagem.
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

-- Idempotencia da integracao: reenvio do formulario nao duplica o cartao.
-- O indice NAO pode ser parcial: o upsert do supabase-js emite
-- ON CONFLICT (external_submission_id) sem predicado, e o Postgres recusa um
-- indice parcial como arbitro (500). NULL e distinto de NULL, entao as vendas
-- sem id continuam podendo ser quantas forem.
CREATE UNIQUE INDEX IF NOT EXISTS sales_external_submission_id_key
  ON public.sales (external_submission_id);

CREATE INDEX IF NOT EXISTS sales_status_idx ON public.sales (status);

-- Grava a primeira ativacao; se o lead volta de Ativado para Aplicacao, zera
-- para que a proxima ativacao seja medida de novo.
CREATE OR REPLACE FUNCTION public.set_activated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'Ativado'
     AND NEW.status = 'Aplica' || chr(231) || chr(227) || 'o' THEN
    NEW.activated_at := NULL;
  ELSIF NEW.status = 'Ativado'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'Ativado')
     AND NEW.activated_at IS NULL THEN
    NEW.activated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_set_activated_at ON public.sales;
CREATE TRIGGER sales_set_activated_at
BEFORE INSERT OR UPDATE OF status ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.set_activated_at();
