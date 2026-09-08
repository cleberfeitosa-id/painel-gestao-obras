-- Migration: Compatibilização de Plantas

CREATE TABLE IF NOT EXISTS public.compatibilizacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.compatibilizacao_plantas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compatibilizacao_id UUID NOT NULL REFERENCES public.compatibilizacoes(id) ON DELETE CASCADE,
    planta_id UUID NOT NULL REFERENCES public.plantas(id) ON DELETE CASCADE,
    pagina INTEGER NOT NULL DEFAULT 1,
    e_base BOOLEAN NOT NULL DEFAULT FALSE,
    ref1_x DOUBLE PRECISION NOT NULL,
    ref1_y DOUBLE PRECISION NOT NULL,
    ref2_x DOUBLE PRECISION NOT NULL,
    ref2_y DOUBLE PRECISION NOT NULL,
    cor_identificacao TEXT NOT NULL DEFAULT '#EF4444',
    opacidade DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    visivel BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Garantir que haja apenas uma base por compatibilização (parcial index)
CREATE UNIQUE INDEX compatibilizacao_plantas_base_idx ON public.compatibilizacao_plantas(compatibilizacao_id) WHERE e_base = TRUE;

CREATE TABLE IF NOT EXISTS public.compatibilizacao_choques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compatibilizacao_id UUID NOT NULL REFERENCES public.compatibilizacoes(id) ON DELETE CASCADE,
    ponto_x DOUBLE PRECISION NOT NULL,
    ponto_y DOUBLE PRECISION NOT NULL,
    descricao TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberto',
    criado_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- RLS
ALTER TABLE public.compatibilizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compatibilizacao_plantas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compatibilizacao_choques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total as compatibilizacoes" ON public.compatibilizacoes FOR ALL USING (true);
CREATE POLICY "Acesso total as compatibilizacao_plantas" ON public.compatibilizacao_plantas FOR ALL USING (true);
CREATE POLICY "Acesso total aos choques" ON public.compatibilizacao_choques FOR ALL USING (true);

