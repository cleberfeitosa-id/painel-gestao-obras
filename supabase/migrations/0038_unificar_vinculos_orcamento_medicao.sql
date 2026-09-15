-- Unifica os vinculos atuais e legados entre catalogo e orcamento.
-- Um catalogo vinculado a varias linhas usa a media dos valores unitarios.

create or replace function public.valor_orcamento_catalogo(p_catalogo_id uuid)
returns numeric(14, 2)
language sql stable set search_path = ''
as $$
  with vinculos as (
    select j.orcamento_item_id as id
    from public.catalogo_precos_orcamento_itens j
    where j.catalogo_id = p_catalogo_id
    union
    select c.orcamento_item_id
    from public.catalogo_precos c
    where c.id = p_catalogo_id and c.orcamento_item_id is not null
  )
  select coalesce(avg(oi.valor_unitario), 0)
  from vinculos v
  join public.orcamento_itens oi on oi.id = v.id
  where oi.ativo and oi.tipo = 'item'
$$;

create or replace function public.resumo_financeiro_medicao(p_medicao_id uuid)
returns table (valor_medido_total numeric(20,4), valor_executado numeric(20,4), valor_pendente numeric(20,4), quantidade_medida numeric(20,4), quantidade_executada numeric(20,4), quantidade_pendente numeric(20,4), valor_pago numeric(20,4))
language sql stable set search_path = '' as $$
  with linhas as (
    select tm.quantidade, tm.quantidade * public.valor_orcamento_catalogo(c.id) as valor, t.status
    from public.tarefa_medicoes tm
    join public.tarefas t on t.id = tm.tarefa_id
    join public.catalogo_precos c on c.id = tm.catalogo_id
    join public.medicoes m on m.id = c.medicao_id
    where c.medicao_id = p_medicao_id and t.obra_id = m.obra_id
  ), pagamentos as (
    select coalesce(sum(mp.valor), 0) as valor from public.medicao_pagamentos mp where mp.medicao_id = p_medicao_id
  )
  select coalesce(sum(l.valor), 0), coalesce(sum(l.valor) filter (where l.status = 'concluido'), 0), coalesce(sum(l.valor) filter (where l.status <> 'concluido'), 0), coalesce(sum(l.quantidade), 0), coalesce(sum(l.quantidade) filter (where l.status = 'concluido'), 0), coalesce(sum(l.quantidade) filter (where l.status <> 'concluido'), 0), (select p.valor from pagamentos p) from linhas l
$$;

create or replace function public.valor_executado_medicao(p_medicao_id uuid) returns numeric(14,2)
language sql stable set search_path = '' as $$
  select coalesce(sum(tm.quantidade * public.valor_orcamento_catalogo(c.id)), 0)
  from public.tarefa_medicoes tm join public.tarefas t on t.id = tm.tarefa_id join public.catalogo_precos c on c.id = tm.catalogo_id join public.medicoes m on m.id = c.medicao_id
  where c.medicao_id = p_medicao_id and t.obra_id = m.obra_id and t.status = 'concluido'
$$;

create or replace function public.valor_pendente_medicao(p_medicao_id uuid) returns numeric(14,2)
language sql stable set search_path = '' as $$
  select coalesce(sum(tm.quantidade * public.valor_orcamento_catalogo(c.id)), 0)
  from public.tarefa_medicoes tm join public.tarefas t on t.id = tm.tarefa_id join public.catalogo_precos c on c.id = tm.catalogo_id join public.medicoes m on m.id = c.medicao_id
  where c.medicao_id = p_medicao_id and t.obra_id = m.obra_id and t.status <> 'concluido'
$$;

create or replace function public.painel_financeiro_obra(p_obra_id uuid)
returns table (orcamento_item_id uuid, codigo text, descricao text, unidade text, quantidade_prevista numeric(20,4), previsto numeric(20,4), quantidade_medida numeric(20,4), medido numeric(20,4), quantidade_executada numeric(20,4), executado numeric(20,4), composicao_id uuid)
language sql stable set search_path = '' as $$
  select oi.id, oi.codigo, oi.descricao, oi.unidade, oi.quantidade, coalesce(nullif(oi.valor_total, 0), oi.quantidade * oi.valor_unitario), coalesce(x.qtd, 0), coalesce(x.medido, 0), coalesce(x.qtd_exec, 0), coalesce(x.exec, 0), oi.composicao_id
  from public.orcamento_itens oi join public.orcamentos o on o.id = oi.orcamento_id
  left join lateral (
    select sum(tm.quantidade / vinc.total) as qtd, sum((tm.quantidade / vinc.total) * oi.valor_unitario) as medido, sum(tm.quantidade / vinc.total) filter (where t.status = 'concluido') as qtd_exec, sum((tm.quantidade / vinc.total) * oi.valor_unitario) filter (where t.status = 'concluido') as exec
    from public.catalogo_precos_orcamento_itens j join public.catalogo_precos c on c.id = j.catalogo_id join public.tarefa_medicoes tm on tm.catalogo_id = c.id join public.tarefas t on t.id = tm.tarefa_id and t.obra_id = p_obra_id
    join (select catalogo_id, count(*)::numeric total from public.catalogo_precos_orcamento_itens j2 join public.orcamento_itens oi2 on oi2.id = j2.orcamento_item_id where oi2.ativo and oi2.tipo = 'item' group by catalogo_id) vinc on vinc.catalogo_id = c.id
    where j.orcamento_item_id = oi.id and c.medicao_id in (select id from public.medicoes where obra_id = p_obra_id)
  ) x on true
  where o.obra_id = p_obra_id and oi.ativo and oi.tipo = 'item'
$$;

grant execute on function public.valor_orcamento_catalogo(uuid) to authenticated;
grant execute on function public.resumo_financeiro_medicao(uuid) to authenticated;
grant execute on function public.valor_executado_medicao(uuid) to authenticated;
grant execute on function public.valor_pendente_medicao(uuid) to authenticated;
grant execute on function public.painel_financeiro_obra(uuid) to authenticated;

create or replace function public.painel_compras_orcamento(p_obra_id uuid)
returns table (orcamento_item_id uuid, codigo text, descricao text, unidade text, quantidade_prevista numeric(20,4), previsto numeric(20,4), quantidade_medida numeric(20,4), medido numeric(20,4), quantidade_executada numeric(20,4), executado numeric(20,4), comprado_total numeric(20,4), comprado_material numeric(20,4), saldo_disponivel_material numeric(20,4), economia_material numeric(20,4), composicao_id uuid)
language sql stable set search_path = '' as $$
  with base as (
    select oi.id, oi.codigo, oi.descricao, oi.unidade, oi.quantidade, oi.valor_unitario, coalesce(nullif(oi.valor_total, 0), oi.quantidade * oi.valor_unitario) as previsto, oi.composicao_id
    from public.orcamento_itens oi join public.orcamentos o on o.id = oi.orcamento_id
    where o.obra_id = p_obra_id and oi.ativo and oi.tipo = 'item'
  ), compras as (
    select ci.orcamento_item_id, sum(ci.quantidade * ci.valor_unitario)::numeric(20,4) as comprado_total, sum(ci.quantidade * ci.valor_unitario) filter (where ci.categoria = 'material')::numeric(20,4) as comprado_material
    from public.compra_itens ci join public.compras c on c.id = ci.compra_id
    where c.obra_id = p_obra_id and ci.orcamento_item_id is not null group by ci.orcamento_item_id
  )
  select b.id, b.codigo, b.descricao, b.unidade, b.quantidade, b.previsto, coalesce(x.qtd, 0), coalesce(x.medido, 0), coalesce(x.qtd_exec, 0), coalesce(x.exec, 0), coalesce(c.comprado_total, 0), coalesce(c.comprado_material, 0), (b.previsto - coalesce(c.comprado_total, 0) - coalesce(x.exec, 0))::numeric(20,4), (b.previsto - greatest(coalesce(c.comprado_total, 0), coalesce(x.exec, 0)))::numeric(20,4), b.composicao_id
  from base b
  left join lateral (
    select sum(tm.quantidade / vinc.total) as qtd, sum((tm.quantidade / vinc.total) * b.valor_unitario) as medido, sum(tm.quantidade / vinc.total) filter (where t.status = 'concluido') as qtd_exec, sum((tm.quantidade / vinc.total) * b.valor_unitario) filter (where t.status = 'concluido') as exec
    from public.catalogo_precos_orcamento_itens j join public.catalogo_precos c2 on c2.id = j.catalogo_id join public.tarefa_medicoes tm on tm.catalogo_id = c2.id join public.tarefas t on t.id = tm.tarefa_id and t.obra_id = p_obra_id
    join (select catalogo_id, count(*)::numeric total from public.catalogo_precos_orcamento_itens j2 join public.orcamento_itens oi2 on oi2.id = j2.orcamento_item_id where oi2.ativo and oi2.tipo = 'item' group by catalogo_id) vinc on vinc.catalogo_id = c2.id
    where j.orcamento_item_id = b.id and c2.medicao_id in (select id from public.medicoes where obra_id = p_obra_id)
  ) x on true
  left join compras c on c.orcamento_item_id = b.id
$$;

grant execute on function public.painel_compras_orcamento(uuid) to authenticated;
