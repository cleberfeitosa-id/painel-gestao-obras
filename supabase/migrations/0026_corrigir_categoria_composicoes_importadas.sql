-- ============================================================
-- Migration 0026: Corrige a classificacao de componentes de
-- composicoes importadas e sincroniza compra_itens.
--
-- Background: o parser de composicoes (importar-composicoes.tsx)
-- classificava "Composicao Auxiliar" como "material" em vez de
-- "mao_de_obra" ou "equipamento". Esta migration corrige os
-- registros existentes usando a mesma heuristica do parser
-- corrigido em classificar-categoria.ts.
--
-- Regra:
--   Se o nome do componente corresponde a keyword de mao de obra
--   (CARPINTEIRO, PEDREIRO, etc.) → mao_de_obra
--   Se corresponde a keyword de equipamento → equipamento
--   Caso contrario, o componente permanece como material.
-- ============================================================

-- ============================================================
-- 1. Funcao auxiliar: classifica um componente por keyword no nome
-- ============================================================
create or replace function public._classificar_componente(
  p_nome text
) returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_normalizado text;
  v_keywords_mao_de_obra text[] := array[
    'CARPINTEIRO', 'PEDREIRO', 'SERVENTE', 'ELETRICISTA', 'ENCANADOR',
    'AJUDANTE', 'ARMADOR', 'PINTOR', 'AZULEJISTA', 'GESSEIRO',
    'TELHADISTA', 'OPERADOR', 'MOTORISTA', 'ENGENHEIRO', 'TECNICO',
    'MESTRE', 'ENCARREGADO', 'APONTADOR', 'VIGIA', 'BOMBEIRO',
    'SOLDADOR', 'LUBRIFICADOR', 'SERRALHEIRO', 'MONTADOR',
    'CALHEIRO', 'FUNILEIRO', 'VIDRACEIRO', 'LADRILLHADOR',
    'ALMOXARIFE', 'TOMBADOR', 'COZINHEIRO',
    'CAIXEIRO', 'OFICIAL', 'MEIO OFICIAL'
  ];
  v_keywords_equipamento text[] := array[
    'GUINCHO', 'BETONEIRA', 'ANDAIME', 'COMPACTADOR', 'VIBRADOR',
    'SERRA', 'CORTADORA', 'BOMBA', 'GERADOR', 'TRATOR',
    'CAMINHAO', 'RETROESCAVADEIRA', 'ESCAVADEIRA', 'PA CARREGADEIRA',
    'MOTONIVELADORA', 'ROL', 'COMPRESSOR', 'MARTELETE',
    'FURADEIRA', 'PARAFUSADEIRA', 'ESMERILHADEIRA', 'LIXADEIRA',
    'ASPIRADOR', 'LAVADORA', 'ELEVADOR',
    'PONT ROLANTE', 'EMPILHADEIRA', 'REBOQUE', 'CARRINHO',
    'GUINDASTE', 'GRUA', 'PLATAFORMA', 'CADEIRINHA',
    'BALANCIM', 'SOLDADEIRA', 'MAQUINA', 'EQUIPAMENTO',
    'CUSTO HORARIO', 'CUSTOS HORARIOS'
  ];
  v_kw text;
begin
  v_normalizado := ' ' ||
    upper(translate(coalesce(p_nome, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) || ' ';

  foreach v_kw in array v_keywords_mao_de_obra loop
    if v_normalizado like '% ' || v_kw || ' %' then
      return 'mao_de_obra';
    end if;
  end loop;

  foreach v_kw in array v_keywords_equipamento loop
    if v_normalizado like '% ' || v_kw || ' %' then
      return 'equipamento';
    end if;
  end loop;

  return 'material';
end;
$$;

-- ============================================================
-- 2. Atualiza composicao_componentes com categoria errada
-- ============================================================
with corrigidos as (
  select
    id,
    case
      when public._classificar_componente(nome) = 'mao_de_obra' then 'mao_de_obra'
      when public._classificar_componente(nome) = 'equipamento' then 'equipamento'
      else categoria
    end as categoria_nova
  from public.composicao_componentes
  where categoria = 'material'
    and public._classificar_componente(nome) in ('mao_de_obra', 'equipamento')
)
update public.composicao_componentes cc
set categoria = c.categoria_nova
from corrigidos c
where cc.id = c.id;

-- ============================================================
-- 3. Sincroniza compra_itens.categoria desnormalizada
--    (o trigger sync_compra_item_categoria so dispara em
--    insert/update do proprio compra_itens, nao em update
--    do composicao_componentes de referencia)
-- ============================================================
update public.compra_itens ci
set categoria = cc.categoria
from public.composicao_componentes cc
where ci.composicao_componente_id = cc.id
  and ci.categoria is distinct from cc.categoria;

-- ============================================================
-- 4. Remove funcao auxiliar (nao e necessaria em producao,
--    mas fica disponivel para auditoria. Mantemos para
--    consultas futuras de classificacao)
-- ============================================================
-- A funcao _classificar_componente e mantida como utilitario
-- para reclassificacoes futuras. Nao remover.
grant execute on function public._classificar_componente(text) to authenticated;

-- ============================================================
-- 5. Nova RPC: busca insumos (materiais reais) para o modulo
--    de compras, pesquisando em composicao_componentes em vez
--    de orcamento_itens (que sao itens sinteticos do orcamento).
--
--    Retorna todas as ocorrencias do mesmo insumo em diferentes
--    composicoes (sem dedup), filtrado por obra e termo de busca.
-- ============================================================
create or replace function public.buscar_insumos_compra(
  p_obra_id uuid,
  p_termo text
)
returns table (
  componente_id uuid,
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
set search_path = ''
as $$
  select
    cc.id,
    cc.codigo,
    cc.nome,
    cc.unidade,
    cc.quantidade as coeficiente,
    cc.custo_unitario,
    c.id as composicao_id,
    c.codigo as composicao_codigo,
    c.nome as composicao_nome
  from public.composicao_componentes cc
  join public.composicoes c on c.id = cc.composicao_id
  where c.obra_id = p_obra_id
    and cc.categoria = 'material'
    and (cc.codigo ilike '%' || p_termo || '%' or cc.nome ilike '%' || p_termo || '%')
  order by
    case when cc.codigo ilike p_termo || '%' then 0 else 1 end,
    cc.nome
  limit 50;
$$;

grant execute on function public.buscar_insumos_compra(uuid, text) to authenticated;

-- ============================================================
-- 6. RPC: retorna o custo por categoria (mao_de_obra + equipamento)
--    de uma composicao vinculada a um item do orcamento, para
--    exibicao no modulo de medicoes.
-- ============================================================
create or replace function public.custo_composicao_por_categoria(
  p_obra_id uuid,
  p_orcamento_item_id uuid
)
returns table (
  categoria text,
  total numeric(20,4)
)
language sql
stable
set search_path = ''
as $$
  select
    cc.categoria,
    sum(cc.quantidade * cc.custo_unitario)::numeric(20,4) as total
  from public.orcamento_itens oi
  join public.composicoes c on c.id = oi.composicao_id and c.obra_id = p_obra_id
  join public.composicao_componentes cc on cc.composicao_id = c.id
  where oi.id = p_orcamento_item_id
    and cc.categoria in ('mao_de_obra', 'equipamento')
  group by cc.categoria
  order by cc.categoria;
$$;

grant execute on function public.custo_composicao_por_categoria(uuid, uuid) to authenticated;

-- ============================================================
-- 7. Marca itens-pai da arvore orcamentaria como 'grupo' para
--    que nao sejam contados como itens nos totais do painel
--    financeiro. Um item e considerado pai quando seu codigo
--    e prefixo de outro item no mesmo orcamento
--    (ex: '10.1' e pai de '10.1.1').
-- ============================================================
update public.orcamento_itens oi
set tipo = 'grupo'
where oi.tipo = 'item'
  and oi.codigo is not null
  and exists (
    select 1 from public.orcamento_itens filho
    where filho.orcamento_id = oi.orcamento_id
      and filho.codigo like oi.codigo || '.%'
      and filho.ativo
  );

-- ============================================================
-- 8. RPC: painel orcamentario com suporte a hierarquia.
--    Retorna os itens com nivel de profundidade e valor
--    agregado dos descendentes para itens-pai.
-- ============================================================
create or replace function public.painel_orcamento_hierarquico(
  p_obra_id uuid
)
returns table (
  orcamento_item_id uuid,
  codigo text,
  descricao text,
  unidade text,
  tipo text,
  nivel integer,
  quantidade_prevista numeric(20,4),
  previsto numeric(20,4),
  quantidade_medida numeric(20,4),
  medido numeric(20,4),
  quantidade_executada numeric(20,4),
  executado numeric(20,4),
  comprado_material numeric(20,4),
  composicao_id uuid
)
language sql
stable
set search_path = ''
as $$
  with recursive arvore as (
    select
      oi.id as orcamento_item_id, oi.codigo, oi.descricao, oi.unidade, oi.tipo,
      1 as nivel, oi.quantidade as quantidade_prevista,
      coalesce(nullif(oi.valor_total, 0), oi.quantidade * oi.valor_unitario) as previsto,
      oi.composicao_id
    from public.orcamento_itens oi
    join public.orcamentos o on o.id = oi.orcamento_id
    where o.obra_id = p_obra_id and oi.ativo
      and (
        oi.codigo is null
        or not exists (
          select 1 from public.orcamento_itens pai
          where pai.orcamento_id = oi.orcamento_id
            and pai.ativo
            and pai.codigo is not null
            and oi.codigo like pai.codigo || '.%'
        )
      )
    union all
    select
      oi.id, oi.codigo, oi.descricao, oi.unidade, oi.tipo,
      a.nivel + 1, oi.quantidade,
      coalesce(nullif(oi.valor_total, 0), oi.quantidade * oi.valor_unitario),
      oi.composicao_id
    from arvore a
    join public.orcamento_itens oi
      on oi.orcamento_id = (select oi2.orcamento_id from public.orcamento_itens oi2 where oi2.id = a.orcamento_item_id)
      and oi.ativo
      and oi.codigo like a.codigo || '.%'
      and oi.codigo is not null
  ),
  medicoes as (
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
  ),
  compras as (
    select ci.orcamento_item_id,
      sum(ci.quantidade * ci.valor_unitario) filter (where ci.categoria = 'material') as comprado_material
    from public.compra_itens ci
    join public.compras c on c.id = ci.compra_id
    where c.obra_id = p_obra_id and ci.orcamento_item_id is not null
    group by ci.orcamento_item_id
  )
  select
    a.orcamento_item_id, a.codigo, a.descricao, a.unidade, a.tipo,
    a.nivel, a.quantidade_prevista, a.previsto,
    coalesce(m.quantidade_medida, 0), coalesce(m.medido, 0),
    coalesce(m.quantidade_executada, 0), coalesce(m.executado, 0),
    coalesce(cp.comprado_material, 0),
    a.composicao_id
  from arvore a
  left join medicoes m on m.orcamento_item_id = a.orcamento_item_id
  left join compras cp on cp.orcamento_item_id = a.orcamento_item_id
  order by a.nivel, a.codigo;
$$;

grant execute on function public.painel_orcamento_hierarquico(uuid) to authenticated;