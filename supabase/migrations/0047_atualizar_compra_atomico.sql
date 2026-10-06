create or replace function public.atualizar_compra_com_itens(
  p_compra_id uuid,
  p_obra_id uuid,
  p_fornecedor text,
  p_documento text,
  p_data_compra date,
  p_observacao text,
  p_itens jsonb
)
returns void language plpgsql set search_path = '' as $$
begin
  if not public.e_financeiro() then
    raise exception 'sem_permissao_financeira';
  end if;

  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) < 1 or jsonb_array_length(p_itens) > 500 then
    raise exception 'itens_invalidos';
  end if;

  if length(coalesce(p_fornecedor, '')) > 200
    or length(coalesce(p_documento, '')) > 100
    or length(coalesce(p_observacao, '')) > 1000 then
    raise exception 'cabecalho_invalido';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_itens) item
    where jsonb_typeof(item) <> 'object'
      or length(coalesce(item->>'descricao', '')) = 0
      or length(item->>'descricao') > 300
      or length(coalesce(item->>'unidade', '')) = 0
      or length(item->>'unidade') > 20
      or jsonb_typeof(item->'quantidade') <> 'number'
      or jsonb_typeof(item->'valorUnitario') <> 'number'
      or (item->>'quantidade')::numeric <= 0
      or (item->>'quantidade')::numeric > 1000000000
      or (item->>'valorUnitario')::numeric < 0
      or (item->>'valorUnitario')::numeric > 1000000000
      or length(coalesce(item->>'codigoInsumo', '')) > 80
      or (item->>'categoria') is not null
        and item->>'categoria' not in ('mao_de_obra', 'material', 'equipamento', 'outro')
      or ((item->>'coeficiente') is not null and jsonb_typeof(item->'coeficiente') <> 'number')
      or (item->>'coeficiente') is not null
        and ((item->>'coeficiente')::numeric < 0 or (item->>'coeficiente')::numeric > 1000000000)
      or (item->>'orcamentoItemId') is not null
        and (item->>'orcamentoItemId') !~ '^[0-9a-fA-F-]{36}$'
      or (item->>'composicaoId') is not null
        and (item->>'composicaoId') !~ '^[0-9a-fA-F-]{36}$'
      or (item->>'composicaoComponenteId') is not null
        and (item->>'composicaoComponenteId') !~ '^[0-9a-fA-F-]{36}$'
  ) then
    raise exception 'dados_item_invalidos';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_itens) item
    where (item->>'orcamentoItemId') is not null
      and not exists (
        select 1
        from public.orcamento_itens oi
        join public.orcamentos o on o.id = oi.orcamento_id
        where oi.id = (item->>'orcamentoItemId')::uuid and o.obra_id = p_obra_id
      )
  ) or exists (
    select 1
    from jsonb_array_elements(p_itens) item
    where (item->>'composicaoId') is not null
      and not exists (
        select 1 from public.composicoes c
        where c.id = (item->>'composicaoId')::uuid and c.obra_id = p_obra_id
      )
  ) or exists (
    select 1
    from jsonb_array_elements(p_itens) item
    where (item->>'composicaoComponenteId') is not null
      and not exists (
        select 1
        from public.composicao_componentes cc
        join public.composicoes c on c.id = cc.composicao_id
        where cc.id = (item->>'composicaoComponenteId')::uuid
          and c.obra_id = p_obra_id
          and ((item->>'composicaoId') is null or cc.composicao_id = (item->>'composicaoId')::uuid)
      )
  ) then
    raise exception 'referencia_fora_da_obra';
  end if;

  update public.compras
  set fornecedor = p_fornecedor,
      documento = p_documento,
      data_compra = p_data_compra,
      observacao = p_observacao,
      atualizado_em = now()
  where id = p_compra_id and obra_id = p_obra_id;

  if not found then
    raise exception 'compra_nao_encontrada';
  end if;

  delete from public.compra_itens where compra_id = p_compra_id;

  insert into public.compra_itens (
    compra_id, orcamento_item_id, composicao_id, composicao_componente_id,
    codigo_insumo, descricao, unidade, quantidade, valor_unitario, categoria, coeficiente
  )
  select p_compra_id,
    (item->>'orcamentoItemId')::uuid,
    (item->>'composicaoId')::uuid,
    (item->>'composicaoComponenteId')::uuid,
    nullif(item->>'codigoInsumo', ''), item->>'descricao', item->>'unidade',
    (item->>'quantidade')::numeric, (item->>'valorUnitario')::numeric,
    (item->>'categoria'), (item->>'coeficiente')::numeric
  from jsonb_array_elements(p_itens) item;
end;
$$;

grant execute on function public.atualizar_compra_com_itens(uuid, uuid, text, text, date, text, jsonb) to authenticated;
