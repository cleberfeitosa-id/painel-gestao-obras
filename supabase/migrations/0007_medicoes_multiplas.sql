-- ============================================================================
-- Painel de Gestao de Obras - Vasconcelos Engenharia
-- Migracao 0007: Medicoes multiplas por tarefa
--   - catalogo_precos.titulo_tarefa -> nome (UNIQUE (obra_id, nome))
--   - tarefa_medicoes: N medicoes por tarefa, cada uma apontando p/ catalogo
--   - tarefas.quantidade removida (substituida por tarefa_medicoes)
--   - valor_executado_obra / valor_pendente_obra recalculadas via tarefa_medicoes
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. catalogo_precos: titulo_tarefa -> nome
--    A constraint antiga referencia a coluna renomeada; recriamos com o nome
--    novo para manter a semantica (mesmo nome na mesma obra = mesmo preco).
-- ---------------------------------------------------------------------------
alter table public.catalogo_precos
  rename column titulo_tarefa to nome;

alter table public.catalogo_precos
  drop constraint if exists catalogo_precos_obra_titulo_unicos;

alter table public.catalogo_precos
  add constraint catalogo_precos_obra_nome_unicos unique (obra_id, nome);

-- ---------------------------------------------------------------------------
-- 2. tarefa_medicoes: N medicoes por tarefa
--    catalogo_id com on delete restrict: nao deixa apagar um item do catalogo
--    que ainda tem medicao registrada (evita perder o preco unitario).
-- ---------------------------------------------------------------------------
create table if not exists public.tarefa_medicoes (
  id           uuid primary key default gen_random_uuid(),
  tarefa_id    uuid not null references public.tarefas (id) on delete cascade,
  catalogo_id  uuid not null references public.catalogo_precos (id) on delete restrict,
  quantidade   numeric(14, 2) not null check (quantidade >= 0),
  criado_por   uuid references public.perfis (id) on delete set null,
  criado_em    timestamptz not null default now()
);

create index if not exists idx_tarefa_medicoes_tarefa
  on public.tarefa_medicoes (tarefa_id);

create index if not exists idx_tarefa_medicoes_catalogo
  on public.tarefa_medicoes (catalogo_id);

-- ---------------------------------------------------------------------------
-- 3. Migra dados: tarefas.quantidade -> tarefa_medicoes
--    So migra quando existe entrada no catalogo (join por nome = titulo).
--    Tarefas com quantidade sem catalogo correspondente perdem a medicao
--    (o modelo antigo ja nao conseguia calcular valor nesses casos).
-- ---------------------------------------------------------------------------
insert into public.tarefa_medicoes (tarefa_id, catalogo_id, quantidade)
select t.id, c.id, t.quantidade
from public.tarefas t
join public.catalogo_precos c
  on c.obra_id = t.obra_id and c.nome = t.titulo
where t.quantidade is not null;

-- ---------------------------------------------------------------------------
-- 4. tarefas.quantidade removida
-- ---------------------------------------------------------------------------
alter table public.tarefas
  drop column if exists quantidade;

-- ---------------------------------------------------------------------------
-- 5. Funcoes de calculo de valor executado / pendente
--    Valor = soma(quantidade * valor_unitario) das medicoes da tarefa,
--    filtrando pelo status da tarefa. Inner join e suficiente: toda medicao
--    referencia um catalogo (catalogo_id not null).
-- ---------------------------------------------------------------------------
create or replace function public.valor_executado_obra(p_obra_id uuid)
returns numeric(14, 2)
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(tm.quantidade * c.valor_unitario), 0)
  from public.tarefa_medicoes tm
  join public.tarefas t on t.id = tm.tarefa_id
  join public.catalogo_precos c on c.id = tm.catalogo_id
  where t.obra_id = p_obra_id
    and t.status = 'concluido'
$$;

create or replace function public.valor_pendente_obra(p_obra_id uuid)
returns numeric(14, 2)
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(tm.quantidade * c.valor_unitario), 0)
  from public.tarefa_medicoes tm
  join public.tarefas t on t.id = tm.tarefa_id
  join public.catalogo_precos c on c.id = tm.catalogo_id
  where t.obra_id = p_obra_id
    and t.status <> 'concluido'
$$;

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
--    Leitura para todos autenticados; escrita para gestores/admin e para o
--    responsavel da tarefa (mesmo modelo de tarefas: o responsavel registra
--    a propria medicao).
-- ---------------------------------------------------------------------------
alter table public.tarefa_medicoes enable row level security;

drop policy if exists tarefa_medicoes_select on public.tarefa_medicoes;
create policy tarefa_medicoes_select on public.tarefa_medicoes
  for select to authenticated using (true);

drop policy if exists tarefa_medicoes_responsavel_escreve on public.tarefa_medicoes;
create policy tarefa_medicoes_responsavel_escreve on public.tarefa_medicoes
  for all to authenticated
  using (
    exists (
      select 1 from public.tarefas t
      where t.id = tarefa_id and t.responsavel_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.tarefas t
      where t.id = tarefa_id and t.responsavel_id = (select auth.uid())
    )
  );

drop policy if exists tarefa_medicoes_gestor_escreve on public.tarefa_medicoes;
create policy tarefa_medicoes_gestor_escreve on public.tarefa_medicoes
  for all to authenticated
  using (public.e_gestor())
  with check (public.e_gestor());