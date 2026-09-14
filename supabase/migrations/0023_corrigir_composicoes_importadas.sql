-- Remove linhas-pai importadas como componentes e recalcula seus custos.
-- A condicao exige igualdade normalizada para evitar remover insumos legitimos.
create or replace function public.substituir_componentes_composicao(
  p_composicao_id uuid,
  p_componentes jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.composicao_componentes where composicao_id = p_composicao_id;
  insert into public.composicao_componentes (
    composicao_id, codigo, nome, categoria, unidade, quantidade, custo_unitario
  )
  select
    p_composicao_id,
    item->>'codigo',
    item->>'nome',
    item->>'categoria',
    item->>'unidade',
    (item->>'quantidade')::numeric,
    (item->>'custo_unitario')::numeric
  from jsonb_array_elements(p_componentes) as item;
end;
$$;

update public.composicoes c
set custo_unitario = coalesce((
  select round(sum(cc.quantidade * cc.custo_unitario), 4)
  from public.composicao_componentes cc
  where cc.composicao_id = c.id
), 0);
