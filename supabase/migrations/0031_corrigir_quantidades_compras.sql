-- Recupera a quantidade original do orcamento quando a projecao antiga foi
-- gravada com zero por causa de um cabecalho como "QUANT.".

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
  with base as (
    select
      oi.*,
      coalesce(
        nullif(oi.quantidade, 0),
        (
          select case
            when raw.valor like '%,%' then
              regexp_replace(
                replace(replace(regexp_replace(raw.valor, 'R\$|%', '', 'gi'), '.', ''), ',', '.'),
                '\s', '', 'g'
              )::numeric
            when raw.valor ~ '^[+-]?[0-9]{1,3}(\.[0-9]{3})+$' then
              replace(raw.valor, '.', '')::numeric
            when raw.valor ~ '^[+-]?[0-9]+(\.[0-9]+)?$' then
              raw.valor::numeric
            else 0
          end
          from jsonb_array_elements(o.colunas) coluna
          cross join lateral (
            select oi.dados ->> (coluna ->> 'id') as valor
          ) raw
          where lower(coalesce(coluna ->> 'funcao', '')) = 'quantidade'
            or (
              lower(regexp_replace(coalesce(coluna ->> 'nome', ''), '[^a-zA-Z0-9]+', '_', 'g'))
                in ('quant', 'qtd', 'qtde', 'quantidade')
            )
          order by case when lower(coalesce(coluna ->> 'funcao', '')) = 'quantidade' then 0 else 1 end
          limit 1
        ),
        0
      )::numeric(20,4) as quantidade_orcamento
    from public.orcamento_itens oi
    join public.orcamentos o on o.id = oi.orcamento_id and o.obra_id = p_obra_id
  )
  select
    cc.id,
    b.id,
    b.codigo,
    b.descricao,
    b.quantidade_orcamento,
    (cc.quantidade * b.quantidade_orcamento)::numeric(20,4),
    (cc.quantidade * b.quantidade_orcamento * cc.custo_unitario)::numeric(20,4),
    coalesce(cc.codigo, b.codigo, c.codigo),
    cc.nome,
    cc.unidade,
    cc.quantidade,
    cc.custo_unitario,
    c.id,
    c.codigo,
    c.nome,
    cc.categoria
  from base b
  join public.composicoes c on c.id = b.composicao_id and c.obra_id = p_obra_id
  join public.composicao_componentes cc on cc.composicao_id = c.id
  where b.ativo
    and b.tipo = 'item'
    and cc.categoria = 'material'
    and public.e_financeiro()
    and length(trim(p_termo)) between 1 and 100
    and (
      b.codigo = replace(replace(replace(trim(p_termo), '!', '!!'), '%', '!%'), '_', '!_')
      or b.codigo like replace(replace(replace(trim(p_termo), '!', '!!'), '%', '!%'), '_', '!_') || '.%' escape '!'
      or c.codigo = replace(replace(replace(trim(p_termo), '!', '!!'), '%', '!%'), '_', '!_')
      or c.codigo like replace(replace(replace(trim(p_termo), '!', '!!'), '%', '!%'), '_', '!_') || '.%' escape '!'
      or b.descricao ilike '%' || replace(replace(replace(trim(p_termo), '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!'
      or c.nome ilike '%' || replace(replace(replace(trim(p_termo), '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!'
    )
  order by b.codigo, c.codigo, cc.nome
  limit 500;
$$;

grant execute on function public.buscar_insumos_compra_hierarquicos(uuid, text) to authenticated;
