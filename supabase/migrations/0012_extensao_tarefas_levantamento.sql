-- Extensão do Enum tipo_localizacao
ALTER TYPE tipo_localizacao ADD VALUE IF NOT EXISTS 'distancia';
ALTER TYPE tipo_localizacao ADD VALUE IF NOT EXISTS 'circuito';
ALTER TYPE tipo_localizacao ADD VALUE IF NOT EXISTS 'area';

-- Extensão da Tabela Tarefas
ALTER TABLE tarefas ADD COLUMN levantamento_id UUID; 
ALTER TABLE tarefas ADD COLUMN localizacao_detalhe JSONB;
