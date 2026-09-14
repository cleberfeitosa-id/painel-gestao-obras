-- Historico detalhado de compras parciais por insumo orcado.
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
  categoria text,
  quantidade_comprada numeric(20,4),
  valor_comprado numeric(20,4),
  compras_anteriores jsonb
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
            when raw.valor like '%,%' then regexp_replace(replace(replace(regexp_replace(raw.valor, 'R\\$|%', '', 'gi'), '.', ''), ',', '.'), '\\s', '', 'g')::numeric
            when raw.valor ~ '^[+-]?[0-9]{1,3}(\\.[0-9]{3})+$' then replace(raw.valor, '.', '')::numeric
            when raw.valor ~ '^[+-]?[0-9]+(\\.[0-9]+)?$' then raw.valor::numeric
            else 0
          end
          from jsonb_array_elements(o.colunas) coluna
          cross join lateral (select oi.dados ->> (coluna ->> 'id') as valor) raw
          where lower(coalesce(coluna ->> 'funcao', '')) = 'quantidade'
            or lower(regexp_replace(coalesce(coluna ->> 'nome', ''), '[^a-zA-Z0-9]+', '_', 'g')) in ('quant', 'qtd', 'qtde', 'quantidade')
          order by case when lower(coalesce(coluna ->> 'funcao', '')) = 'quantidade' then 0 else 1 end
          limit 1
        ),
        0
      )::numeric(20,4) as quantidade_orcamento
    from public.orcamento_itens oi
    join public.orcamentos o on o.id = oi.orcamento_id and o.obra_id = p_obra_id
  ),
  compras_por_insumo as (
    select
      ci.orcamento_item_id,
      ci.composicao_componente_id,
      sum(ci.quantidade)::numeric(20,4) as quantidade_comprada,
      sum(ci.quantidade * ci.valor_unitario)::numeric(20,4) as valor_comprado,
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'dataCompra', c.data_compra,
          'fornecedor', c.fornecedor,
          'documento', c.documento,
          'quantidade', ci.quantidade,
          'valorUnitario', ci.valor_unitario,
          'valorTotal', (ci.quantidade * ci.valor_unitario)::numeric(20,4)
        ) order by c.data_compra desc, c.criado_em desc
      ) as compras_anteriores
    from public.compra_itens ci
    join public.compras c on c.id = ci.compra_id and c.obra_id = p_obra_id
    where ci.orcamento_item_id is not null
      and ci.composicao_componente_id is not null
    group by ci.orcamento_item_id, ci.composicao_componente_id
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
    cc.categoria,
    coalesce(cp.quantidade_comprada, 0),
    coalesce(cp.valor_comprado, 0),
    coalesce(cp.compras_anteriores, '[]'::jsonb)
  from base b
  join public.composicoes c on c.id = b.composicao_id and c.obra_id = p_obra_id
  join public.composicao_componentes cc on cc.composicao_id = c.id
  left join compras_por_insumo cp on cp.orcamento_item_id = b.id and cp.composicao_componente_id = cc.id
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
      or cc.codigo ilike '%' || replace(replace(replace(trim(p_termo), '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!'
      or cc.nome ilike '%' || replace(replace(replace(trim(p_termo), '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!'
    )
  order by b.codigo, c.codigo, cc.nome
  limit 500;
$$;

grant execute on function public.buscar_insumos_compra_hierarquicos(uuid, text) to authenticated;
