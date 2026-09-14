-- Corrige a FK da tabela associativa: a linha de vinculo deve desaparecer
-- quando o item do orcamento for removido.
alter table public.catalogo_precos_orcamento_itens
  drop constraint if exists catalogo_precos_orcamento_itens_orcamento_item_id_fkey;

alter table public.catalogo_precos_orcamento_itens
  add constraint catalogo_precos_orcamento_itens_orcamento_item_id_fkey
  foreign key (orcamento_item_id)
  references public.orcamento_itens(id)
  on delete cascade;
