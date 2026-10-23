-- RDO preenchivel sobre o modelo original, com historico append-only.
create table if not exists public.rdos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete restrict,
  data date not null,
  conteudo jsonb not null default '{}'::jsonb,
  criado_por uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid references public.perfis(id) on delete set null
);

create table if not exists public.rdo_historico (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid references public.rdos(id) on delete set null,
  obra_id uuid not null references public.obras(id) on delete restrict,
  operacao text not null check (operacao in ('insert', 'update', 'delete', 'restore')),
  antes jsonb,
  depois jsonb,
  autor_id uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);

create or replace function public.registrar_historico_rdo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  operacao text;
begin
  if tg_op = 'INSERT' then operacao := 'insert';
  elsif tg_op = 'DELETE' then operacao := 'delete';
  elsif old.excluido_em is null and new.excluido_em is not null then operacao := 'delete';
  elsif old.excluido_em is not null and new.excluido_em is null then operacao := 'restore';
  else operacao := 'update';
  end if;

  insert into public.rdo_historico(rdo_id, obra_id, operacao, antes, depois, autor_id)
  values (
    coalesce(new.id, old.id),
    coalesce(new.obra_id, old.obra_id),
    operacao,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    auth.uid()
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists trg_rdos_atualizado on public.rdos;
create trigger trg_rdos_atualizado before update on public.rdos
for each row execute function public.tocar_atualizado_em();

drop trigger if exists trg_rdos_historico on public.rdos;
create trigger trg_rdos_historico after insert or update or delete on public.rdos
for each row execute function public.registrar_historico_rdo();

alter table public.rdos enable row level security;
alter table public.rdo_historico enable row level security;

drop policy if exists rdos_select on public.rdos;
create policy rdos_select on public.rdos for select to authenticated using (true);
drop policy if exists rdos_gestor_escreve on public.rdos;
create policy rdos_gestor_escreve on public.rdos for all to authenticated
using (public.e_gestor()) with check (public.e_gestor());

drop policy if exists rdo_historico_select on public.rdo_historico;
create policy rdo_historico_select on public.rdo_historico for select to authenticated using (true);

create index if not exists idx_rdos_obra_data on public.rdos(obra_id, data desc);
create index if not exists idx_rdos_ativos on public.rdos(obra_id, data desc) where excluido_em is null;
create index if not exists idx_rdo_historico_rdo on public.rdo_historico(rdo_id, criado_em desc);
create unique index if not exists uq_rdos_obra_data_ativo on public.rdos(obra_id, data) where excluido_em is null;
