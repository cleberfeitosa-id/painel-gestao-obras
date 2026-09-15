-- Recupera bancos em que a migration 0033 foi aplicada parcialmente.
-- A funcao auxiliar deve existir antes dos RPCs financeiros que a referenciam.

do $$
begin
  if exists (
    select 1 from public.tarefa_medicoes
    group by tarefa_id, catalogo_id
    having count(*) > 1
  ) then
    raise exception 'Existem duplicidades em tarefa_medicoes; reconcilie os dados antes de aplicar a constraint unica';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tarefa_medicoes'::regclass
      and conname = 'tarefa_medicoes_tarefa_catalogo_unicos'
  ) then
    alter table public.tarefa_medicoes
      add constraint tarefa_medicoes_tarefa_catalogo_unicos unique (tarefa_id, catalogo_id);
  end if;
end;
$$;

create or replace function public.preco_efetivo_catalogo(p_catalogo_id uuid)
returns numeric(14, 2)
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(c.valor_unitario, 0),
    (
      select case when count(*) = 1 then max(oi.valor_unitario) else null end
      from public.orcamento_itens oi
      join public.orcamentos o on o.id = oi.orcamento_id
      join public.medicoes m on m.id = c.medicao_id
      where o.obra_id = m.obra_id
        and oi.id in (
          select j.orcamento_item_id
          from public.catalogo_precos_orcamento_itens j
          where j.catalogo_id = c.id
          union
          select c.orcamento_item_id
        )
        and oi.ativo
        and oi.tipo = 'item'
        and oi.valor_unitario > 0
    ),
    0
  )
  from public.catalogo_precos c
  where c.id = p_catalogo_id
$$;

create or replace function public.painel_financeiro_obra(p_obra_id uuid)
returns table (
  orcamento_item_id uuid,
  codigo text,
  descricao text,
  unidade text,
  quantidade_prevista numeric(20,4),
  previsto numeric(20,4),
  quantidade_medida numeric(20,4),
  medido numeric(20,4),
  quantidade_executada numeric(20,4),
  executado numeric(20,4),
  composicao_id uuid
)
language sql
stable
set search_path = ''
as $$
  select
    oi.id,
    oi.codigo,
    oi.descricao,
    oi.unidade,
    oi.quantidade,
    coalesce(nullif(oi.valor_total, 0), oi.quantidade * oi.valor_unitario),
    coalesce(med.quantidade_medida, 0),
    coalesce(med.medido, 0),
    coalesce(med.quantidade_executada, 0),
    coalesce(med.executado, 0),
    oi.composicao_id
  from public.orcamento_itens oi
  join public.orcamentos o on o.id = oi.orcamento_id
  left join (
    select
      j.orcamento_item_id,
      sum(tm.quantidade) as quantidade_medida,
      sum(tm.quantidade * public.preco_efetivo_catalogo(c.id)) as medido,
      sum(tm.quantidade) filter (where t.status = 'concluido') as quantidade_executada,
      sum(tm.quantidade * public.preco_efetivo_catalogo(c.id)) filter (where t.status = 'concluido') as executado
    from public.catalogo_precos_orcamento_itens j
    join public.catalogo_precos c on c.id = j.catalogo_id
    join public.medicoes m on m.id = c.medicao_id and m.obra_id = p_obra_id
    join public.tarefa_medicoes tm on tm.catalogo_id = c.id
    join public.tarefas t on t.id = tm.tarefa_id and t.obra_id = p_obra_id
    group by j.orcamento_item_id
  ) med on med.orcamento_item_id = oi.id
  where o.obra_id = p_obra_id
    and oi.ativo
    and oi.tipo = 'item'
$$;

grant execute on function public.preco_efetivo_catalogo(uuid) to authenticated;
grant execute on function public.painel_financeiro_obra(uuid) to authenticated;

create or replace function public.atualizar_catalogo_com_vinculos(
  p_catalogo_id uuid, p_medicao_id uuid, p_nome text, p_valor_unitario numeric,
  p_unidade text, p_orcamento_item_ids uuid[]
)
returns void language plpgsql set search_path = '' as $$
declare v_obra_id uuid; v_ids integer; v_validos integer;
begin
  select m.obra_id into v_obra_id from public.medicoes m
  join public.catalogo_precos c on c.medicao_id = m.id
  where m.id = p_medicao_id and c.id = p_catalogo_id;
  if v_obra_id is null then raise exception 'Item do catalogo nao pertence a medicao'; end if;
  select count(*) into v_ids from (select distinct unnest(coalesce(p_orcamento_item_ids, '{}'::uuid[])) id) x;
  select count(*) into v_validos from public.orcamento_itens oi
  join public.orcamentos o on o.id = oi.orcamento_id
  where oi.id = any(coalesce(p_orcamento_item_ids, '{}'::uuid[])) and o.obra_id = v_obra_id;
  if v_ids <> v_validos then raise exception 'Itens do orcamento invalidos para esta obra'; end if;
  update public.catalogo_precos set nome = p_nome, valor_unitario = p_valor_unitario, unidade = p_unidade
  where id = p_catalogo_id and medicao_id = p_medicao_id;
  delete from public.catalogo_precos_orcamento_itens where catalogo_id = p_catalogo_id;
  insert into public.catalogo_precos_orcamento_itens (catalogo_id, orcamento_item_id)
  select p_catalogo_id, x.id from (select distinct unnest(coalesce(p_orcamento_item_ids, '{}'::uuid[])) id) x;
end;
$$;

create or replace function public.criar_catalogo_com_vinculos(
  p_medicao_id uuid, p_nome text, p_valor_unitario numeric, p_unidade text,
  p_criado_por uuid, p_orcamento_item_ids uuid[]
)
returns uuid language plpgsql set search_path = '' as $$
declare v_id uuid; v_obra_id uuid; v_ids integer; v_validos integer;
begin
  select obra_id into v_obra_id from public.medicoes where id = p_medicao_id;
  if v_obra_id is null then raise exception 'Medicao nao encontrada'; end if;
  select count(*) into v_ids from (select distinct unnest(coalesce(p_orcamento_item_ids, '{}'::uuid[])) id) x;
  select count(*) into v_validos from public.orcamento_itens oi
  join public.orcamentos o on o.id = oi.orcamento_id
  where oi.id = any(coalesce(p_orcamento_item_ids, '{}'::uuid[])) and o.obra_id = v_obra_id;
  if v_ids <> v_validos then raise exception 'Itens do orcamento invalidos'; end if;
  insert into public.catalogo_precos (medicao_id, nome, valor_unitario, unidade, criado_por)
  values (p_medicao_id, p_nome, p_valor_unitario, p_unidade, p_criado_por) returning id into v_id;
  insert into public.catalogo_precos_orcamento_itens (catalogo_id, orcamento_item_id)
  select v_id, x.id from (select distinct unnest(coalesce(p_orcamento_item_ids, '{}'::uuid[])) id) x;
  return v_id;
end;
$$;

grant execute on function public.atualizar_catalogo_com_vinculos(uuid, uuid, text, numeric, text, uuid[]) to authenticated;
grant execute on function public.criar_catalogo_com_vinculos(uuid, text, numeric, text, uuid, uuid[]) to authenticated;

create or replace function public.valor_executado_medicao(p_medicao_id uuid)
returns numeric(14, 2)
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(tm.quantidade * public.preco_efetivo_catalogo(c.id)), 0)
  from public.tarefa_medicoes tm
  join public.tarefas t on t.id = tm.tarefa_id
  join public.catalogo_precos c on c.id = tm.catalogo_id
  join public.medicoes m on m.id = c.medicao_id
  where c.medicao_id = p_medicao_id
    and t.obra_id = m.obra_id
    and t.status = 'concluido'
$$;

create or replace function public.valor_pendente_medicao(p_medicao_id uuid)
returns numeric(14, 2)
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(tm.quantidade * public.preco_efetivo_catalogo(c.id)), 0)
  from public.tarefa_medicoes tm
  join public.tarefas t on t.id = tm.tarefa_id
  join public.catalogo_precos c on c.id = tm.catalogo_id
  join public.medicoes m on m.id = c.medicao_id
  where c.medicao_id = p_medicao_id
    and t.obra_id = m.obra_id
    and t.status <> 'concluido'
$$;

grant execute on function public.valor_executado_medicao(uuid) to authenticated;
grant execute on function public.valor_pendente_medicao(uuid) to authenticated;
