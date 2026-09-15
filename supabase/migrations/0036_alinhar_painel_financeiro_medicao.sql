-- Mantem o painel de compras alinhado ao preco efetivo da medicao.

create or replace function public.painel_compras_orcamento(p_obra_id uuid)
returns table (
  orcamento_item_id uuid, codigo text, descricao text, unidade text,
  quantidade_prevista numeric(20,4), previsto numeric(20,4),
  quantidade_medida numeric(20,4), medido numeric(20,4),
  quantidade_executada numeric(20,4), executado numeric(20,4),
  comprado_total numeric(20,4), comprado_material numeric(20,4),
  saldo_disponivel_material numeric(20,4), economia_material numeric(20,4),
  composicao_id uuid
)
language sql stable set search_path = ''
as $$
  with base as (
    select oi.id, oi.codigo, oi.descricao, oi.unidade, oi.quantidade,
      coalesce(nullif(oi.valor_total, 0), oi.quantidade * oi.valor_unitario) as previsto,
      oi.composicao_id
    from public.orcamento_itens oi
    join public.orcamentos o on o.id = oi.orcamento_id
    where o.obra_id = p_obra_id and oi.ativo and oi.tipo = 'item'
  ), medicoes as (
    select j.orcamento_item_id,
      sum(tm.quantidade) as quantidade_medida,
      sum(tm.quantidade * public.preco_efetivo_catalogo(c.id)) as medido,
      sum(tm.quantidade) filter (where t.status = 'concluido') as quantidade_executada,
      sum(tm.quantidade * public.preco_efetivo_catalogo(c.id)) filter (where t.status = 'concluido') as executado
    from public.catalogo_precos_orcamento_itens j
    join public.catalogo_precos c on c.id = j.catalogo_id
    join public.medicoes m on m.id = c.medicao_id and m.obra_id = p_obra_id
    join public.tarefa_medicoes tm on tm.catalogo_id = c.id
    join public.tarefas t on t.id = tm.tarefa_id and t.obra_id = p_obra_id
    group by j.orcamento_item_id
  ), compras as (
    select ci.orcamento_item_id,
      sum(ci.quantidade * ci.valor_unitario)::numeric(20,4) as comprado_total,
      sum(ci.quantidade * ci.valor_unitario) filter (where ci.categoria = 'material')::numeric(20,4) as comprado_material
    from public.compra_itens ci join public.compras c on c.id = ci.compra_id
    where c.obra_id = p_obra_id and ci.orcamento_item_id is not null
    group by ci.orcamento_item_id
  )
  select b.id, b.codigo, b.descricao, b.unidade, b.quantidade, b.previsto,
    coalesce(m.quantidade_medida, 0), coalesce(m.medido, 0),
    coalesce(m.quantidade_executada, 0), coalesce(m.executado, 0),
    coalesce(c.comprado_total, 0), coalesce(c.comprado_material, 0),
    (b.previsto - coalesce(c.comprado_total, 0) - coalesce(m.executado, 0))::numeric(20,4),
    (b.previsto - greatest(coalesce(c.comprado_total, 0), coalesce(m.executado, 0)))::numeric(20,4),
    b.composicao_id
  from base b left join medicoes m on m.orcamento_item_id = b.id
    left join compras c on c.orcamento_item_id = b.id;
$$;

grant execute on function public.painel_compras_orcamento(uuid) to authenticated;
