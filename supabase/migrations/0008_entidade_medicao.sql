-- ============================================================================
-- Painel de Gestao de Obras - Vasconcelos Engenharia
-- Migracao 0008: Medicao como entidade autonoma
--   - medicoes: N medicoes por obra (ex.: "Execucao Eletrica", "Infra Hidraulica")
--   - catalogo_precos.obra_id -> medicao_id (cada medicao tem seu catalogo)
--   - obras.valor_contrato removido (valor passa a ser por medicao)
--   - valor_executado_obra / valor_pendente_obra -> *_medicao(p_medicao_id)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. medicoes
--    Entidade autonoma: uma obra pode ter varias medicoes, cada uma com seu
--    proprio valor_contrato e seu proprio catalogo de precos.
-- ---------------------------------------------------------------------------
create table if not exists public.medicoes (
  id             uuid primary key default gen_random_uuid(),
  obra_id        uuid not null references public.obras (id) on delete cascade,
  titulo         text not null,
  valor_contrato numeric(14, 2) check (valor_contrato >= 0),
  criado_por     uuid references public.perfis (id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists idx_medicoes_obra on public.medicoes (obra_id);

-- ---------------------------------------------------------------------------
-- 2. Migra dados: cria "Medicao Principal" para cada obra existente
--    que tenha catalogo_precos ou valor_contrato, e guarda o id.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_medicao_id uuid;
begin
  for r in
    select distinct o.id as obra_id, o.valor_contrato
    from public.obras o
    where o.valor_contrato is not null
       or exists (select 1 from public.catalogo_precos c where c.obra_id = o.id)
  loop
    insert into public.medicoes (obra_id, titulo, valor_contrato, criado_por)
    values (r.obra_id, 'Medicao Principal', r.valor_contrato, null)
    returning id into v_medicao_id;

    -- Guarda o id da medicao criada para a obra (usado no passo 3).
    create temp table if not exists tmp_medicao_obra (
      obra_id uuid primary key,
      medicao_id uuid not null
    ) on commit drop;
    insert into tmp_medicao_obra (obra_id, medicao_id)
    values (r.obra_id, v_medicao_id)
    on conflict (obra_id) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. catalogo_precos: obra_id -> medicao_id
--    Adiciona a coluna, aponta os dados para a medicao criada, torna NOT NULL
--    e remove obra_id. Nova UNIQUE em (medicao_id, nome).
-- ---------------------------------------------------------------------------
alter table public.catalogo_precos
  add column if not exists medicao_id uuid references public.medicoes (id) on delete cascade;

-- Aponta cada linha do catalogo para a medicao da sua obra.
update public.catalogo_precos c
set medicao_id = m.medicao_id
from tmp_medicao_obra m
where m.obra_id = c.obra_id;

-- Obras sem medicao criada (sem catalogo/valor) nao tem linhas no catalogo,
-- entao o update acima cobre tudo. Garante que nenhuma linha ficou sem medicao.
alter table public.catalogo_precos
  alter column medicao_id set not null;

-- Remove a constraint antiga e a coluna obra_id.
alter table public.catalogo_precos
  drop constraint if exists catalogo_precos_obra_nome_unicos;

alter table public.catalogo_precos
  drop column if exists obra_id;

-- Nova UNIQUE: mesmo nome na mesma medicao = mesmo preco.
alter table public.catalogo_precos
  add constraint catalogo_precos_medicao_nome_unicos unique (medicao_id, nome);

drop index if exists idx_catalogo_precos_obra;
create index if not exists idx_catalogo_precos_medicao on public.catalogo_precos (medicao_id);

-- ---------------------------------------------------------------------------
-- 4. obras: remove valor_contrato (agora por medicao)
-- ---------------------------------------------------------------------------
alter table public.obras
  drop column if exists valor_contrato;

-- ---------------------------------------------------------------------------
-- 5. Funcoes de calculo de valor executado / pendente por medicao
--    Filtram pelo catalogo da medicao (c.medicao_id = p_medicao_id).
-- ---------------------------------------------------------------------------
create or replace function public.valor_executado_medicao(p_medicao_id uuid)
returns numeric(14, 2)
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(tm.quantidade * c.valor_unitario), 0)
  from public.tarefa_medicoes tm
  join public.tarefas t on t.id = tm.tarefa_id
  join public.catalogo_precos c on c.id = tm.catalogo_id
  where c.medicao_id = p_medicao_id
    and t.status = 'concluido'
$$;

create or replace function public.valor_pendente_medicao(p_medicao_id uuid)
returns numeric(14, 2)
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(tm.quantidade * c.valor_unitario), 0)
  from public.tarefa_medicoes tm
  join public.tarefas t on t.id = tm.tarefa_id
  join public.catalogo_precos c on c.id = tm.catalogo_id
  where c.medicao_id = p_medicao_id
    and t.status <> 'concluido'
$$;

-- Remove as funcoes antigas por obra (substituidas pelas por medicao).
drop function if exists public.valor_executado_obra(uuid);
drop function if exists public.valor_pendente_obra(uuid);

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
--    Mesmo modelo das demais: leitura para todos autenticados, escrita para
--    gestores/admin.
-- ---------------------------------------------------------------------------
alter table public.medicoes enable row level security;

drop policy if exists medicoes_select on public.medicoes;
create policy medicoes_select on public.medicoes
  for select to authenticated using (true);

drop policy if exists medicoes_gestor_escreve on public.medicoes;
create policy medicoes_gestor_escreve on public.medicoes
  for all to authenticated
  using (public.e_gestor())
  with check (public.e_gestor());

-- Trigger de atualizado_em nas medicoes.
drop trigger if exists trg_medicoes_atualizado on public.medicoes;
create trigger trg_medicoes_atualizado before update on public.medicoes
  for each row execute function public.tocar_atualizado_em();
