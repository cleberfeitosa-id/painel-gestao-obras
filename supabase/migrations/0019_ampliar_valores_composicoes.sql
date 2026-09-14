-- Permite valores de composições com maior precisao sem overflow durante importacoes.
alter table public.composicoes
  alter column custo_unitario type numeric(20, 4);

alter table public.composicao_componentes
  alter column quantidade type numeric(20, 4),
  alter column custo_unitario type numeric(20, 4);
