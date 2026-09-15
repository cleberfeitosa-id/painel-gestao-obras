-- Carga controlada, idempotente e transacional do orçamento HUV Crato.
-- A operação é deliberadamente exposta somente ao papel service_role.

alter table public.orcamentos
  add column if not exists chave_importacao text;
alter table public.orcamentos
  add column if not exists hash_importacao text;

create unique index if not exists idx_orcamentos_obra_chave_importacao
  on public.orcamentos (obra_id, chave_importacao)
  where chave_importacao is not null;

drop function if exists public.importar_huv_crato(uuid, text, text, jsonb, jsonb, jsonb);

create or replace function public.importar_huv_crato(
  p_obra_id uuid,
  p_chave_importacao text,
  p_hash_pacote text,
  p_composicoes jsonb,
  p_referencias jsonb,
  p_orcamento jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra_nome text;
  v_obras_encontradas integer;
  v_orcamento_id uuid;
  v_medicao_id uuid;
  v_composicao_id uuid;
  v_referencia record;
  v_composicao jsonb;
  v_componente jsonb;
  v_linha jsonb;
  v_codigo text;
  v_chave text;
  v_total_composicoes integer;
  v_total_linhas integer;
  v_total_componentes integer := 0;
  v_componentes integer := 0;
  v_referencias_resolvidas integer := 0;
  v_referencias_atualizadas integer;
  v_itens_vinculados integer := 0;
  v_orcamento_existente uuid;
  v_hash_existente text;
  v_composicoes_existentes integer;
begin
  if p_chave_importacao is null or length(trim(p_chave_importacao)) < 8 then
    raise exception 'Chave de importacao invalida';
  end if;
  if p_hash_pacote is null or p_hash_pacote !~ '^[0-9a-f]{64}$' then
    raise exception 'Hash do pacote invalido';
  end if;
  if jsonb_typeof(p_composicoes) <> 'array'
     or jsonb_typeof(p_referencias) <> 'array'
     or jsonb_typeof(p_orcamento->'linhas') <> 'array'
     or jsonb_typeof(p_orcamento->'colunas') <> 'array' then
    raise exception 'Pacote de importacao invalido';
  end if;

  select count(*) into v_obras_encontradas from public.obras where nome = 'HUV Crato';
  if v_obras_encontradas <> 1 then
    raise exception 'Esperada exatamente uma obra HUV Crato; encontradas %', v_obras_encontradas;
  end if;
  select nome into v_obra_nome from public.obras where id = p_obra_id for update;
  if v_obra_nome is null then raise exception 'Obra nao encontrada'; end if;
  if v_obra_nome <> 'HUV Crato' then
    raise exception 'A carga HUV Crato exige a obra HUV Crato';
  end if;

  v_total_composicoes := jsonb_array_length(p_composicoes);
  v_total_linhas := jsonb_array_length(p_orcamento->'linhas');
  if v_total_composicoes <> 694 then
    raise exception 'Quantidade de composicoes invalida: esperado 694, recebido %', v_total_composicoes;
  end if;
  if v_total_linhas <> 975 then
    raise exception 'Quantidade de linhas invalida: esperado 975, recebido %', v_total_linhas;
  end if;
  select coalesce(sum(jsonb_array_length(value->'componentes')), 0)
    into v_total_componentes
    from jsonb_array_elements(p_composicoes);
  if v_total_componentes <> 3403 then
    raise exception 'Quantidade de componentes invalida: esperado 3403, recebido %', v_total_componentes;
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_composicoes) a
    where jsonb_array_length(coalesce(a->'componentes', '[]'::jsonb)) > 500
  ) then
    raise exception 'Composicao excede 500 componentes';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_orcamento->'linhas') a
    where nullif(a->>'__item_id', '') is null
    group by a->>'__item_id'
    having count(*) <> 1
  ) then
    raise exception 'Linhas do orcamento possuem chaves estaveis ausentes ou duplicadas';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_composicoes) a
    group by a->>'codigo' having count(*) <> 1 or nullif(a->>'codigo', '') is null
  ) then
    raise exception 'Composicoes possuem codigos ausentes ou duplicados';
  end if;

  for v_referencia in
    select value->>'pai' as pai, value->>'filha' as filha,
      (value->>'quantidade')::numeric as quantidade
    from jsonb_array_elements(p_referencias)
    where exists (
      select 1 from jsonb_array_elements(p_composicoes) c
      where c->>'codigo' = value->>'filha'
    )
  loop
    if not exists (
      select 1 from jsonb_array_elements(p_composicoes) c
      where c->>'codigo' = v_referencia.pai
    ) then
      raise exception 'Referencia interna sem composicao pai: % -> %', v_referencia.pai, v_referencia.filha;
    end if;
    select count(*) into v_referencias_atualizadas
    from jsonb_array_elements(coalesce((
      select c->'componentes' from jsonb_array_elements(p_composicoes) c
      where c->>'codigo' = v_referencia.pai limit 1
    ), '[]'::jsonb)) componente
    where componente->>'codigo' = reverse(split_part(reverse(v_referencia.filha), ':', 1))
      and (componente->>'quantidade')::numeric = v_referencia.quantidade;
    if v_referencias_atualizadas <> 1 then
      raise exception 'Referencia interna ambigua ou ausente: % -> %', v_referencia.pai, v_referencia.filha;
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtextextended('importar_huv_crato:' || p_obra_id::text, 0));

  select id, hash_importacao into v_orcamento_existente, v_hash_existente
  from public.orcamentos
  where obra_id = p_obra_id and chave_importacao = p_chave_importacao;
  if v_orcamento_existente is not null then
    if v_hash_existente is distinct from p_hash_pacote then
      raise exception 'Chave de importacao ja usada por outro pacote';
    end if;
    return jsonb_build_object(
      'obra_id', p_obra_id,
      'orcamento_id', v_orcamento_existente,
      'composicoes', v_total_composicoes,
      'componentes', v_total_componentes,
      'referencias_resolvidas', 94,
      'linhas_orcamento', v_total_linhas,
      'idempotente', true
    );
  end if;

  select count(*) into v_composicoes_existentes
  from public.composicoes
  where obra_id = p_obra_id;
  if v_composicoes_existentes > 0 then
    raise exception 'A obra ja possui composicoes; carga inicial HUV Crato recusada para evitar sobrescrita';
  end if;

  for v_composicao in select value from jsonb_array_elements(p_composicoes) loop
    v_codigo := nullif(trim(v_composicao->>'codigo'), '');
    if v_codigo is null or nullif(trim(v_composicao->>'nome'), '') is null
       or nullif(trim(v_composicao->>'unidade'), '') is null then
      raise exception 'Composicao com campos obrigatorios ausentes';
    end if;
    insert into public.composicoes (obra_id, codigo, nome, unidade, custo_unitario)
    values (
      p_obra_id, v_codigo, v_composicao->>'nome', v_composicao->>'unidade',
      coalesce((v_composicao->>'custoUnitarioCalculado')::numeric, 0)
    );
    select id into v_composicao_id from public.composicoes
      where obra_id = p_obra_id and codigo = v_codigo;
    delete from public.composicao_componentes where composicao_id = v_composicao_id;
    for v_componente in select value from jsonb_array_elements(coalesce(v_composicao->'componentes', '[]'::jsonb)) loop
      insert into public.composicao_componentes (
        composicao_id, codigo, nome, categoria, unidade, quantidade, custo_unitario
      ) values (
        v_composicao_id,
        nullif(v_componente->>'codigo', ''),
        v_componente->>'nome',
        coalesce(nullif(v_componente->>'categoria', ''), 'outro'),
        v_componente->>'unidade',
        (v_componente->>'quantidade')::numeric,
        (v_componente->>'custoUnitario')::numeric
      );
      v_componentes := v_componentes + 1;
    end loop;
  end loop;

  -- Referências sem composição filha continuam como componentes precificados.
  -- Somente referências cujo código existe neste snapshot recebem FK.
  for v_referencia in
    select value->>'pai' as pai, value->>'filha' as filha, (value->>'quantidade')::numeric as quantidade
    from jsonb_array_elements(p_referencias)
  loop
    update public.composicao_componentes cc
       set composicao_referencia_id = filha.id
      from public.composicoes pai_comp
      join public.composicoes filha on filha.obra_id = p_obra_id
       and filha.codigo = v_referencia.filha
     where pai_comp.obra_id = p_obra_id
       and pai_comp.codigo = v_referencia.pai
       and cc.composicao_id = pai_comp.id
       and cc.codigo = reverse(split_part(reverse(v_referencia.filha), ':', 1))
       and cc.quantidade = v_referencia.quantidade;
    get diagnostics v_referencias_atualizadas = row_count;
    if exists (select 1 from public.composicoes where obra_id = p_obra_id and codigo = v_referencia.filha)
       and v_referencias_atualizadas <> 1 then
      raise exception 'Referencia interna ambigua ou ausente: % -> %', v_referencia.pai, v_referencia.filha;
    end if;
    v_referencias_resolvidas := v_referencias_resolvidas + v_referencias_atualizadas;
  end loop;
  if v_referencias_resolvidas <> 94 then
    raise exception 'Referencias internas resolvidas invalidas: esperado 94, recebido %', v_referencias_resolvidas;
  end if;

  insert into public.orcamentos (obra_id, chave_importacao, hash_importacao, nome, colunas, linhas)
  values (
    p_obra_id, p_chave_importacao, p_hash_pacote, coalesce(p_orcamento->>'nome', 'Orçamento HUV Crato - PO'),
    p_orcamento->'colunas', p_orcamento->'linhas'
  );
  select id into v_orcamento_id from public.orcamentos
    where obra_id = p_obra_id and chave_importacao = p_chave_importacao;

  -- A projeção existente cria/atualiza os 975 itens e resolve composição por código.
  perform public.reconstruir_itens_orcamento(v_orcamento_id, p_orcamento->'colunas', p_orcamento->'linhas');
  update public.orcamento_itens oi
     set composicao_id = c.id, composicao_versao = c.atualizado_em
    from public.composicoes c
   where oi.orcamento_id = v_orcamento_id
     and oi.codigo = c.codigo
     and c.obra_id = p_obra_id
     and oi.tipo = 'item';
  get diagnostics v_itens_vinculados = row_count;
  if v_itens_vinculados <> 861 then
    raise exception 'Itens vinculados invalidos: esperado 861, recebido %', v_itens_vinculados;
  end if;
  update public.orcamentos set versao = greatest(versao, 1) where id = v_orcamento_id;
  insert into public.orcamento_auditoria (orcamento_id, entidade, entidade_id, operacao, antes, depois)
  values (v_orcamento_id, 'orcamento', v_orcamento_id, 'import', null,
    jsonb_build_object('chave_importacao', p_chave_importacao, 'hash_pacote', p_hash_pacote, 'composicoes', v_total_composicoes, 'linhas', v_total_linhas));

  return jsonb_build_object(
    'obra_id', p_obra_id,
    'orcamento_id', v_orcamento_id,
    'composicoes', v_total_composicoes,
    'componentes', v_componentes,
    'referencias_resolvidas', v_referencias_resolvidas,
    'linhas_orcamento', v_total_linhas,
    'itens_vinculados', v_itens_vinculados
  );
end;
$$;

revoke all on function public.importar_huv_crato(uuid, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.importar_huv_crato(uuid, text, text, jsonb, jsonb, jsonb) to service_role;
