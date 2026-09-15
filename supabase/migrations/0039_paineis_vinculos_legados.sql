-- Faz os paineis financeiros usarem os mesmos vinculos canonicos do detalhe.

create or replace function public.painel_financeiro_obra(p_obra_id uuid)
returns table (orcamento_item_id uuid, codigo text, descricao text, unidade text, quantidade_prevista numeric(20,4), previsto numeric(20,4), quantidade_medida numeric(20,4), medido numeric(20,4), quantidade_executada numeric(20,4), executado numeric(20,4), composicao_id uuid)
language sql stable set search_path = '' as $$
  with vinculos as (
    select j.catalogo_id, j.orcamento_item_id
    from public.catalogo_precos_orcamento_itens j
    union
    select c.id, c.orcamento_item_id
    from public.catalogo_precos c
    where c.orcamento_item_id is not null
  ), validos as (
    select v.catalogo_id, v.orcamento_item_id
    from vinculos v
    join public.catalogo_precos cp on cp.id = v.catalogo_id
    join public.medicoes md on md.id = cp.medicao_id and md.obra_id = p_obra_id
    join public.orcamento_itens oi on oi.id = v.orcamento_item_id
    where oi.ativo and oi.tipo = 'item'
  ), contagem as (
    select catalogo_id, count(*)::numeric as total
    from validos group by catalogo_id
  )
  select oi.id, oi.codigo, oi.descricao, oi.unidade, oi.quantidade,
    coalesce(nullif(oi.valor_total, 0), oi.quantidade * oi.valor_unitario),
    coalesce(x.qtd, 0), coalesce(x.medido, 0), coalesce(x.qtd_exec, 0), coalesce(x.exec, 0), oi.composicao_id
  from public.orcamento_itens oi join public.orcamentos o on o.id = oi.orcamento_id
  left join lateral (
    select sum(tm.quantidade / ct.total) as qtd,
      sum((tm.quantidade / ct.total) * oi.valor_unitario) as medido,
      sum(tm.quantidade / ct.total) filter (where t.status = 'concluido') as qtd_exec,
      sum((tm.quantidade / ct.total) * oi.valor_unitario) filter (where t.status = 'concluido') as exec
    from validos v
    join contagem ct on ct.catalogo_id = v.catalogo_id
    join public.catalogo_precos c on c.id = v.catalogo_id
    join public.tarefa_medicoes tm on tm.catalogo_id = c.id
    join public.tarefas t on t.id = tm.tarefa_id and t.obra_id = p_obra_id
    where v.orcamento_item_id = oi.id and c.medicao_id in (select id from public.medicoes where obra_id = p_obra_id)
  ) x on true
  where o.obra_id = p_obra_id and oi.ativo and oi.tipo = 'item'
$$;

create or replace function public.painel_compras_orcamento(p_obra_id uuid)
returns table (orcamento_item_id uuid, codigo text, descricao text, unidade text, quantidade_prevista numeric(20,4), previsto numeric(20,4), quantidade_medida numeric(20,4), medido numeric(20,4), quantidade_executada numeric(20,4), executado numeric(20,4), comprado_total numeric(20,4), comprado_material numeric(20,4), saldo_disponivel_material numeric(20,4), economia_material numeric(20,4), composicao_id uuid)
language sql stable set search_path = '' as $$
  with vinculos as (
    select j.catalogo_id, j.orcamento_item_id
    from public.catalogo_precos_orcamento_itens j
    union
    select c.id, c.orcamento_item_id
    from public.catalogo_precos c
    where c.orcamento_item_id is not null
  ), validos as (
    select v.catalogo_id, v.orcamento_item_id
    from vinculos v
    join public.catalogo_precos cp on cp.id = v.catalogo_id
    join public.medicoes md on md.id = cp.medicao_id and md.obra_id = p_obra_id
    join public.orcamento_itens oi on oi.id = v.orcamento_item_id
    where oi.ativo and oi.tipo = 'item'
  ), contagem as (
    select catalogo_id, count(*)::numeric as total
    from validos group by catalogo_id
  ), base as (
    select oi.id, oi.codigo, oi.descricao, oi.unidade, oi.quantidade, oi.valor_unitario,
      coalesce(nullif(oi.valor_total, 0), oi.quantidade * oi.valor_unitario) as previsto,
      oi.composicao_id
    from public.orcamento_itens oi join public.orcamentos o on o.id = oi.orcamento_id
    where o.obra_id = p_obra_id and oi.ativo and oi.tipo = 'item'
  ), compras as (
    select ci.orcamento_item_id,
      sum(ci.quantidade * ci.valor_unitario)::numeric(20,4) as comprado_total,
      sum(ci.quantidade * ci.valor_unitario) filter (where ci.categoria = 'material')::numeric(20,4) as comprado_material
    from public.compra_itens ci join public.compras c on c.id = ci.compra_id
    where c.obra_id = p_obra_id and ci.orcamento_item_id is not null group by ci.orcamento_item_id
  )
  select b.id, b.codigo, b.descricao, b.unidade, b.quantidade, b.previsto,
    coalesce(x.qtd, 0), coalesce(x.medido, 0), coalesce(x.qtd_exec, 0), coalesce(x.exec, 0),
    coalesce(c.comprado_total, 0), coalesce(c.comprado_material, 0),
    (b.previsto - coalesce(c.comprado_total, 0) - coalesce(x.exec, 0))::numeric(20,4),
    (b.previsto - greatest(coalesce(c.comprado_total, 0), coalesce(x.exec, 0)))::numeric(20,4), b.composicao_id
  from base b
  left join lateral (
    select sum(tm.quantidade / ct.total) as qtd,
      sum((tm.quantidade / ct.total) * b.valor_unitario) as medido,
      sum(tm.quantidade / ct.total) filter (where t.status = 'concluido') as qtd_exec,
      sum((tm.quantidade / ct.total) * b.valor_unitario) filter (where t.status = 'concluido') as exec
    from validos v
    join contagem ct on ct.catalogo_id = v.catalogo_id
    join public.catalogo_precos cp on cp.id = v.catalogo_id
    join public.tarefa_medicoes tm on tm.catalogo_id = cp.id
    join public.tarefas t on t.id = tm.tarefa_id and t.obra_id = p_obra_id
    where v.orcamento_item_id = b.id and cp.medicao_id in (select id from public.medicoes where obra_id = p_obra_id)
  ) x on true
  left join compras c on c.orcamento_item_id = b.id
$$;

grant execute on function public.painel_financeiro_obra(uuid) to authenticated;
grant execute on function public.painel_compras_orcamento(uuid) to authenticated;
