-- Snapshot opcional dos trechos de circuito associados a um item de medição.
-- Linhas antigas permanecem válidas e continuam usando somente quantidade.
alter table public.tarefa_medicoes
  add column if not exists segmentos_circuito jsonb not null default '[]'::jsonb;

comment on column public.tarefa_medicoes.segmentos_circuito is
  'Snapshot opcional dos segmentos de circuito: id, comprimento da rota e metros de cabo.';
