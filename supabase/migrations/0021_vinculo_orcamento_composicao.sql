-- Sprint 21: vinculo orcamento <-> composicao, custo recursivo e painel previsto x medido.

-- ============================================================
-- 1. Schema (aditivo; nada le ainda -> zero risco)
-- ============================================================
alter table public.orcamento_itens add column if not exists composicao_id uuid;
alter table public.orcamento_itens add column if not exists composicao_versao timestamptz;

alter table public.orcamento_itens drop constraint if exists orcamento_itens_composicao_id_fkey;
alter table public.orcamento_itens add constraint orcamento_itens_composicao_id_fkey
  foreign key (composicao_id) references public.composicoes(id) on delete set null;

create index if not exists idx_orcamento_itens_composicao on public.orcamento_itens(composicao_id);

-- ============================================================
-- 2. RLS: unifica composicoes com o modulo financeiro
--    (o guard TS de salvarComposicao/importarComposicoes ja exige
--    pode_editar_financeiro; a politica e_gestor() era mais frouxa)
-- ============================================================
drop policy if exists composicoes_gestor_escreve on public.composicoes;
drop policy if exists composicoes_financeiro_escreve on public.composicoes;
create policy composicoes_financeiro_escreve on public.composicoes
  for all to authenticated using (public.e_financeiro()) with check (public.e_financeiro());
drop policy if exists composicao_componentes_gestor_escreve on public.composicao_componentes;
drop policy if exists composicao_componentes_financeiro_escreve on public.composicao_componentes;
create policy composicao_componentes_financeiro_escreve on public.composicao_componentes
  for all to authenticated using (public.e_financeiro()) with check (public.e_financeiro());

-- ============================================================
-- 3. Leitura: custo recursivo e painel financeiro
-- ============================================================
create or replace function public.custo_composicoes(p_obra_id uuid, p_composicao_id uuid default null)
returns table (composicao_id uuid, categoria text, total numeric(20,4))
language sql stable set search_path = '' as $$
  with recursive arvore(raiz, referencia, fator, categoria, custo_unitario, profundidade) as (
    -- NAO remover o ::numeric: o CTE recursivo exige typmod identico nos dois termos
    -- e o termo recursivo gera numeric irrestrito. Fixar (20,4) arredondaria o fator
    -- a cada nivel e zeraria coeficientes pequenos em composicoes aninhadas.
    select c.id, cc.composicao_referencia_id, cc.quantidade::numeric, cc.categoria, cc.custo_unitario, 1
    from public.composicoes c
    join public.composicao_componentes cc on cc.composicao_id = c.id
    where c.obra_id = p_obra_id
      and (p_composicao_id is null or c.id = p_composicao_id)
    union all
    select a.raiz, cc.composicao_referencia_id, a.fator * cc.quantidade, cc.categoria, cc.custo_unitario, a.profundidade + 1
    from arvore a
    join public.composicao_componentes cc on cc.composicao_id = a.referencia
    where a.referencia is not null and a.profundidade < 50
  )
  select raiz, categoria, sum(fator * custo_unitario)::numeric(20,4)
  from arvore
  where referencia is null
  group by raiz, categoria
$$;

create or replace function public.resolver_composicao_por_codigo(p_obra_id uuid, p_codigo text)
returns uuid language sql stable set search_path = '' as $$
  -- Retorna NULL quando ha 0 ou mais de 1 correspondencia (codigo ambiguo).
  -- min(uuid) nao existe no Postgres, entao agregamos via array_agg.
  select case when count(*) = 1 then (array_agg(id))[1] end
  from public.composicoes
  where obra_id = p_obra_id and codigo = p_codigo
$$;

create or replace function public.painel_financeiro_obra(p_obra_id uuid)
returns table (
  orcamento_item_id uuid, codigo text, descricao text, unidade text,
  quantidade_prevista numeric(20,4), previsto numeric(20,4),
  quantidade_medida numeric(20,4), medido numeric(20,4),
  quantidade_executada numeric(20,4), executado numeric(20,4),
  composicao_id uuid
) language sql stable set search_path = '' as $$
  select
    oi.id, oi.codigo, oi.descricao, oi.unidade,
    oi.quantidade,
    coalesce(nullif(oi.valor_total, 0), oi.quantidade * oi.valor_unitario),
    coalesce(med.quantidade_medida, 0), coalesce(med.medido, 0),
    coalesce(med.quantidade_executada, 0), coalesce(med.executado, 0),
    oi.composicao_id
  from public.orcamento_itens oi
  join public.orcamentos o on o.id = oi.orcamento_id
  left join (
    select c.orcamento_item_id,
      sum(tm.quantidade) as quantidade_medida,
      sum(tm.quantidade * c.valor_unitario) as medido,
      sum(tm.quantidade) filter (where t.status = 'concluido') as quantidade_executada,
      sum(tm.quantidade * c.valor_unitario) filter (where t.status = 'concluido') as executado
    from public.catalogo_precos c
    join public.tarefa_medicoes tm on tm.catalogo_id = c.id
    join public.tarefas t on t.id = tm.tarefa_id
    where c.orcamento_item_id is not null
    group by c.orcamento_item_id
  ) med on med.orcamento_item_id = oi.id
  where o.obra_id = p_obra_id and oi.ativo and oi.tipo = 'item'
$$;

-- ============================================================
-- 4. Escrita: versionamento compartilhado + acoes de vinculo
-- ============================================================
create or replace function public.registrar_versao_orcamento(p_orcamento_id uuid, p_autor uuid default null)
returns integer language plpgsql security invoker set search_path = '' as $$
declare atual integer; nova integer;
begin
  select versao into atual from public.orcamentos where id = p_orcamento_id for update;
  if atual is null then raise exception 'Orcamento nao encontrado'; end if;
  nova := atual + 1;
  insert into public.orcamento_versoes(orcamento_id, versao, colunas, linhas, criado_por)
    select id, nova, colunas, linhas, coalesce(p_autor, (select auth.uid())) from public.orcamentos where id = p_orcamento_id;
  update public.orcamentos set versao = nova where id = p_orcamento_id;
  insert into public.orcamento_auditoria(orcamento_id, entidade, entidade_id, operacao, antes, depois, autor_id)
    values (p_orcamento_id, 'orcamento', p_orcamento_id, 'update',
      jsonb_build_object('versao', atual), jsonb_build_object('versao', nova), coalesce(p_autor, (select auth.uid())));
  return nova;
end $$;

create or replace function public.vincular_composicao_item(
  p_orcamento_id uuid, p_chave_estavel text, p_composicao_id uuid, p_autor uuid default null
) returns integer language plpgsql security invoker set search_path = '' as $$
declare v_colunas jsonb; v_linhas jsonb; v_versao integer; v_comp_versao timestamptz;
begin
  select colunas, linhas into v_colunas, v_linhas from public.orcamentos where id = p_orcamento_id for update;
  if v_linhas is null then raise exception 'Orcamento nao encontrado'; end if;
  select atualizado_em into v_comp_versao from public.composicoes
    where id = p_composicao_id and obra_id = (select obra_id from public.orcamentos where id = p_orcamento_id);
  if v_comp_versao is null then raise exception 'Composicao nao encontrada na obra'; end if;
  v_linhas := (
    select coalesce(jsonb_agg(
      case
        when coalesce(l.value->>'__item_id', '') = p_chave_estavel or ('linha-' || l.ordinality::text) = p_chave_estavel
          then l.value || jsonb_build_object('__composicao_id', p_composicao_id, '__composicao_versao', v_comp_versao)
        else l.value
      end order by l.ordinality
    ), '[]'::jsonb)
    from jsonb_array_elements(v_linhas) with ordinality as l(value, ordinality)
  );
  update public.orcamentos set linhas = v_linhas where id = p_orcamento_id;
  v_versao := public.registrar_versao_orcamento(p_orcamento_id, p_autor);
  perform public.reconstruir_itens_orcamento(p_orcamento_id, v_colunas, v_linhas);
  return v_versao;
end $$;

create or replace function public.aplicar_custo_composicao(
  p_orcamento_id uuid, p_chave_estavel text, p_autor uuid default null
) returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_colunas jsonb; v_linhas jsonb; v_versao integer; v_obra_id uuid;
  v_composicao_id uuid; v_custo numeric(20,4); v_linha jsonb; v_nova_linha jsonb;
  v_col_unit text; v_col_total text; v_col_bdi text; v_col_qtd text;
  v_quantidade numeric(20,4); v_bdi numeric(20,4); v_comp_versao timestamptz;
begin
  select o.colunas, o.linhas, o.obra_id into v_colunas, v_linhas, v_obra_id
    from public.orcamentos o where o.id = p_orcamento_id for update;
  if v_linhas is null then raise exception 'Orcamento nao encontrado'; end if;

  select l.value into v_linha from jsonb_array_elements(v_linhas) with ordinality as l(value, ordinality)
    where coalesce(l.value->>'__item_id','') = p_chave_estavel or ('linha-'||l.ordinality::text) = p_chave_estavel
    limit 1;
  if v_linha is null then raise exception 'Linha nao encontrada'; end if;

  v_composicao_id := coalesce(
    nullif(v_linha->>'__composicao_id','')::uuid,
    public.resolver_composicao_por_codigo(v_obra_id, v_linha->>(select value->>'id' from jsonb_array_elements(v_colunas) where value->>'funcao' = 'codigo' limit 1)));
  if v_composicao_id is null then raise exception 'Item sem composicao vinculada'; end if;

  select sum(total) into v_custo from public.custo_composicoes(v_obra_id, v_composicao_id);
  if v_custo is null then raise exception 'Composicao sem custo calculado'; end if;

  v_col_unit := (select value->>'id' from jsonb_array_elements(v_colunas) where value->>'funcao' = 'valor_unitario' limit 1);
  v_col_total := (select value->>'id' from jsonb_array_elements(v_colunas) where value->>'funcao' = 'valor_total' limit 1);
  v_col_bdi   := (select value->>'id' from jsonb_array_elements(v_colunas) where value->>'funcao' = 'bdi' limit 1);
  v_col_qtd   := (select value->>'id' from jsonb_array_elements(v_colunas) where value->>'funcao' = 'quantidade' limit 1);
  if v_col_unit is null then raise exception 'Coluna de valor unitario nao mapeada'; end if;

  v_quantidade := coalesce(nullif(v_linha->>v_col_qtd, '')::numeric, 0);
  v_bdi        := coalesce(nullif(v_linha->>v_col_bdi, '')::numeric, 0);
  select atualizado_em into v_comp_versao from public.composicoes where id = v_composicao_id;

  v_nova_linha := jsonb_set(v_linha, array[v_col_unit], to_jsonb(v_custo));
  if v_col_total is not null then
    v_nova_linha := jsonb_set(v_nova_linha, array[v_col_total],
      to_jsonb(round((v_quantidade * v_custo * (1 + v_bdi/100))::numeric, 4)));
  end if;
  v_nova_linha := v_nova_linha || jsonb_build_object(
    '__valor_original',       nullif(v_linha->>v_col_unit, '')::numeric,
    '__valor_total_original', nullif(v_linha->>v_col_total, '')::numeric,
    '__valor_calculado',      v_custo,
    '__composicao_versao',    v_comp_versao);

  v_linhas := (
    select coalesce(jsonb_agg(
      case when coalesce(l.value->>'__item_id','') = p_chave_estavel or ('linha-'||l.ordinality::text) = p_chave_estavel
        then v_nova_linha else l.value end order by l.ordinality
    ), '[]'::jsonb) from jsonb_array_elements(v_linhas) with ordinality as l(value, ordinality)
  );
  update public.orcamentos set linhas = v_linhas where id = p_orcamento_id;
  v_versao := public.registrar_versao_orcamento(p_orcamento_id, p_autor);
  perform public.reconstruir_itens_orcamento(p_orcamento_id, v_colunas, v_linhas);
  return v_versao;
end $$;

create or replace function public.reverter_custo_composicao(
  p_orcamento_id uuid, p_chave_estavel text, p_autor uuid default null
) returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_colunas jsonb; v_linhas jsonb; v_versao integer; v_linha jsonb; v_nova_linha jsonb;
  v_col_unit text; v_col_total text;
begin
  select colunas, linhas into v_colunas, v_linhas from public.orcamentos where id = p_orcamento_id for update;
  if v_linhas is null then raise exception 'Orcamento nao encontrado'; end if;
  select l.value into v_linha from jsonb_array_elements(v_linhas) with ordinality as l(value, ordinality)
    where coalesce(l.value->>'__item_id','') = p_chave_estavel or ('linha-'||l.ordinality::text) = p_chave_estavel limit 1;
  if v_linha is null then raise exception 'Linha nao encontrada'; end if;
  if v_linha->>'__valor_original' is null then raise exception 'Item sem valor original para reverter'; end if;
  v_col_unit := (select value->>'id' from jsonb_array_elements(v_colunas) where value->>'funcao' = 'valor_unitario' limit 1);
  v_col_total := (select value->>'id' from jsonb_array_elements(v_colunas) where value->>'funcao' = 'valor_total' limit 1);
  v_nova_linha := v_linha;
  if v_col_unit is not null then
    v_nova_linha := jsonb_set(v_nova_linha, array[v_col_unit], to_jsonb((v_linha->>'__valor_original')::numeric));
  end if;
  if v_col_total is not null and v_linha->>'__valor_total_original' is not null then
    v_nova_linha := jsonb_set(v_nova_linha, array[v_col_total], to_jsonb((v_linha->>'__valor_total_original')::numeric));
  end if;
  v_nova_linha := v_nova_linha - '__valor_original' - '__valor_total_original';
  v_linhas := (
    select coalesce(jsonb_agg(
      case when coalesce(l.value->>'__item_id','') = p_chave_estavel or ('linha-'||l.ordinality::text) = p_chave_estavel
        then v_nova_linha else l.value end order by l.ordinality
    ), '[]'::jsonb) from jsonb_array_elements(v_linhas) with ordinality as l(value, ordinality)
  );
  update public.orcamentos set linhas = v_linhas where id = p_orcamento_id;
  v_versao := public.registrar_versao_orcamento(p_orcamento_id, p_autor);
  perform public.reconstruir_itens_orcamento(p_orcamento_id, v_colunas, v_linhas);
  return v_versao;
end $$;

-- ============================================================
-- 5. Projecao: vinculo + chaves estaveis garantidas
-- ============================================================
create or replace function public.reconstruir_itens_orcamento(p_orcamento_id uuid, p_colunas jsonb, p_linhas jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  linha jsonb; chave text; v_chave_estavel text; item_id uuid; i integer := 0;
  v_obra_id uuid; v_codigo text; v_composicao_id uuid; v_composicao_versao timestamptz;
begin
  select obra_id into v_obra_id from public.orcamentos where id = p_orcamento_id;
  for linha in select value from jsonb_array_elements(p_linhas) loop
    i := i + 1;
    chave := linha->>'__item_id';
    v_chave_estavel := coalesce(nullif(chave, ''), 'linha-' || i::text);
    select oi.id into item_id from public.orcamento_itens oi
      where oi.orcamento_id = p_orcamento_id and oi.chave_estavel = v_chave_estavel limit 1;
    if item_id is null then
      begin item_id := nullif(chave, '')::uuid; exception when invalid_text_representation then item_id := null; end;
      if item_id is null then item_id := gen_random_uuid(); end if;
    end if;
    v_codigo := (select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'codigo' limit 1);
    v_composicao_id := coalesce(nullif(linha->>'__composicao_id','')::uuid, public.resolver_composicao_por_codigo(v_obra_id, v_codigo));
    select atualizado_em into v_composicao_versao from public.composicoes where id = v_composicao_id;
    v_composicao_versao := coalesce(nullif(linha->>'__composicao_versao','')::timestamptz, v_composicao_versao);
    insert into public.orcamento_itens(id, orcamento_id, chave_estavel, ordem, codigo, descricao, unidade, quantidade, valor_unitario, valor_total, valor_bdi, custo_real, grupo, dados, tipo, ativo, composicao_id, composicao_versao)
    values (
      item_id, p_orcamento_id, v_chave_estavel, i,
      v_codigo,
      (select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'descricao' limit 1),
      (select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'unidade' limit 1),
      coalesce(nullif((select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'quantidade' limit 1), '')::numeric, 0),
      coalesce(nullif((select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'valor_unitario' limit 1), '')::numeric, 0),
      coalesce(nullif((select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'valor_total' limit 1), '')::numeric, 0),
      nullif((select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'valor_bdi' limit 1), '')::numeric,
      nullif((select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'custo_real' limit 1), '')::numeric,
      linha->>'__grupo', linha, coalesce(linha->>'__tipo', 'item'), true,
      v_composicao_id, v_composicao_versao
    ) on conflict (orcamento_id, chave_estavel) do update set
      ordem = excluded.ordem, codigo = excluded.codigo, descricao = excluded.descricao, unidade = excluded.unidade,
      quantidade = excluded.quantidade, valor_unitario = excluded.valor_unitario, valor_total = excluded.valor_total,
      valor_bdi = excluded.valor_bdi, custo_real = excluded.custo_real, grupo = excluded.grupo, dados = excluded.dados,
      tipo = excluded.tipo, ativo = true, composicao_id = excluded.composicao_id, composicao_versao = excluded.composicao_versao,
      atualizado_em = now();
  end loop;
  update public.orcamento_itens oi set ativo = false, atualizado_em = now()
    where oi.orcamento_id = p_orcamento_id and oi.ativo and not exists (
      select 1 from jsonb_array_elements(p_linhas) with ordinality as l(value, posicao)
      where coalesce(nullif(l.value->>'__item_id', ''), 'linha-' || l.posicao::text) = oi.chave_estavel
    );
end $$;

create or replace function public.salvar_orcamento_atomico(
  p_orcamento_id uuid, p_obra_id uuid, p_nome text, p_colunas jsonb, p_linhas jsonb,
  p_versao_esperada integer default null, p_autor uuid default null
) returns integer language plpgsql security invoker set search_path = '' as $$
declare atual integer; nova integer; v_linhas jsonb;
begin
  select versao into atual from public.orcamentos where id = p_orcamento_id and obra_id = p_obra_id for update;
  if atual is null then raise exception 'Orcamento nao encontrado'; end if;
  if p_versao_esperada is not null and atual <> p_versao_esperada then raise exception 'Orcamento foi alterado por outro usuario'; end if;
  nova := atual + 1;
  -- garante chave estavel para linhas sem __item_id (evita chaves ordinais instaveis)
  v_linhas := (
    select coalesce(jsonb_agg(
      case when coalesce(l.value->>'__item_id','') = ''
        then l.value || jsonb_build_object('__item_id', gen_random_uuid()::text)
        else l.value end order by l.ordinality
    ), '[]'::jsonb) from jsonb_array_elements(p_linhas) with ordinality as l(value, ordinality)
  );
  insert into public.orcamento_versoes(orcamento_id, versao, colunas, linhas, criado_por)
    values (p_orcamento_id, nova, p_colunas, v_linhas, coalesce(p_autor, (select auth.uid())));
  update public.orcamentos set nome = p_nome, colunas = p_colunas, linhas = v_linhas, versao = nova where id = p_orcamento_id;
  perform public.reconstruir_itens_orcamento(p_orcamento_id, p_colunas, v_linhas);
  insert into public.orcamento_auditoria(orcamento_id, entidade, entidade_id, operacao, antes, depois, autor_id)
    values (p_orcamento_id, 'orcamento', p_orcamento_id, 'update',
      jsonb_build_object('versao', atual), jsonb_build_object('versao', nova), coalesce(p_autor, (select auth.uid())));
  return nova;
end $$;

-- ============================================================
-- 6. Grants (convencao do projeto)
-- ============================================================
grant execute on function public.custo_composicoes(uuid, uuid) to authenticated;
grant execute on function public.resolver_composicao_por_codigo(uuid, text) to authenticated;
grant execute on function public.painel_financeiro_obra(uuid) to authenticated;
grant execute on function public.registrar_versao_orcamento(uuid, uuid) to authenticated;
grant execute on function public.vincular_composicao_item(uuid, text, uuid, uuid) to authenticated;
grant execute on function public.aplicar_custo_composicao(uuid, text, uuid) to authenticated;
grant execute on function public.reverter_custo_composicao(uuid, text, uuid) to authenticated;
