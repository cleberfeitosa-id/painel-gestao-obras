-- Busca de compras por codigo do item do orcamento ou da composicao.
-- Retorna todos os componentes para que o usuario escolha apenas os itens
-- efetivamente comprados na tabela da compra.

drop function if exists public.buscar_insumos_compra_hierarquicos(uuid, text);

create function public.buscar_insumos_compra_hierarquicos(
  p_obra_id uuid,
  p_termo text
)
returns table (
  componente_id uuid,
  orcamento_item_id uuid,
  orcamento_codigo text,
  orcamento_descricao text,
  quantidade_composicao numeric(20,4),
  quantidade_prevista numeric(20,4),
  valor_previsto numeric(20,4),
  codigo text,
  nome text,
  unidade text,
  coeficiente numeric(20,4),
  custo_unitario numeric(20,4),
  composicao_id uuid,
  composicao_codigo text,
  composicao_nome text,
  categoria text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cc.id,
    oi.id,
    oi.codigo,
    oi.descricao,
    oi.quantidade,
    (cc.quantidade * oi.quantidade)::numeric(20,4),
    (cc.quantidade * oi.quantidade * cc.custo_unitario)::numeric(20,4),
    coalesce(cc.codigo, oi.codigo, c.codigo),
    cc.nome,
    cc.unidade,
    cc.quantidade,
    cc.custo_unitario,
    c.id,
    c.codigo,
    c.nome,
    cc.categoria
  from public.orcamento_itens oi
  join public.orcamentos o on o.id = oi.orcamento_id and o.obra_id = p_obra_id
  join public.composicoes c on c.id = oi.composicao_id and c.obra_id = p_obra_id
  join public.composicao_componentes cc on cc.composicao_id = c.id
  where oi.ativo
    and oi.tipo = 'item'
    and cc.categoria = 'material'
    and public.e_financeiro()
    and length(trim(p_termo)) between 1 and 100
    and (
      oi.codigo = replace(replace(replace(trim(p_termo), '!', '!!'), '%', '!%'), '_', '!_')
      or oi.codigo like replace(replace(replace(trim(p_termo), '!', '!!'), '%', '!%'), '_', '!_') || '.%' escape '!'
      or c.codigo = replace(replace(replace(trim(p_termo), '!', '!!'), '%', '!%'), '_', '!_')
      or c.codigo like replace(replace(replace(trim(p_termo), '!', '!!'), '%', '!%'), '_', '!_') || '.%' escape '!'
      or oi.descricao ilike '%' || replace(replace(replace(trim(p_termo), '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!'
      or c.nome ilike '%' || replace(replace(replace(trim(p_termo), '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!'
    )
  order by oi.codigo, c.codigo, cc.nome
  limit 500;
$$;

grant execute on function public.buscar_insumos_compra_hierarquicos(uuid, text) to authenticated;
