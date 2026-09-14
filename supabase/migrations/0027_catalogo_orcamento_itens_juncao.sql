-- ============================================================
-- Migration 0027: Tabela associativa catalogo_precos ↔
-- orcamento_itens (muitos-para-muitos). Substitui o campo
-- orcamento_item_id unico em catalogo_precos.
--
-- Um item do catalogo de precos de uma medicao pode estar
-- vinculado a MULTIPLOS itens do orcamento (ex: "Escavacao de
-- vala" pode corresponder a "10.1.2.1 Cordoalha de Cobre" +
-- "10.1.2.2 Haste de Aterramento").
-- ============================================================

-- ============================================================
-- 1. Tabela associativa
-- ============================================================
create table if not exists public.catalogo_precos_orcamento_itens (
  catalogo_id uuid not null references public.catalogo_precos(id) on delete cascade,
  orcamento_item_id uuid not null references public.orcamento_itens(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (catalogo_id, orcamento_item_id)
);

create index if not exists idx_cpoi_orcamento_item
  on public.catalogo_precos_orcamento_itens(orcamento_item_id);

alter table public.catalogo_precos_orcamento_itens enable row level security;

drop policy if exists cpoi_select on public.catalogo_precos_orcamento_itens;
create policy cpoi_select on public.catalogo_precos_orcamento_itens
  for select to authenticated using (true);

drop policy if exists cpoi_gestor on public.catalogo_precos_orcamento_itens;
create policy cpoi_gestor on public.catalogo_precos_orcamento_itens
  for all to authenticated using (public.e_gestor()) with check (public.e_gestor());

-- ============================================================
-- 2. Backfill: migra dados do campo unico para a juncao
-- ============================================================
insert into public.catalogo_precos_orcamento_itens (catalogo_id, orcamento_item_id)
select id, orcamento_item_id
from public.catalogo_precos
where orcamento_item_id is not null
on conflict do nothing;

-- ============================================================
-- 3. Atualiza RPC painel_financeiro_obra para usar juncao
-- ============================================================
create or replace function public.painel_financeiro_obra(p_obra_id uuid)
returns table (
  orcamento_item_id uuid, codigo text, descricao text, unidade text,
  quantidade_prevista numeric(20,4), previsto numeric(20,4),
  quantidade_medida numeric(20,4), medido numeric(20,4),
  quantidade_executada numeric(20,4), executado numeric(20,4),
  composicao_id uuid
) language sql stable set search_path = '' as $$
  select
    oi.id, oi.codigo, oi.descricao, oi.unidade,
    oi.quantidade,
    coalesce(nullif(oi.valor_total, 0), oi.quantidade * oi.valor_unitario),
    coalesce(med.quantidade_medida, 0), coalesce(med.medido, 0),
    coalesce(med.quantidade_executada, 0), coalesce(med.executado, 0),
    oi.composicao_id
  from public.orcamento_itens oi
  join public.orcamentos o on o.id = oi.orcamento_id
  left join (
    select j.orcamento_item_id,
      sum(tm.quantidade) as quantidade_medida,
      sum(tm.quantidade * c.valor_unitario) as medido,
      sum(tm.quantidade) filter (where t.status = 'concluido') as quantidade_executada,
      sum(tm.quantidade * c.valor_unitario) filter (where t.status = 'concluido') as executado
    from public.catalogo_precos_orcamento_itens j
    join public.catalogo_precos c on c.id = j.catalogo_id
    join public.tarefa_medicoes tm on tm.catalogo_id = c.id
    join public.tarefas t on t.id = tm.tarefa_id
    group by j.orcamento_item_id
  ) med on med.orcamento_item_id = oi.id
  where o.obra_id = p_obra_id and oi.ativo and oi.tipo = 'item'
$$;

-- ============================================================
-- 4. Atualiza RPC painel_compras_orcamento para usar juncao
-- ============================================================
create or replace function public.painel_compras_orcamento(p_obra_id uuid)
returns table (
  orcamento_item_id uuid, codigo text, descricao text, unidade text,
  quantidade_prevista numeric(20,4), previsto numeric(20,4),
  quantidade_medida numeric(20,4), medido numeric(20,4),
  quantidade_executada numeric(20,4), executado numeric(20,4),
  comprado_total numeric(20,4), comprado_material numeric(20,4),
  saldo_disponivel_material numeric(20,4), economia_material numeric(20,4),
  composicao_id uuid
) language sql stable set search_path = '' as $$
  with
  base as (
    select
      oi.id, oi.codigo, oi.descricao, oi.unidade,
      oi.quantidade,
      coalesce(nullif(oi.valor_total, 0), oi.quantidade * oi.valor_unitario) as previsto,
      oi.composicao_id
    from public.orcamento_itens oi
    join public.orcamentos o on o.id = oi.orcamento_id
    where o.obra_id = p_obra_id and oi.ativo and oi.tipo = 'item'
  ),
  medicoes as (
    select j.orcamento_item_id,
      sum(tm.quantidade) as quantidade_medida,
      sum(tm.quantidade * c.valor_unitario) as medido,
      sum(tm.quantidade) filter (where t.status = 'concluido') as quantidade_executada,
      sum(tm.quantidade * c.valor_unitario) filter (where t.status = 'concluido') as executado
    from public.catalogo_precos_orcamento_itens j
    join public.catalogo_precos c on c.id = j.catalogo_id
    join public.tarefa_medicoes tm on tm.catalogo_id = c.id
    join public.tarefas t on t.id = tm.tarefa_id
    group by j.orcamento_item_id
  ),
  compras as (
    select ci.orcamento_item_id,
      sum(ci.quantidade * ci.valor_unitario)::numeric(20,4) as comprado_total,
      sum(ci.quantidade * ci.valor_unitario) filter (where ci.categoria = 'material')::numeric(20,4) as comprado_material
    from public.compra_itens ci
    join public.compras c on c.id = ci.compra_id
    where c.obra_id = p_obra_id and ci.orcamento_item_id is not null
    group by ci.orcamento_item_id
  )
  select
    b.id, b.codigo, b.descricao, b.unidade,
    b.quantidade, b.previsto,
    coalesce(m.quantidade_medida, 0), coalesce(m.medido, 0),
    coalesce(m.quantidade_executada, 0), coalesce(m.executado, 0),
    coalesce(c.comprado_total, 0), coalesce(c.comprado_material, 0),
    (b.previsto - coalesce(c.comprado_total, 0) - coalesce(m.executado, 0))::numeric(20,4),
    (b.previsto - greatest(coalesce(c.comprado_total, 0), coalesce(m.executado, 0)))::numeric(20,4),
    b.composicao_id
  from base b
  left join medicoes m on m.orcamento_item_id = b.id
  left join compras c on c.orcamento_item_id = b.id;
$$;

-- ============================================================
-- 5. Atualiza RPC painel_orcamento_hierarquico para usar juncao
-- ============================================================
create or replace function public.painel_orcamento_hierarquico(p_obra_id uuid)
returns table (
  orcamento_item_id uuid, codigo text, descricao text, unidade text,
  tipo text, nivel integer,
  quantidade_prevista numeric(20,4), previsto numeric(20,4),
  quantidade_medida numeric(20,4), medido numeric(20,4),
  quantidade_executada numeric(20,4), executado numeric(20,4),
  comprado_material numeric(20,4), composicao_id uuid
) language sql stable set search_path = '' as $$
  with recursive arvore as (
    select
      oi.id as orcamento_item_id, oi.codigo, oi.descricao, oi.unidade, oi.tipo,
      1 as nivel, oi.quantidade as quantidade_prevista,
      coalesce(nullif(oi.valor_total, 0), oi.quantidade * oi.valor_unitario) as previsto,
      oi.composicao_id
    from public.orcamento_itens oi
    join public.orcamentos o on o.id = oi.orcamento_id
    where o.obra_id = p_obra_id and oi.ativo
      and (
        oi.codigo is null
        or not exists (
          select 1 from public.orcamento_itens pai
          where pai.orcamento_id = oi.orcamento_id
            and pai.ativo and pai.codigo is not null
            and oi.codigo like pai.codigo || '.%'
        )
      )
    union all
    select
      oi.id, oi.codigo, oi.descricao, oi.unidade, oi.tipo,
      a.nivel + 1, oi.quantidade,
      coalesce(nullif(oi.valor_total, 0), oi.quantidade * oi.valor_unitario),
      oi.composicao_id
    from arvore a
    join public.orcamento_itens oi
      on oi.orcamento_id = (select oi2.orcamento_id from public.orcamento_itens oi2 where oi2.id = a.orcamento_item_id)
      and oi.ativo and oi.codigo like a.codigo || '.%' and oi.codigo is not null
  ),
  medicoes as (
    select j.orcamento_item_id,
      sum(tm.quantidade) as quantidade_medida,
      sum(tm.quantidade * c.valor_unitario) as medido,
      sum(tm.quantidade) filter (where t.status = 'concluido') as quantidade_executada,
      sum(tm.quantidade * c.valor_unitario) filter (where t.status = 'concluido') as executado
    from public.catalogo_precos_orcamento_itens j
    join public.catalogo_precos c on c.id = j.catalogo_id
    join public.tarefa_medicoes tm on tm.catalogo_id = c.id
    join public.tarefas t on t.id = tm.tarefa_id
    group by j.orcamento_item_id
  ),
  compras as (
    select ci.orcamento_item_id,
      sum(ci.quantidade * ci.valor_unitario) filter (where ci.categoria = 'material') as comprado_material
    from public.compra_itens ci
    join public.compras c on c.id = ci.compra_id
    where c.obra_id = p_obra_id and ci.orcamento_item_id is not null
    group by ci.orcamento_item_id
  )
  select
    a.orcamento_item_id, a.codigo, a.descricao, a.unidade, a.tipo,
    a.nivel, a.quantidade_prevista, a.previsto,
    coalesce(m.quantidade_medida, 0), coalesce(m.medido, 0),
    coalesce(m.quantidade_executada, 0), coalesce(m.executado, 0),
    coalesce(cp.comprado_material, 0), a.composicao_id
  from arvore a
  left join medicoes m on m.orcamento_item_id = a.orcamento_item_id
  left join compras cp on cp.orcamento_item_id = a.orcamento_item_id
  order by a.nivel, a.codigo;
$$;

-- ============================================================
-- 6. Grants
-- ============================================================
grant execute on function public.painel_financeiro_obra(uuid) to authenticated;
grant execute on function public.painel_compras_orcamento(uuid) to authenticated;
grant execute on function public.painel_orcamento_hierarquico(uuid) to authenticated;