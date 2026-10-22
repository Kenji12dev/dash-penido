-- Notificacoes push no celular.
--
-- 1. `push_subscriptions`: uma linha por aparelho que aceitou receber push,
--    ligada ao usuario logado. O proprio usuario gerencia as suas linhas.
-- 2. Trigger em `sales`: toda insercao ou mudanca de status/closer/sdr chama
--    a edge function `send-push`, que decide quem avisa e manda o push.
--
-- O segredo que autentica a chamada do banco na function fica no Vault
-- (nome `push_webhook_secret`), nunca neste arquivo. Criar com:
--   select vault.create_secret('<valor de PUSH_WEBHOOK_SECRET>', 'push_webhook_secret');

create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions"
  on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Dispara a function `send-push` com o mesmo formato dos Database Webhooks do
-- Supabase ({type, table, record, old_record}) mais `actor`, o usuario que fez
-- a alteracao, para ele nao receber aviso do que ele mesmo acabou de fazer.
create or replace function public.notify_push_on_sales()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
begin
  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'push_webhook_secret'
  limit 1;

  -- Sem segredo configurado a function recusaria; nao vale travar a venda por isso.
  if secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://wonrnuesgjygdnqbofes.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', secret
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'record', to_jsonb(new),
      'old_record', case when TG_OP = 'UPDATE' then to_jsonb(old) else null end,
      'actor', auth.uid()
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

drop trigger if exists sales_push_notify on public.sales;
create trigger sales_push_notify
  after insert or update of status, closer, sdr
  on public.sales
  for each row
  execute function public.notify_push_on_sales();

-- Lembretes do push: call em 30 min (a cada 5 min) e diario do SDR (19h Brasilia).
alter table public.sales add column if not exists call_reminder_sent_at timestamptz;

-- Se a call for remarcada, o lembrete vale de novo.
create or replace function public.reset_call_reminder()
returns trigger
language plpgsql
as $$
begin
  if new.date is distinct from old.date then
    new.call_reminder_sent_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists sales_reset_call_reminder on public.sales;
create trigger sales_reset_call_reminder
  before update of date on public.sales
  for each row execute function public.reset_call_reminder();

create extension if not exists pg_cron;

-- Chama a send-push com o segredo do Vault (mesmo do trigger de sales).
create or replace function public.push_invoke(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
begin
  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'push_webhook_secret'
  limit 1;
  if secret is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://wonrnuesgjygdnqbofes.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    body := payload,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.push_invoke(jsonb) from public, anon, authenticated;

select cron.unschedule(jobname) from cron.job where jobname in ('push-lembrete-call', 'push-diario-sdr');

select cron.schedule('push-lembrete-call', '*/5 * * * *', $$select public.push_invoke('{"action":"call_reminders"}'::jsonb)$$);
select cron.schedule('push-diario-sdr', '0 22 * * *', $$select public.push_invoke('{"action":"sdr_daily_reminder"}'::jsonb)$$);
