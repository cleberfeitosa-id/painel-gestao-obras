-- Atualização das constraints de check da tabela tarefas
-- Esta migração deve ser executada após a 0012, para que os novos valores do Enum tipo_localizacao estejam commitados.
ALTER TABLE tarefas DROP CONSTRAINT IF EXISTS check_localizacao_validacao;
ALTER TABLE tarefas ADD CONSTRAINT check_localizacao_validacao 
CHECK (
  (localizacao_tipo = 'ponto' AND ponto_x IS NOT NULL AND ponto_y IS NOT NULL) OR
  (localizacao_tipo = 'regiao' AND regiao IS NOT NULL) OR
  (localizacao_tipo IN ('distancia', 'circuito', 'area') AND localizacao_detalhe IS NOT NULL) OR
  (localizacao_tipo = 'nenhuma')
);
