-- Sprint 25: Compras avancado — vinculo dos itens com componentes de composicao,
-- categorizacao, e funcoes de visao unificada (comprado + medido + previsto).

-- ============================================================
-- 1. Schema (aditivo)
-- ============================================================

-- Vincula cada linha da compra ao componente exato da composicao
-- (permite saber o coeficiente de participacao e a categoria prevista).
alter table public.compra_itens
  add column if not exists composicao_componente_id uuid
  references public.composicao_componentes(id) on delete set null;

-- Categoria denormalizada do componente no momento da compra
-- (material, mao_de_obra, equipamento, outro). Compras = materiais,
-- mas registramos a categoria original para auditoria.
alter table public.compra_itens
  add column if not exists categoria text
  check (categoria in ('mao_de_obra','material','equipamento','outro'));

-- Coeficiente de participacao do componente na composicao (quantidade na composicao).
-- Permite calcular "se a obra tem 100m de composicao, este componente consome X".
alter table public.compra_itens
  add column if not exists coeficiente numeric(20,4);

create index if not exists idx_compra_itens_composicao_componente
  on public.compra_itens(composicao_componente_id);
create index if not exists idx_compra_itens_categoria
  on public.compra_itens(categoria);

-- ============================================================
-- 2. Trigger: auto-preenche categoria ao vincular componente
-- ============================================================

create or replace function public.sync_compra_item_categoria()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.composicao_componente_id is not null then
    select cc.categoria, cc.quantidade into new.categoria, new.coeficiente
    from public.composicao_componentes cc where cc.id = new.composicao_componente_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_compra_item_categoria on public.compra_itens;
create trigger trg_sync_compra_item_categoria
  before insert or update of composicao_componente_id on public.compra_itens
  for each row execute function public.sync_compra_item_categoria();

-- ============================================================
-- 3. RPC: busca componentes de uma composicao para preencher
--    a tabela de linhas de compra
-- ============================================================

create or replace function public.componentes_composicao_para_compra(
  p_composicao_id uuid
)
returns table (
  componente_id uuid,
  codigo text,
  nome text,
  categoria text,
  unidade text,
  quantidade numeric(20,4),
  custo_unitario numeric(20,4),
  custo_total numeric(20,4)
) language sql stable set search_path = '' as $$
  select
    cc.id, cc.codigo, cc.nome, cc.categoria, cc.unidade,
    cc.quantidade, cc.custo_unitario,
    (cc.quantidade * cc.custo_unitario)::numeric(20,4) as custo_total
  from public.composicao_componentes cc
  where cc.composicao_id = p_composicao_id
  order by
    case cc.categoria
      when 'mao_de_obra' then 1
      when 'material' then 2
      when 'equipamento' then 3
      else 4
    end,
    cc.nome;
$$;

grant execute on function public.componentes_composicao_para_compra(uuid) to authenticated;

-- ============================================================
-- 4. RPC: visao unificada por item de orcamento — previsto,
--    comprado (material) e medido (mao de obra da medicao)
-- ============================================================

create or replace function public.painel_compras_orcamento(p_obra_id uuid)
returns table (
  orcamento_item_id uuid,
  codigo text,
  descricao text,
  unidade text,
  quantidade_prevista numeric(20,4),
  previsto numeric(20,4),
  quantidade_medida numeric(20,4),
  medido numeric(20,4),
  quantidade_executada numeric(20,4),
  executado numeric(20,4),
  comprado_total numeric(20,4),
  comprado_material numeric(20,4),
  saldo_disponivel_material numeric(20,4),
  economia_material numeric(20,4),
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
  -- Medicoes (mao de obra via tarefa_medicoes) — igual ao painel_financeiro_obra
  medicoes as (
    select
      c.orcamento_item_id,
      sum(tm.quantidade) as quantidade_medida,
      sum(tm.quantidade * c.valor_unitario) as medido,
      sum(tm.quantidade) filter (where t.status = 'concluido') as quantidade_executada,
      sum(tm.quantidade * c.valor_unitario) filter (where t.status = 'concluido') as executado
    from public.catalogo_precos c
    join public.tarefa_medicoes tm on tm.catalogo_id = c.id
    join public.tarefas t on t.id = tm.tarefa_id
    where c.orcamento_item_id is not null
    group by c.orcamento_item_id
  ),
  -- Compras (materiais) — agregado por item de orcamento
  compras as (
    select
      ci.orcamento_item_id,
      sum(ci.quantidade * ci.valor_unitario)::numeric(20,4) as comprado_total,
      -- compras sao majoritariamente materiais; se houver outra categoria, registramos
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
    -- Saldo disponivel = previsto - comprado (compras = materiais; mao de obra via medicao)
    (b.previsto - coalesce(c.comprado_total, 0) - coalesce(m.executado, 0))::numeric(20,4) as saldo_disponivel_material,
    -- Economia = previsto - max(comprado, executado)
    (b.previsto - greatest(coalesce(c.comprado_total, 0), coalesce(m.executado, 0)))::numeric(20,4) as economia_material,
    b.composicao_id
  from base b
  left join medicoes m on m.orcamento_item_id = b.id
  left join compras c on c.orcamento_item_id = b.id;
$$;

grant execute on function public.painel_compras_orcamento(uuid) to authenticated;

-- ============================================================
-- 5. RPC: busca itens do orcamento com composicao_id para autocomplete
-- ============================================================

create or replace function public.buscar_itens_orcamento_composicao(
  p_obra_id uuid,
  p_termo text
)
returns table (
  id uuid,
  codigo text,
  descricao text,
  unidade text,
  quantidade numeric(20,4),
  valor_unitario numeric(20,4),
  valor_total numeric(20,4),
  composicao_id uuid
) language sql stable set search_path = '' as $$
  select
    oi.id, oi.codigo, oi.descricao, oi.unidade,
    oi.quantidade, oi.valor_unitario,
    coalesce(nullif(oi.valor_total, 0), oi.quantidade * oi.valor_unitario),
    oi.composicao_id
  from public.orcamento_itens oi
  join public.orcamentos o on o.id = oi.orcamento_id
  where o.obra_id = p_obra_id
    and oi.ativo
    and oi.tipo = 'item'
    and oi.composicao_id is not null
    and (oi.codigo ilike '%' || p_termo || '%' or oi.descricao ilike '%' || p_termo || '%')
  order by oi.ordem
  limit 20;
$$;

grant execute on function public.buscar_itens_orcamento_composicao(uuid, text) to authenticated;