-- ============================================================================
-- Painel de Gestao de Obras - Vasconcelos Engenharia
-- Migracao 0002: Modulo de Medicao
--   - catalogo_precos: valor unitario + unidade por (obra, titulo_tarefa)
--   - tarefas.quantidade: medicao por instancia de tarefa
--   - obras.valor_contrato: valor total contratado da obra
--   - funcoes de calculo de valor executado/pendente
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. catalogo_precos
--    Garante no nivel do banco que tarefas com o MESMO titulo na MESMA obra
--    compartilham o mesmo valor_unitario e unidade (UNIQUE em obra_id+titulo).
-- ---------------------------------------------------------------------------
create table if not exists public.catalogo_precos (
  id             uuid primary key default gen_random_uuid(),
  obra_id        uuid not null references public.obras (id) on delete cascade,
  titulo_tarefa  text not null,
  valor_unitario numeric(14, 2) not null check (valor_unitario >= 0),
  unidade        text not null default 'm',
  criado_por     uuid references public.perfis (id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint catalogo_precos_obra_titulo_unicos unique (obra_id, titulo_tarefa)
);

create index if not exists idx_catalogo_precos_obra on public.catalogo_precos (obra_id);

-- ---------------------------------------------------------------------------
-- 2. tarefas.quantidade
--    Medicao por instancia. O valor unitario/unidade vem do catalogo.
-- ---------------------------------------------------------------------------
alter table public.tarefas
  add column if not exists quantidade numeric(14, 2) check (quantidade >= 0);

-- ---------------------------------------------------------------------------
-- 3. obras.valor_contrato
-- ---------------------------------------------------------------------------
alter table public.obras
  add column if not exists valor_contrato numeric(14, 2) check (valor_contrato >= 0);

-- ---------------------------------------------------------------------------
-- 4. Trigger de atualizado_em no catalogo
-- ---------------------------------------------------------------------------
drop trigger if exists trg_catalogo_precos_atualizado on public.catalogo_precos;
create trigger trg_catalogo_precos_atualizado before update on public.catalogo_precos
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- 5. Funcoes de calculo de valor executado / pendente
--    Valor executado = soma(quantidade * valor_unitario) das tarefas concluidas.
--    Valor pendente   = soma(quantidade * valor_unitario) das demais.
--    Usa LEFT JOIN para nao perder tarefas sem entrada no catalogo.
-- ---------------------------------------------------------------------------
create or replace function public.valor_executado_obra(p_obra_id uuid)
returns numeric(14, 2)
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(t.quantidade * c.valor_unitario), 0)
  from public.tarefas t
  left join public.catalogo_precos c
    on c.obra_id = t.obra_id and c.titulo_tarefa = t.titulo
  where t.obra_id = p_obra_id
    and t.status = 'concluido'
    and t.quantidade is not null
$$;

create or replace function public.valor_pendente_obra(p_obra_id uuid)
returns numeric(14, 2)
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(t.quantidade * c.valor_unitario), 0)
  from public.tarefas t
  left join public.catalogo_precos c
    on c.obra_id = t.obra_id and c.titulo_tarefa = t.titulo
  where t.obra_id = p_obra_id
    and t.status <> 'concluido'
    and t.quantidade is not null
$$;

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
--    Mesmo modelo das demais tabelas: leitura para todos autenticados,
--    escrita para gestores/admin.
-- ---------------------------------------------------------------------------
alter table public.catalogo_precos enable row level security;

drop policy if exists catalogo_precos_select on public.catalogo_precos;
create policy catalogo_precos_select on public.catalogo_precos
  for select to authenticated using (true);

drop policy if exists catalogo_precos_gestor_escreve on public.catalogo_precos;
create policy catalogo_precos_gestor_escreve on public.catalogo_precos
  for all to authenticated
  using (public.e_gestor())
  with check (public.e_gestor());
