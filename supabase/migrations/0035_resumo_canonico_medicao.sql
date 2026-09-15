-- Consolida os valores globais de uma medicao em uma unica fonte SQL.

create or replace function public.resumo_financeiro_medicao(p_medicao_id uuid)
returns table (
  valor_medido_total numeric(20, 4),
  valor_executado numeric(20, 4),
  valor_pendente numeric(20, 4),
  quantidade_medida numeric(20, 4),
  quantidade_executada numeric(20, 4),
  quantidade_pendente numeric(20, 4),
  valor_pago numeric(20, 4)
)
language sql stable set search_path = ''
as $$
  with linhas as (
    select tm.quantidade,
      tm.quantidade * public.preco_efetivo_catalogo(c.id) as valor,
      t.status
    from public.tarefa_medicoes tm
    join public.tarefas t on t.id = tm.tarefa_id
    join public.catalogo_precos c on c.id = tm.catalogo_id
    join public.medicoes m on m.id = c.medicao_id
    where c.medicao_id = p_medicao_id and t.obra_id = m.obra_id
  ), pagamentos as (
    select coalesce(sum(mp.valor), 0) as valor
    from public.medicao_pagamentos mp where mp.medicao_id = p_medicao_id
  )
  select coalesce(sum(l.valor), 0),
    coalesce(sum(l.valor) filter (where l.status = 'concluido'), 0),
    coalesce(sum(l.valor) filter (where l.status <> 'concluido'), 0),
    coalesce(sum(l.quantidade), 0),
    coalesce(sum(l.quantidade) filter (where l.status = 'concluido'), 0),
    coalesce(sum(l.quantidade) filter (where l.status <> 'concluido'), 0),
    (select p.valor from pagamentos p)
  from linhas l;
$$;

grant execute on function public.resumo_financeiro_medicao(uuid) to authenticated;
