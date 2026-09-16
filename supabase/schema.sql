-- Mesa de Jogo: tabela única de documentos sincronizados.
-- Cada linha é um documento do utilizador: 'roster', 'training' ou 'game:<id>'.
-- Corre este ficheiro uma vez no SQL Editor do Supabase.

create table if not exists public.docs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  data jsonb not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists docs_user_updated on public.docs (user_id, updated_at);

-- A hora de alteração é sempre a do servidor, para os dispositivos não dependerem do relógio de cada um.
create or replace function public.docs_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists docs_touch on public.docs;
create trigger docs_touch
  before insert or update on public.docs
  for each row execute function public.docs_touch_updated_at();

-- Cada utilizador só vê e altera os seus próprios documentos.
alter table public.docs enable row level security;

drop policy if exists "docs do próprio utilizador" on public.docs;
create policy "docs do próprio utilizador" on public.docs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.docs from anon;
grant select, insert, update, delete on public.docs to authenticated;
