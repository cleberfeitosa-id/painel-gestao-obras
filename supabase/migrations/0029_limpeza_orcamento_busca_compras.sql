-- Limpeza atomica por obra e consulta hierarquica de insumos para compras.

create or replace function public.limpar_dados_importados_obra(p_obra_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orcamento_ids uuid[];
  v_composicao_ids uuid[];
  v_item_ids uuid[];
begin
  if not public.e_financeiro() then
    raise exception 'Sem permissao para limpar dados importados';
  end if;

  if not exists (select 1 from public.obras where id = p_obra_id) then
    raise exception 'Obra nao encontrada';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_orcamento_ids
  from public.orcamentos where obra_id = p_obra_id;
  select coalesce(array_agg(id), '{}'::uuid[]) into v_composicao_ids
  from public.composicoes where obra_id = p_obra_id;
  select coalesce(array_agg(id), '{}'::uuid[]) into v_item_ids
  from public.orcamento_itens where orcamento_id = any(v_orcamento_ids);

  -- Compras e catalogos sao historico operacional: apenas removemos os
  -- vinculos com itens que deixarao de existir.
  if cardinality(v_item_ids) > 0 then
    delete from public.catalogo_precos_orcamento_itens
    where orcamento_item_id = any(v_item_ids);
    update public.catalogo_precos set orcamento_item_id = null
    where orcamento_item_id = any(v_item_ids);
  end if;

  if cardinality(v_orcamento_ids) > 0 then
    delete from public.orcamento_itens where orcamento_id = any(v_orcamento_ids);
    delete from public.orcamento_versoes where orcamento_id = any(v_orcamento_ids);
    delete from public.orcamento_auditoria where orcamento_id = any(v_orcamento_ids);
    delete from public.orcamentos where id = any(v_orcamento_ids);
  end if;

  if cardinality(v_composicao_ids) > 0 then
    update public.composicao_componentes cc
    set composicao_referencia_id = null
    where cc.composicao_referencia_id = any(v_composicao_ids)
      and not (cc.composicao_id = any(v_composicao_ids));
    delete from public.composicao_componentes
    where composicao_id = any(v_composicao_ids);
    delete from public.composicoes where id = any(v_composicao_ids);
  end if;
end;
$$;

grant execute on function public.limpar_dados_importados_obra(uuid) to authenticated;

create or replace function public.buscar_insumos_compra_hierarquicos(
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
  composicao_nome text
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
    cc.codigo,
    cc.nome,
    cc.unidade,
    cc.quantidade,
    cc.custo_unitario,
    c.id,
    c.codigo,
    c.nome
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
      or oi.descricao ilike '%' || replace(replace(replace(trim(p_termo), '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!'
    )
  order by oi.codigo, c.codigo, cc.nome
  limit 500;
$$;

grant execute on function public.buscar_insumos_compra_hierarquicos(uuid, text) to authenticated;
