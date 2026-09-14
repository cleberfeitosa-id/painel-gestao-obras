-- Recupera os titulos a partir dos itens do orcamento sintetico.
with nomes as (
  select distinct on (o.obra_id, oi.codigo)
    o.obra_id,
    oi.codigo,
    nullif(trim(oi.descricao), '') as nome
  from public.orcamento_itens oi
  join public.orcamentos o on o.id = oi.orcamento_id
  where oi.ativo
    and oi.tipo = 'item'
    and nullif(trim(oi.descricao), '') is not null
  order by o.obra_id, oi.codigo, o.atualizado_em desc, oi.ordem
)
update public.composicoes c
set nome = nomes.nome
from nomes
where c.obra_id = nomes.obra_id
  and c.codigo = nomes.codigo
  and c.nome is distinct from nomes.nome;

-- Preserva o preco oficial da linha-pai antes de remove-la. Isso tambem
-- recupera o valor quando a migracao 0023 removeu um filho legitimo.
update public.composicoes c
set custo_unitario = pais.custo_unitario
from (
  select distinct on (cc.composicao_id)
    cc.composicao_id,
    cc.custo_unitario
  from public.composicao_componentes cc
  join public.composicoes c2 on c2.id = cc.composicao_id
  where cc.composicao_referencia_id is null
    and lower(regexp_replace(trim(cc.nome), '[^[:alnum:]]+', ' ', 'g'))
        = lower(regexp_replace(trim(c2.nome), '[^[:alnum:]]+', ' ', 'g'))
    and cc.quantidade = 1
  order by cc.composicao_id, cc.criado_em
) pais
where c.id = pais.composicao_id;

delete from public.composicao_componentes cc
using public.composicoes c
where cc.composicao_id = c.id
  and cc.composicao_referencia_id is null
  and lower(regexp_replace(trim(cc.nome), '[^[:alnum:]]+', ' ', 'g'))
      = lower(regexp_replace(trim(c.nome), '[^[:alnum:]]+', ' ', 'g'));

update public.composicoes c
set custo_unitario = coalesce((
  select round(sum(cc.quantidade * cc.custo_unitario), 4)
  from public.composicao_componentes cc
  where cc.composicao_id = c.id
), 0);
