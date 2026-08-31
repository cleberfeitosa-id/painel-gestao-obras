-- ---------------------------------------------------------------------------
-- Retorno de tarefa aprovada para "nao aprovada" (pendente).
--
-- Antes deste sprint, `tarefa_aprovacoes` era um historico append-only apenas
-- de avaliacoes terminais (aprovado/reprovado). A partir daqui ele tambem
-- registra o evento de REVERSAO: quando uma tarefa ja aprovada volta para
-- `pendente` (manualmente pelo supervisor ou automaticamente ao perder a foto
-- obrigatoria), gravamos uma linha com `decisao = 'pendente'` que documenta
-- quem reverteu e quando (criado_em).
-- ---------------------------------------------------------------------------

-- O historico passa a aceitar `pendente` como marcador de reversao. A regra de
-- motivo continua valida somente para reprovacao.
alter table public.tarefa_aprovacoes
  drop constraint if exists aprovacao_decisao_valida;

alter table public.tarefa_aprovacoes
  add constraint aprovacao_decisao_valida check (decisao in ('aprovado', 'reprovado', 'pendente'));
