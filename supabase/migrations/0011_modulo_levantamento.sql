-- ============================================================================
-- Painel de Gestao de Obras - Vasconcelos Engenharia
-- Migracao 0011: Modulo de Levantamento de Quantidades
--   - levantamentos: Levantamentos quantitativos vinculados a plantas e obras
--     (contagens, medicoes de distancias, cabos/condutores, areas, niveis 3D)
-- ============================================================================

create table if not exists public.levantamentos (
  id             uuid primary key default gen_random_uuid(),
  obra_id        uuid not null references public.obras (id) on delete cascade,
  planta_id      uuid not null references public.plantas (id) on delete cascade,
  pagina         integer not null default 1 check (pagina >= 1),
  nome           text not null default 'Levantamento',
  descricao      text,
  niveis         jsonb not null default '[]'::jsonb,
  categorias     jsonb not null default '[]'::jsonb,
  itens          jsonb not null default '[]'::jsonb,
  config_legenda jsonb not null default '{"posicao": "se", "tamanhoFonte": 14, "corFundo": "#000000", "corTexto": "#ffffff", "opacidade": 230, "visivel": true}'::jsonb,
  criado_por     uuid references public.perfis (id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists idx_levantamentos_obra on public.levantamentos (obra_id);
create index if not exists idx_levantamentos_planta on public.levantamentos (planta_id);
create index if not exists idx_levantamentos_planta_pagina on public.levantamentos (planta_id, pagina);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.levantamentos enable row level security;

drop policy if exists levantamentos_select on public.levantamentos;
create policy levantamentos_select on public.levantamentos
  for select to authenticated using (true);

drop policy if exists levantamentos_gestor_escreve on public.levantamentos;
create policy levantamentos_gestor_escreve on public.levantamentos
  for all to authenticated
  using (public.e_gestor())
  with check (public.e_gestor());

-- Trigger de atualizado_em nos levantamentos
drop trigger if exists trg_levantamentos_atualizado on public.levantamentos;
create trigger trg_levantamentos_atualizado before update on public.levantamentos
  for each row execute function public.tocar_atualizado_em();
