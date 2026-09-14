-- Modulo de validacao de orcamentos e composicoes.
create table if not exists public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras (id) on delete cascade,
  nome text not null,
  descricao text,
  arquivo_nome text,
  arquivo_caminho text,
  colunas jsonb not null default '[]'::jsonb,
  linhas jsonb not null default '[]'::jsonb,
  criado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.composicoes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras (id) on delete cascade,
  codigo text,
  nome text not null,
  unidade text not null default 'un',
  custo_unitario numeric(14, 4) not null default 0 check (custo_unitario >= 0),
  criado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.composicao_componentes (
  id uuid primary key default gen_random_uuid(),
  composicao_id uuid not null references public.composicoes (id) on delete cascade,
  nome text not null,
  categoria text not null default 'material' check (categoria in ('mao_de_obra', 'material', 'equipamento', 'outro')),
  unidade text not null default 'un',
  quantidade numeric(14, 4) not null default 0 check (quantidade >= 0),
  custo_unitario numeric(14, 4) not null default 0 check (custo_unitario >= 0),
  criado_em timestamptz not null default now()
);

create index if not exists idx_orcamentos_obra on public.orcamentos (obra_id);
create index if not exists idx_composicoes_obra on public.composicoes (obra_id);
create unique index if not exists idx_composicoes_obra_codigo on public.composicoes (obra_id, codigo) where codigo is not null;
create index if not exists idx_composicao_componentes_composicao on public.composicao_componentes (composicao_id);

alter table public.orcamentos enable row level security;
alter table public.composicoes enable row level security;
alter table public.composicao_componentes enable row level security;

drop policy if exists orcamentos_select on public.orcamentos;
create policy orcamentos_select on public.orcamentos for select to authenticated using (true);
drop policy if exists orcamentos_gestor_escreve on public.orcamentos;
create policy orcamentos_gestor_escreve on public.orcamentos for all to authenticated using (public.e_gestor()) with check (public.e_gestor());

drop policy if exists composicoes_select on public.composicoes;
create policy composicoes_select on public.composicoes for select to authenticated using (true);
drop policy if exists composicoes_gestor_escreve on public.composicoes;
create policy composicoes_gestor_escreve on public.composicoes for all to authenticated using (public.e_gestor()) with check (public.e_gestor());

drop policy if exists composicao_componentes_select on public.composicao_componentes;
create policy composicao_componentes_select on public.composicao_componentes for select to authenticated using (true);
drop policy if exists composicao_componentes_gestor_escreve on public.composicao_componentes;
create policy composicao_componentes_gestor_escreve on public.composicao_componentes for all to authenticated using (public.e_gestor()) with check (public.e_gestor());

drop trigger if exists trg_orcamentos_atualizado on public.orcamentos;
create trigger trg_orcamentos_atualizado before update on public.orcamentos for each row execute function public.tocar_atualizado_em();
drop trigger if exists trg_composicoes_atualizado on public.composicoes;
create trigger trg_composicoes_atualizado before update on public.composicoes for each row execute function public.tocar_atualizado_em();

create or replace function public.substituir_componentes_composicao(
  p_composicao_id uuid,
  p_componentes jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.composicao_componentes
  where composicao_id = p_composicao_id;

   insert into public.composicao_componentes (
     composicao_id, nome, categoria, unidade, quantidade, custo_unitario
  )
  select
     p_composicao_id,
    item->>'nome',
    item->>'categoria',
    item->>'unidade',
    (item->>'quantidade')::numeric,
    (item->>'custo_unitario')::numeric
  from jsonb_array_elements(p_componentes) as item;
end;
$$;
