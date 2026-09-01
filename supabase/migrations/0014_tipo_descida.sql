-- ============================================================================
-- Painel de Gestao de Obras - Vasconcelos Engenharia
-- Migracao 0014: Extensao do Enum tipo_localizacao com 'descida'
--   - Adiciona o valor 'descida' ao enum tipo_localizacao
--   - NOTA: No Postgres, novos valores de enum precisam ser commitados antes
--     de poderem ser referenciados em constraints. Por isso a atualizacao
--     da constraint fica na migracao 0015.
-- ============================================================================

ALTER TYPE tipo_localizacao ADD VALUE IF NOT EXISTS 'descida';
