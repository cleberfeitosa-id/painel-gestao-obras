-- Preserva o identificador hierarquico da planilha analitica como coluna
-- normalizada, sem remover o JSON bruto de dados para compatibilidade.
alter table public.orcamento_itens
  add column if not exists item text;

create or replace function public.reconstruir_itens_orcamento(p_orcamento_id uuid, p_colunas jsonb, p_linhas jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare linha jsonb; chave text; v_chave_estavel text; item_id uuid; i integer := 0;
begin
  for linha in select value from jsonb_array_elements(p_linhas) loop
    i := i + 1;
    chave := linha->>'__item_id';
    v_chave_estavel := coalesce(nullif(chave, ''), 'linha-' || i::text);
    select oi.id into item_id from public.orcamento_itens oi where oi.orcamento_id = p_orcamento_id and oi.chave_estavel = v_chave_estavel limit 1;
    if item_id is null then
      begin item_id := nullif(chave, '')::uuid; exception when invalid_text_representation then item_id := null; end;
      if item_id is null then item_id := gen_random_uuid(); end if;
    end if;
    insert into public.orcamento_itens(id, orcamento_id, chave_estavel, ordem, item, codigo, descricao, unidade, quantidade, valor_unitario, valor_total, valor_bdi, custo_real, grupo, dados, tipo, ativo)
    values (
      item_id, p_orcamento_id, v_chave_estavel, i,
      (select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'item' limit 1),
      (select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'codigo' limit 1),
      (select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'descricao' limit 1),
      (select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'unidade' limit 1),
      coalesce(nullif((select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'quantidade' limit 1), '')::numeric, 0),
      coalesce(nullif((select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'valor_unitario' limit 1), '')::numeric, 0),
      coalesce(nullif((select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'valor_total' limit 1), '')::numeric, 0),
      nullif((select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'valor_bdi' limit 1), '')::numeric,
      nullif((select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'custo_real' limit 1), '')::numeric,
      linha->>'__grupo', linha, coalesce(linha->>'__tipo', 'item'), true
    ) on conflict (orcamento_id, chave_estavel) do update set ordem = excluded.ordem, item = excluded.item, codigo = excluded.codigo, descricao = excluded.descricao, unidade = excluded.unidade, quantidade = excluded.quantidade, valor_unitario = excluded.valor_unitario, valor_total = excluded.valor_total, valor_bdi = excluded.valor_bdi, custo_real = excluded.custo_real, grupo = excluded.grupo, dados = excluded.dados, tipo = excluded.tipo, ativo = true, atualizado_em = now();
  end loop;
  update public.orcamento_itens oi set ativo = false, atualizado_em = now()
    where oi.orcamento_id = p_orcamento_id and oi.ativo and not exists (
      select 1 from jsonb_array_elements(p_linhas) with ordinality as l(value, posicao)
      where coalesce(nullif(l.value->>'__item_id', ''), 'linha-' || l.posicao::text) = oi.chave_estavel
    );
end $$;

-- Atualiza cargas anteriores que ja preservavam o item em dados ou nos
-- metadados de origem do pacote modelado.
update public.orcamento_itens
set item = coalesce(item, dados->>'item', dados->'__dados_origem'->>'item')
where item is null;
