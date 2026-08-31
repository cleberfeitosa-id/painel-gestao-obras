-- ============================================================================
-- Painel de Gestao de Obras - Vasconcelos Engenharia
-- Migracao 0009: Pagamentos por medicao
--   - medicao_pagamentos: pagamentos registrados por medicao (valor, data, descricao)
--   - funcao valor_pago_medicao(p_medicao_id)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. medicao_pagamentos
-- ---------------------------------------------------------------------------
create table if not exists public.medicao_pagamentos (
  id             uuid primary key default gen_random_uuid(),
  medicao_id     uuid not null references public.medicoes (id) on delete cascade,
  valor          numeric(14, 2) not null check (valor > 0),
  data_pagamento date not null,
  descricao      text not null,
  criado_por     uuid references public.perfis (id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists idx_medicao_pagamentos_medicao
  on public.medicao_pagamentos (medicao_id);

create index if not exists idx_medicao_pagamentos_data
  on public.medicao_pagamentos (medicao_id, data_pagamento desc);

-- ---------------------------------------------------------------------------
-- 2. Trigger de atualizado_em em medicao_pagamentos
-- ---------------------------------------------------------------------------
drop trigger if exists trg_medicao_pagamentos_atualizado on public.medicao_pagamentos;
create trigger trg_medicao_pagamentos_atualizado before update on public.medicao_pagamentos
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- 3. Funcao de calculo de valor pago por medicao
-- ---------------------------------------------------------------------------
create or replace function public.valor_pago_medicao(p_medicao_id uuid)
returns numeric(14, 2)
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(mp.valor), 0)
  from public.medicao_pagamentos mp
  where mp.medicao_id = p_medicao_id
$$;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.medicao_pagamentos enable row level security;

drop policy if exists medicao_pagamentos_select on public.medicao_pagamentos;
create policy medicao_pagamentos_select on public.medicao_pagamentos
  for select to authenticated using (true);

drop policy if exists medicao_pagamentos_gestor_escreve on public.medicao_pagamentos;
create policy medicao_pagamentos_gestor_escreve on public.medicao_pagamentos
  for all to authenticated
  using (public.e_gestor())
  with check (public.e_gestor());
