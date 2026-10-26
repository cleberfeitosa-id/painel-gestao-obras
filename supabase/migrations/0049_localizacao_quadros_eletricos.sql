-- Localizacao dos quadros eletricos no espaco PDF da planta.
ALTER TABLE public.quadros_eletricos
  ADD COLUMN IF NOT EXISTS pagina INTEGER,
  ADD COLUMN IF NOT EXISTS ponto_x NUMERIC,
  ADD COLUMN IF NOT EXISTS ponto_y NUMERIC;

ALTER TABLE public.quadros_eletricos
  DROP CONSTRAINT IF EXISTS quadros_eletricos_localizacao_completa_ck;

ALTER TABLE public.quadros_eletricos
  ADD CONSTRAINT quadros_eletricos_localizacao_completa_ck CHECK (
    (pagina IS NULL AND ponto_x IS NULL AND ponto_y IS NULL)
    OR (
      pagina IS NOT NULL AND pagina > 0
      AND planta_id IS NOT NULL
      AND ponto_x IS NOT NULL
      AND ponto_y IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_quadros_planta_pagina_posicao
  ON public.quadros_eletricos (planta_id, pagina)
  WHERE planta_id IS NOT NULL AND pagina IS NOT NULL;
