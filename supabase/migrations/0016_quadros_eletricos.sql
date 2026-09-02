-- ============================================================================
-- Painel de Gestão de Obras - Vasconcelos Engenharia
-- Migração 0016: Módulo de Modelagem de Quadros Elétricos
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. QUADRO TEMPLATES (Modelos reutilizáveis entre obras)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quadro_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                TEXT NOT NULL,
  descricao           TEXT,
  tipo_quadro         TEXT NOT NULL DEFAULT 'QDC',
  largura_mm          NUMERIC(10, 2) NOT NULL DEFAULT 600,
  altura_mm           NUMERIC(10, 2) NOT NULL DEFAULT 800,
  profundidade_mm     NUMERIC(10, 2) NOT NULL DEFAULT 200,
  largura_util_mm     NUMERIC(10, 2) NOT NULL DEFAULT 540,
  altura_util_mm      NUMERIC(10, 2) NOT NULL DEFAULT 740,
  margem_lateral_mm   NUMERIC(10, 2) NOT NULL DEFAULT 30,
  margem_topo_mm      NUMERIC(10, 2) NOT NULL DEFAULT 30,
  corrente_nominal    INTEGER DEFAULT 63,
  tensao_nominal      TEXT DEFAULT '220/380V',
  grau_protecao       TEXT DEFAULT 'IP54',
  material_caixa      TEXT DEFAULT 'Aço tratado com pintura eletrostática',
  layout              JSONB NOT NULL DEFAULT '{"elementos": [], "barramentos": [], "trilhos": [], "canaletas": []}'::jsonb,
  publico             BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por          UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quadro_templates_tipo ON public.quadro_templates (tipo_quadro);

-- ---------------------------------------------------------------------------
-- 2. QUADROS ELÉTRICOS (Instâncias associadas a obras)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quadros_eletricos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id             UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  planta_id           UUID REFERENCES public.plantas(id) ON DELETE SET NULL,
  template_id         UUID REFERENCES public.quadro_templates(id) ON DELETE SET NULL,
  tag                 TEXT NOT NULL,
  nome                TEXT,
  tipo_quadro         TEXT NOT NULL DEFAULT 'QDC',
  tensao_nominal      TEXT DEFAULT '220/380V',
  corrente_nominal    INTEGER DEFAULT 63,
  corrente_curto_ka   NUMERIC(6, 2) DEFAULT 10,
  grau_protecao       TEXT DEFAULT 'IP54',
  material_caixa      TEXT DEFAULT 'Aço tratado com pintura eletrostática',
  largura_mm          NUMERIC(10, 2) NOT NULL DEFAULT 600,
  altura_mm           NUMERIC(10, 2) NOT NULL DEFAULT 800,
  profundidade_mm     NUMERIC(10, 2) NOT NULL DEFAULT 200,
  largura_util_mm     NUMERIC(10, 2) NOT NULL DEFAULT 540,
  altura_util_mm      NUMERIC(10, 2) NOT NULL DEFAULT 740,
  margem_lateral_mm   NUMERIC(10, 2) NOT NULL DEFAULT 30,
  margem_topo_mm      NUMERIC(10, 2) NOT NULL DEFAULT 30,
  layout              JSONB NOT NULL DEFAULT '{"elementos": [], "barramentos": [], "trilhos": [], "canaletas": []}'::jsonb,
  circuitos_vinculados JSONB NOT NULL DEFAULT '[]'::jsonb,
  levantamento_id     UUID REFERENCES public.levantamentos(id) ON DELETE SET NULL,
  criado_por          UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quadros_obra ON public.quadros_eletricos (obra_id);
CREATE INDEX IF NOT EXISTS idx_quadros_tag ON public.quadros_eletricos (obra_id, tag);

-- Adiciona coluna opcional em tarefas
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS quadro_eletrico_id UUID REFERENCES public.quadros_eletricos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tarefas_quadro ON public.tarefas (quadro_eletrico_id);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.quadro_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadros_eletricos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quadro_templates_select ON public.quadro_templates;
CREATE POLICY quadro_templates_select ON public.quadro_templates
  FOR SELECT TO AUTHENTICATED USING (TRUE);

DROP POLICY IF EXISTS quadro_templates_gestor ON public.quadro_templates;
CREATE POLICY quadro_templates_gestor ON public.quadro_templates
  FOR ALL TO AUTHENTICATED
  USING (PUBLIC.e_gestor())
  WITH CHECK (PUBLIC.e_gestor());

DROP POLICY IF EXISTS quadros_select ON public.quadros_eletricos;
CREATE POLICY quadros_select ON public.quadros_eletricos
  FOR SELECT TO AUTHENTICATED USING (TRUE);

DROP POLICY IF EXISTS quadros_gestor ON public.quadros_eletricos;
CREATE POLICY quadros_gestor ON public.quadros_eletricos
  FOR ALL TO AUTHENTICATED
  USING (PUBLIC.e_gestor())
  WITH CHECK (PUBLIC.e_gestor());

-- ---------------------------------------------------------------------------
-- 4. Triggers de atualização
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_quadro_templates_atualizado ON public.quadro_templates;
CREATE TRIGGER trg_quadro_templates_atualizado BEFORE UPDATE ON public.quadro_templates
  FOR EACH ROW EXECUTE FUNCTION PUBLIC.tocar_atualizado_em();

DROP TRIGGER IF EXISTS trg_quadros_eletricos_atualizado ON public.quadros_eletricos;
CREATE TRIGGER trg_quadros_eletricos_atualizado BEFORE UPDATE ON public.quadros_eletricos
  FOR EACH ROW EXECUTE FUNCTION PUBLIC.tocar_atualizado_em();
