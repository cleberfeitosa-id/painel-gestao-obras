-- ============================================================================
-- Painel de Gestao de Obras - Vasconcelos Engenharia
-- Migracao 0015: Atualizacao da constraint de validacao para 'descida'
--   - Executar apos a migracao 0014 para que o valor 'descida' esteja commitado.
-- ============================================================================

ALTER TABLE tarefas DROP CONSTRAINT IF EXISTS check_localizacao_validacao;
ALTER TABLE tarefas ADD CONSTRAINT check_localizacao_validacao
CHECK (
  (localizacao_tipo = 'ponto' AND ponto_x IS NOT NULL AND ponto_y IS NOT NULL) OR
  (localizacao_tipo = 'regiao' AND regiao IS NOT NULL) OR
  (localizacao_tipo IN ('distancia', 'circuito', 'area', 'descida') AND localizacao_detalhe IS NOT NULL) OR
  (localizacao_tipo = 'nenhuma')
);
